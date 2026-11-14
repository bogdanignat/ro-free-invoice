import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import test from "node:test"

import { Effect } from "effect"
import type { Pool } from "pg"

import { createInvoicingService, invoicingPermissions } from "../../cubes/invoicing/index.ts"
import { anafSettingsFor, CLIENT_SECRET } from "../efactura/anaf/connection.test-support.ts"
import { createPostgresStore } from "../storage/postgres-store.ts"
import { withMigrated, type TestFixture } from "../storage/postgres-rig.test-support.ts"
import { parseCommand } from "./cli.ts"
import { efacturaDoctorReport } from "./cli-doctor-efactura.ts"
import { GuardRefusal } from "./postgres-backup-guards.ts"

const AT = new Date("2026-10-20T10:00:00.000Z") // Tuesday; Bucharest "today" is 2026-10-20
const ACCESS_TOKEN = "v1.access-token-DO-NOT-LEAK"
const REFRESH_TOKEN = "v1.refresh-token-DO-NOT-LEAK"

const issuing = async (pool: Pool) => {
  let id = 0
  const service = createInvoicingService({
    context: { current: Effect.succeed({ identity: { id: "u", username: "u", roles: ["admin"], permissions: Object.values(invoicingPermissions("invoicing")) }, organization: { id: "org-1" } }) },
    clock: { now: Effect.succeed(AT) }, ids: { next: Effect.sync(() => `id-${String(++id).padStart(3, "0")}`) },
    store: createPostgresStore(pool), branding: { normalize: () => Effect.die("not expected") }, cubeIdentity: "invoicing",
  })
  await Effect.runPromise(service.configureIssuer({ name: "Exemplu SRL", fiscalIdentifier: "12345674",
    address: { countryCode: "RO", city: "Botoșani", street: "Strada 1", county: "RO-BT" }, legalForm: "srl",
    tradeRegistryNumber: "J22/123/2020", iban: "RO49AAAA1B31007593840000", bankName: "Banca", socialCapital: "1000.00",
    defaultCurrency: "RON", defaultPaymentTermDays: 15, vatChange: { registered: true, effectiveFrom: "2025-08-01" }, branding: null }))
  await Effect.runPromise(service.addDocumentSeries({ documentType: "invoice", series: "FCT" }))
  return {
    invoice: async (issueDate: string, status: string) => {
      const invoice = await Effect.runPromise(service.issueInvoice({ request: {
        customer: { partyType: "company" as const, name: "Client SRL", fiscalIdentifier: "87654329", vatRegistered: true,
          address: { countryCode: "RO", city: "Iași", street: "Strada 2", county: "RO-IS" } },
        series: "FCT", issueDate, dueDate: "2026-12-31", currency: "RON" as const,
        lines: [{ description: "Servicii", quantity: "1", unitPrice: "10", unitOfMeasure: { code: "C62", name: "unitate" }, vatRateCode: "RO_STANDARD" }] },
      idempotency: { key: `doctor-${String(++id)}`, fingerprint: `sha256:${"0".repeat(64)}` } }))
      // The column is what the submission transaction projects; set it as that transaction would.
      await pool.query("UPDATE issued_invoices SET e_factura_status=$1 WHERE id=$2", [status, invoice.id])
      return invoice.id
    },
    storno: async (originalInvoiceId: string, status: string) => {
      const correction = await Effect.runPromise(service.createCorrection({
        request: { originalInvoiceId, reason: "Storno", issueDate: "2026-10-19" },
        idempotency: { key: `doctor-${String(++id)}`, fingerprint: `sha256:${"0".repeat(64)}` } }))
      await pool.query("UPDATE correction_documents SET e_factura_status=$1 WHERE id=$2", [status, correction.id])
    },
  }
}

const connect = (pool: Pool, refreshExpiresAt: string) => pool.query(
  `INSERT INTO efactura_connections (organization_id, environment, status, generation, revision, access_token_ciphertext,
    refresh_token_ciphertext, access_expires_at, refresh_expires_at, verified_cif, connected_by, connected_at, updated_by, updated_at)
    VALUES ('org-1', 'test', 'connected', 1, 0, $1, $2, '2026-12-01T00:00:00.000Z', $3,
      '12345674', 'user-1', '2026-10-01T00:00:00.000Z', 'user-1', '2026-10-01T00:00:00.000Z')`,
  [ACCESS_TOKEN, REFRESH_TOKEN, refreshExpiresAt])

