import { inspect } from "node:util"

import type { Pool, PoolClient } from "pg"

import { E_FACTURA_STATUSES, type EFacturaStatus } from "../../cubes/invoicing/index.ts"
import {
  connectionStatus, refreshExpiryWarning, type AnafEnvironment, type ConnectionStatus, type StoredConnectionStatus,
} from "../../cubes/invoicing/efactura/connection/index.ts"
import { bucharestDay, spvDeadline, spvNeedsAction, spvState, spvUrgency } from "../../cubes/invoicing/efactura/submissions/index.ts"
import type { RuntimeConfig } from "../config.ts"
import { createQueryRuntime } from "../storage/postgres-pool.ts"
import { type CommandContext, type CommandOf } from "./cli.ts"
import { isOrganizationId } from "./postgres-backup-manifest-fields.ts"
import { GuardRefusal } from "./postgres-backup-guards.ts"

/**
 * `doctor --efactura`: the e-Factura health of the configured organization, read
 * from the database alone (no ANAF call, nothing written). It names states, dates
 * and document numbers, never a token: the token columns are not even selected.
 */

/** At most this many document numbers per group; the count is always whole. */
export const LISTED_DOCUMENTS = 10

export type EFacturaProblem =
  | "efactura_not_configured" | "connection_disconnected" | "connection_needs_reconnect" | "refresh_expiring"
  | "submission_rejected" | "submission_refused" | "submission_unknown" | "deadline_overdue"

export interface DocumentGroup {
  readonly count: number
  readonly documents: ReadonlyArray<string>
}

export interface EFacturaDoctorReport {
  readonly organizationId: string
  /** Europe/Bucharest, the "today" the deadlines are measured against. */
  readonly today: string
  readonly connection: {
    readonly status: ConnectionStatus
    readonly environment: AnafEnvironment | null
    readonly refreshExpiresAt: string | null
    readonly refreshExpiryWarning: boolean
  }
  /** Issued documents not sent yet or still in progress: what needs a working connection. */
  readonly pendingDocuments: number
  readonly submissions: { readonly rejected: DocumentGroup; readonly refused: DocumentGroup; readonly unknown: DocumentGroup }
  /** Documents still to resolve (the register's set) past the operational deadline, or reaching it by the next working day. */
  readonly deadlines: { readonly overdue: DocumentGroup; readonly imminent: DocumentGroup }
  /** The one field the exit code is derived from: empty is exit 0. */
  readonly problems: ReadonlyArray<EFacturaProblem>
}

interface DocumentRow {
  readonly label: string
  readonly issueDate: string
  readonly supplyDate: string | undefined
  readonly status: EFacturaStatus
}

const statusOf = (value: unknown): EFacturaStatus => {
  const status = E_FACTURA_STATUSES.find((known) => known === value)
  if (status === undefined) throw new Error("invalid e_factura_status")
  return status
}

/** Every issued invoice and correction not accepted yet, oldest first. */
const unresolvedDocuments = async (client: PoolClient, organizationId: string): Promise<ReadonlyArray<DocumentRow>> => {
  const { rows } = await client.query<{ label: string; issue_date: string; supply_date: string | null; e_factura_status: string }>(
    `SELECT series || ' ' || number AS label, issue_date::text, supply_date::text, e_factura_status, number
      FROM issued_invoices WHERE organization_id=$1 AND e_factura_status<>'accepted'
    UNION ALL
    SELECT series || ' ' || number, issue_date::text, NULL, e_factura_status, number
      FROM correction_documents WHERE organization_id=$1 AND e_factura_status<>'accepted'
    ORDER BY issue_date, number, label`, [organizationId])
  return rows.map((row) => ({
    label: row.label, issueDate: row.issue_date, supplyDate: row.supply_date ?? undefined, status: statusOf(row.e_factura_status),
  }))
}

