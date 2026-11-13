import assert from "node:assert/strict"
import test from "node:test"

import type { Pool, PoolClient } from "pg"

import { dispatchRig } from "../efactura/dispatch/dispatch.test-support.ts"
import { customer, dueDate, issueDate, lines, ok } from "../http/plugins-http.test-support.ts"
import { applyMigrations, planMigrations } from "./migrations.ts"
import { sqlState } from "./postgres-errors.ts"
import { ledgerTable } from "./postgres-migrations.ts"
import { migrationScopes } from "./postgres-migration-plans.ts"
import { withEmpty, withMigrated } from "./postgres-rig.test-support.ts"

/**
 * An issued invoice, correction or proforma is complete once the writer seals
 * it, in the same transaction as its lines. A child row is accepted only while
 * its own transaction sees the parent unsealed: never on a sealed document, on
 * one still being issued by another transaction, or through a forged parent
 * found first on the search_path. A sealed invoice or storno cannot be unsealed.
 */
const issuedChildren = [
  { table: "issued_lines", parent: "issued_invoices", key: "invoice_id", identity: "id" },
  { table: "issued_tax_breakdown", parent: "issued_invoices", key: "invoice_id", identity: undefined },
  { table: "correction_lines", parent: "correction_documents", key: "correction_id", identity: "id" },
  { table: "correction_tax_breakdown", parent: "correction_documents", key: "correction_id", identity: undefined },
] as const
const children = [
  ...issuedChildren,
  { table: "proforma_lines", parent: "proformas", key: "proforma_id", identity: "id" },
  { table: "proforma_tax_breakdown", parent: "proformas", key: "proforma_id", identity: undefined },
] as const
type Child = typeof children[number]
type Client = Pick<PoolClient, "query">

const columnsOf = async (client: Client, table: string): Promise<ReadonlyArray<string>> => (await client.query<{ column_name: string }>(
  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER' ORDER BY ordinal_position",
  [table],
)).rows.map((row) => row.column_name)

/** A copy of a child row of `from`, filed under `to` at a free position: valid in every column but its parent. */
const lateInsert = async (client: Client, child: Child, from: string, to = from): Promise<void> => {
  const columns = await columnsOf(client, child.table)
  const select = columns.map((column) =>
    column === "line_position" ? "9999" : column === child.identity ? "'late'" : column === child.key ? "$2::text" : column).join(",")
  const failure = await client.query(
    `INSERT INTO ${child.table}(${columns.join(",")}) SELECT ${select} FROM ${child.table} WHERE ${child.key}=$1 LIMIT 1`, [from, to],
  ).then(() => undefined, (error: unknown) => error)
  assert.equal(sqlState(failure), "23514", `${child.table}: ${String(failure)}`)
  assert.match(String(failure), /sealed/u, child.table)
}

/** Another transaction is mid-issue: its header is written unsealed and not committed. */
const whilePending = async (pool: Pool, child: Child, from: string): Promise<void> => {
  const issuing = await pool.connect()
  const other = await pool.connect()
  try {
    await issuing.query("BEGIN")
    const columns = (await columnsOf(issuing, child.parent)).join(",")
    await issuing.query(`INSERT INTO ${child.parent}(${columns}) SELECT ${columns} FROM jsonb_populate_record(NULL::${child.parent},
      (SELECT to_jsonb(t) || jsonb_build_object('id','pending','number',t.number+1000,'draft_id',NULL::text,'source_draft_id',NULL::text,'sealed',0)
       FROM ${child.parent} t WHERE id=$1))`, [from])
    // Refused at once: the foreign key alone would wait for the issuing commit and then accept the row.
    await lateInsert(other, child, from, "pending")
  } finally {
    await issuing.query("ROLLBACK")
    issuing.release()
    other.release()
  }
}

/** An unsealed parent with the same id, and a format() that answers 0, both in a schema searched first. */
const throughForgedPath = async (pool: Pool, child: Child, from: string): Promise<void> => {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("CREATE SCHEMA forged")
    await client.query(`CREATE TABLE forged.${child.parent}(id TEXT PRIMARY KEY, sealed INTEGER NOT NULL)`)
    await client.query(`INSERT INTO forged.${child.parent} VALUES($1, 0)`, [from])
    await client.query("CREATE FUNCTION forged.format(text, name) RETURNS text LANGUAGE sql AS $$ SELECT 'SELECT 0' $$")
    await client.query("SET LOCAL search_path = forged, pg_catalog, public")
    await lateInsert(client, child, from)
  } finally {
    await client.query("ROLLBACK")
    client.release()
  }
}