const cli = (fixture: TestFixture, command: ReadonlyArray<string>, organizationId = "org-1") => spawnSync(
  process.execPath, [join(process.cwd(), "bin", "ro-free-invoice.ts"), ...command],
  { encoding: "utf8", env: fixture.childEnv({ ORGANIZATION_ID: organizationId, ANAF_CLIENT_ID: "", ANAF_REDIRECT_URI: "", ANAF_CLIENT_SECRET_FILE: "", ANAF_TOKEN_KEY_FILE: "" }) },
)

const assertNoSecret = (output: string) => {
  for (const secret of [ACCESS_TOKEN, REFRESH_TOKEN, CLIENT_SECRET]) assert.ok(!output.includes(secret), "a token or secret reached the output")
}

void test("doctor parses --efactura apart from plain doctor, and refuses an unknown option", () => {
  assert.deepEqual(parseCommand(["doctor"]), { name: "doctor", json: false, efactura: false })
  assert.deepEqual(parseCommand(["doctor", "--efactura", "--json"]), { name: "doctor", json: true, efactura: true })
  assert.throws(() => parseCommand(["doctor", "--efactur"]), /Unknown option/u)
})

void test("doctor --efactura on the CLI: exit 0 with no problem, 1 with one, never a token; plain doctor and help unchanged", async () => {
  await withMigrated("doctor_efactura_cli", async (fixture) => {
    const help = cli(fixture, ["help"])
    assert.match(help.stdout, /doctor --efactura/u)

    const plain = cli(fixture, ["doctor", "--json"])
    assert.equal(plain.status, 0, plain.stderr)
    const readiness = JSON.parse(plain.stdout) as Record<string, unknown>
    assert.equal(readiness.ready, true)
    assert.equal("problems" in readiness, false, "plain doctor keeps its own report")

    const clean = cli(fixture, ["doctor", "--efactura", "--json"])
    assert.equal(clean.status, 0, clean.stderr)
    const cleanReport = JSON.parse(clean.stdout) as { connection: { status: string }; problems: ReadonlyArray<string> }
    assert.equal(cleanReport.connection.status, "not_configured")
    assert.deepEqual(cleanReport.problems, [], "not configured and nothing to send is no problem")

    await connect(fixture.pool, "2027-10-01T00:00:00.000Z")
    const documents = await issuing(fixture.pool)
    await documents.invoice("2026-01-05", "rejected") // long past its deadline whatever today is
    const failed = cli(fixture, ["doctor", "--efactura", "--json"])
    assert.equal(failed.status, 1, failed.stderr)
    const failedReport = JSON.parse(failed.stdout) as { submissions: { rejected: unknown }; problems: ReadonlyArray<string> }
    assert.deepEqual(failedReport.problems, ["submission_rejected", "deadline_overdue"], "a rejected document is still the register's to resolve")
    assert.deepEqual(failedReport.submissions.rejected, { count: 1, documents: ["FCT 1"] })
    assertNoSecret(failed.stdout + failed.stderr)

    await documents.invoice("2026-01-06", "not_sent")
    const unsent = cli(fixture, ["doctor", "--efactura", "--json"])
    assert.equal(unsent.status, 1, unsent.stderr)
    assert.deepEqual((JSON.parse(unsent.stdout) as { problems: ReadonlyArray<string> }).problems,
      ["efactura_not_configured", "submission_rejected", "deadline_overdue"], "not configured is a problem once a document waits")

    const text = cli(fixture, ["doctor", "--efactura"])
    assert.equal(text.status, 1, text.stderr)
    assert.match(text.stdout, /'FCT 1'/u)
    assert.match(text.stdout, /'FCT 2'/u)
    assert.doesNotMatch(text.stdout, /\[Array\]|\[Object\]/u, "text mode shows the whole report")
    assertNoSecret(text.stdout + text.stderr)

    const noOrganization = cli(fixture, ["doctor", "--efactura", "--json"], "")
    assert.equal(noOrganization.status, 2, noOrganization.stderr)
  })
})