const storedConnection = async (client: PoolClient, organizationId: string) => {
  const { rows } = await client.query<{ environment: AnafEnvironment; status: StoredConnectionStatus; refresh_expires_at: string | null }>(
    "SELECT environment, status, refresh_expires_at FROM efactura_connections WHERE organization_id=$1", [organizationId])
  return rows[0]
}

const group = (rows: ReadonlyArray<DocumentRow>): DocumentGroup =>
  ({ count: rows.length, documents: rows.slice(0, LISTED_DOCUMENTS).map((row) => row.label) })

/** One read-only snapshot: the connection and the documents agree with each other. */
const snapshot = async (pool: Pool, organizationId: string) => {
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    const stored = await storedConnection(client, organizationId)
    const documents = await unresolvedDocuments(client, organizationId)
    await client.query("COMMIT")
    return { stored, documents }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export const efacturaDoctorReport = async (config: RuntimeConfig, pool: Pool, at: Date = new Date()): Promise<EFacturaDoctorReport> => {
  const organizationId = config.organizationId
  if (!isOrganizationId(organizationId)) throw new GuardRefusal("doctor --efactura requires ORGANIZATION_ID")
  const { stored, documents } = await snapshot(pool, organizationId)
  const today = bucharestDay(at)
  const configured = config.plugins.efactura && config.anaf?.client !== undefined
  const refreshExpiresAt = stored?.refresh_expires_at ?? null
  const status = connectionStatus(configured, stored === undefined ? undefined : {
    // Submissions only use a row of the configured environment: one from another needs a reconnect here.
    status: stored.environment === config.anaf?.environment ? stored.status : "needs_reconnect",
    refreshExpiresAt: refreshExpiresAt ?? undefined,
  }, at)
  const warning = refreshExpiresAt !== null && refreshExpiryWarning(refreshExpiresAt, at)

  const pending = documents.filter((row) => ["not_sent", "in_progress"].includes(spvState(row.status)))
  const unresolved = documents.filter((row) => spvNeedsAction(row.status))
  const urgency = (row: DocumentRow) => spvUrgency(spvDeadline(row.issueDate, row.supplyDate), today)
  const withStatus = (status: EFacturaStatus) => group(documents.filter((row) => row.status === status))
  const submissions = { rejected: withStatus("rejected"), refused: withStatus("refused"), unknown: withStatus("unknown") }
  const deadlines = {
    overdue: group(unresolved.filter((row) => urgency(row) === "overdue")),
    imminent: group(unresolved.filter((row) => urgency(row) === "imminent")),
  }

  const toSend = pending.length > 0
  const problems: ReadonlyArray<[EFacturaProblem, boolean]> = [
    ["efactura_not_configured", status === "not_configured" && toSend],
    ["connection_disconnected", status === "disconnected" && toSend],
    ["connection_needs_reconnect", status === "needs_reconnect"],
    ["refresh_expiring", status === "connected" && warning && toSend],
    ["submission_rejected", submissions.rejected.count > 0],
    ["submission_refused", submissions.refused.count > 0],
    ["submission_unknown", submissions.unknown.count > 0],
    ["deadline_overdue", deadlines.overdue.count > 0],
  ]
  return {
    organizationId,
    today,
    connection: { status, environment: config.anaf?.environment ?? null, refreshExpiresAt, refreshExpiryWarning: warning },
    pendingDocuments: pending.length,
    submissions,
    deadlines,
    problems: problems.filter(([, found]) => found).map(([code]) => code),
  }
}

export const runEFacturaDoctor = async (command: CommandOf<"doctor">, { config, settings }: CommandContext) => {
  const runtime = createQueryRuntime(settings)
  try {
    const report = await efacturaDoctorReport(config, runtime.pool)
    // Text mode prints the whole report: the default depth would hide the document numbers as `[Array]`.
    console.log(command.json ? JSON.stringify(report) : inspect(report, { depth: null }))
    if (report.problems.length > 0) process.exitCode = 1
  } finally {
    await runtime.close()
  }
}