void test("issued documents refuse late lines and VAT rows, mid-issue too, and cannot be unsealed", () =>
  withMigrated("fiscal_sealing", async (fixture) => {
    const rig = await dispatchRig(fixture)
    try {
      const invoiceId = await rig.invoice("inv-1")
      const proforma = await ok(rig.server.call("POST", "/api/proformas",
        { customer, proformaSeries: "PRO", issueDate, dueDate, currency: "RON", lines }, "proforma-1"), "proforma")
      const ids = { issued_invoices: invoiceId, correction_documents: await rig.storno(invoiceId, "storno-1"), proformas: String(proforma.id) }
      for (const table of ["issued_invoices", "correction_documents"] as const) {
        assert.equal(await fixture.sql.scalar(`SELECT sealed FROM ${table} WHERE id=$1`, [ids[table]]), 1, `${table} is sealed on issue`)
        const failure = await fixture.sql.rejects(`UPDATE ${table} SET sealed=0 WHERE id=$1`, [ids[table]])
        assert.equal(failure.code, "23514", table)
        assert.match(failure.message, /immutable/u, table)
      }
      for (const child of children) {
        await lateInsert(fixture.pool, child, ids[child.parent])
        await whilePending(fixture.pool, child, ids[child.parent])
        await throughForgedPath(fixture.pool, child, ids[child.parent])
      }
    } finally {
      await rig.close()
    }
  }))

const ledgerDefinition = `CREATE TABLE ${ledgerTable}(
  scope TEXT NOT NULL, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (scope, name))`

void test("upgrading a database written before the seal sealed its documents and refuses late rows", () =>
  withMigrated("fiscal_sealing_source", async (source) => {
    const rig = await dispatchRig(source)
    try {
      const invoiceId = await rig.invoice("inv-1")
      const stornoId = await rig.storno(invoiceId, "storno-1")
      await withEmpty("fiscal_sealing_upgrade", async (old) => {
        // The schema as it was shipped: everything up to the baseline, nothing after.
        const order = (await planMigrations(old.pool)).pending
        const through = order.indexOf("invoicing/invoicing-001-baseline")
        const bodies = new Map<string, { scope: string; name: string; statements: ReadonlyArray<string> }>(
          migrationScopes.flatMap(({ scope, migrations }) =>
            migrations.map(({ name, statements }) => [`${scope}/${name}`, { scope, name, statements }] as const)))
        await old.sql.exec(ledgerDefinition)
        for (const key of order.slice(0, through + 1)) {
          const migration = bodies.get(key)
          assert.ok(migration, `${key} is not in the migration order`)
          for (const statement of migration.statements) await old.sql.exec(statement)
          await old.sql.query(`INSERT INTO ${ledgerTable}(scope, name, applied_at) VALUES ($1, $2, now())`, [migration.scope, migration.name])
        }
        assert.equal(await old.sql.scalar("SELECT count(*) FROM information_schema.columns WHERE column_name='sealed' AND table_name IN('issued_invoices','correction_documents')"), "0")
        // Old-form rows: the same documents, copied column by column without `sealed`.
        const copy = async (table: string, key: string, id: string): Promise<void> => {
          const columns = await columnsOf(old.pool, table)
          const rows = await source.sql.query<{ row: Record<string, unknown> }>(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${key}=$1`, [id])
          assert.ok(rows.length > 0, table)
          for (const { row } of rows) {
            await old.sql.query(
              `INSERT INTO ${table}(${columns.join(",")}) SELECT ${columns.join(",")} FROM jsonb_populate_record(NULL::${table}, $1::jsonb)`,
              [JSON.stringify({ ...row, draft_id: null })],
            )
          }
        }
        await copy("issued_invoices", "id", invoiceId)
        await copy("issued_lines", "invoice_id", invoiceId)
        await copy("issued_tax_breakdown", "invoice_id", invoiceId)
        await copy("correction_documents", "id", stornoId)
        await copy("correction_lines", "correction_id", stornoId)
        await copy("correction_tax_breakdown", "correction_id", stornoId)

        await applyMigrations(old.pool)

        assert.equal(await old.sql.scalar("SELECT sealed FROM issued_invoices WHERE id=$1", [invoiceId]), 1)
        assert.equal(await old.sql.scalar("SELECT sealed FROM correction_documents WHERE id=$1", [stornoId]), 1)
        const ids = { issued_invoices: invoiceId, correction_documents: stornoId }
        for (const child of issuedChildren) await lateInsert(old.pool, child, ids[child.parent])
      })
    } finally {
      await rig.close()
    }
  }))