void test("doctor --efactura reports the connection, failed submissions and the deadline, and derives problems from them", async () => {
  await withMigrated("doctor_efactura", async (fixture) => {
    const config = fixture.config({ anaf: anafSettingsFor() })
    const report = () => efacturaDoctorReport(config, fixture.pool, AT)
    const documents = await issuing(fixture.pool)
    // Issued in date order, as numbering requires; each one's state is set as the test goes.
    const overdue = await documents.invoice("2026-10-01", "accepted") // deadline 2026-10-08
    const imminent = await documents.invoice("2026-10-14", "accepted") // deadline 2026-10-21, the next working day
    const recent = await documents.invoice("2026-10-19", "accepted") // deadline 2026-10-26
    const mark = (id: string, status: string) => fixture.pool.query("UPDATE issued_invoices SET e_factura_status=$1 WHERE id=$2", [status, id])

    assert.deepEqual((await report()).problems, [], "disconnected with nothing to send")
    await mark(recent, "not_sent")
    assert.deepEqual((await report()).problems, ["connection_disconnected"])

    await connect(fixture.pool, "2027-10-01T00:00:00.000Z")
    const connected = await report()
    assert.deepEqual(connected.problems, [])
    assert.deepEqual(connected.connection, { status: "connected", environment: "test", refreshExpiresAt: "2027-10-01T00:00:00.000Z", refreshExpiryWarning: false })
    assert.equal(connected.pendingDocuments, 1)
    assertNoSecret(JSON.stringify(connected))

    await fixture.pool.query("UPDATE efactura_connections SET refresh_expires_at='2026-11-01T00:00:00.000Z'")
    const expiring = await report()
    assert.equal(expiring.connection.refreshExpiryWarning, true)
    assert.deepEqual(expiring.problems, ["refresh_expiring"])

    await fixture.pool.query("UPDATE efactura_connections SET refresh_expires_at='2026-10-19T00:00:00.000Z'")
    assert.deepEqual((await report()).problems, ["connection_needs_reconnect"], "a lapsed refresh token needs the certificate")
    await fixture.pool.query(`UPDATE efactura_connections SET status='needs_reconnect', access_token_ciphertext=NULL,
      refresh_token_ciphertext=NULL, access_expires_at=NULL, refresh_expires_at='2027-10-01T00:00:00.000Z'`)
    assert.deepEqual((await report()).problems, ["connection_needs_reconnect"])
    await fixture.pool.query(`UPDATE efactura_connections SET status='connected', access_token_ciphertext=$1,
      refresh_token_ciphertext=$2, access_expires_at='2026-12-01T00:00:00.000Z' WHERE organization_id='org-1'`, [ACCESS_TOKEN, REFRESH_TOKEN])

    await fixture.pool.query("UPDATE efactura_connections SET environment='prod'")
    assert.deepEqual((await report()).problems, ["connection_needs_reconnect"], "submissions do not use a connection of another environment")
    await fixture.pool.query("UPDATE efactura_connections SET environment='test'")

    await mark(overdue, "queued")
    const inFlight = await report()
    assert.deepEqual(inFlight.problems, [], "the register gives no urgency to a submission in progress")
    assert.equal(inFlight.deadlines.overdue.count, 0)
    assert.equal(inFlight.pendingDocuments, 2)

    await mark(overdue, "not_sent")
    await mark(imminent, "refused") // imminent is reported, not a problem
    await documents.storno(recent, "unknown")
    const troubled = await report()
    assert.deepEqual(troubled.problems, ["submission_refused", "submission_unknown", "deadline_overdue"])
    assert.deepEqual(troubled.deadlines, { overdue: { count: 1, documents: ["FCT 1"] }, imminent: { count: 1, documents: ["FCT 2"] } })
    assert.deepEqual(troubled.submissions.refused, { count: 1, documents: ["FCT 2"] })
    assert.equal(troubled.submissions.unknown.count, 1)
    assert.equal(troubled.pendingDocuments, 2)
    assertNoSecret(JSON.stringify(troubled))
  })
})

void test("doctor --efactura refuses without ORGANIZATION_ID", async () => {
  await withMigrated("doctor_efactura_org", async (fixture) => {
    await assert.rejects(efacturaDoctorReport(fixture.config({ organizationId: undefined }), fixture.pool, AT), GuardRefusal)
  })
})
