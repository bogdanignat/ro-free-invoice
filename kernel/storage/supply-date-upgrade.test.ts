import assert from "node:assert/strict"
import test from "node:test"

import type { Pool, PoolClient } from "pg"

import type { SchemaMigration } from "./postgres-foundation.ts"
import { migrationScopes } from "./postgres-migration-plans.ts"
import { applyMigrations } from "./postgres-migrations.ts"
import { freshRuntime, type TestRuntime } from "./postgres-rig.test-support.ts"
import { resetFingerprintCache, schemaDrift } from "./postgres-schema-fingerprint.ts"
import { introspectSchema } from "./postgres-schema-introspection.ts"

/**
 * T-2679: `invoicing-003-supply-date` on a database issued under 001 and 002.
 * The test builds that database by holding the migration back (the array is
 * the one the executor reads, and `node --test` gives this file its own
 * process), writes the documents with the SQL the 002 writers send, then lets
 * `migrate` apply 003 alone.
 */

const party = {
  organization_id: "org-u", fiscal_year: 2026, currency: "RON", actor_id: "operator",
  issuer_legal_name: "Furnizor SRL", issuer_tax_identifier: "12345674", issuer_country_code: "RO", issuer_city: "Iasi",
  issuer_street: "Strada 1", issuer_county: "RO-IS", issuer_legal_form: "srl", issuer_trade_registry_number: "J22/123/2020",
  issuer_iban: "RO49", issuer_bank_name: "Banca", issuer_social_capital: 100000, issuer_vat_registered: 1,
  customer_party_type: "company", customer_legal_name: "Client SRL", customer_tax_identifier: "87654329",
  customer_country_code: "RO", customer_city: "Iasi", customer_street: "Strada 2", customer_county: "RO-IS",
  customer_vat_registered: 1,
}
const totals = (sign: number) => ({ total_excluding_tax: sign * 10000, tax_total: sign * 2100, total_including_tax: sign * 12100 })
const line = (sign: number) => ({ line_position: 1, description: "Servicii", quantity: sign < 0 ? "-1.0000" : "1.0000",
  unit_price: 10000, tax_code: "RO_STANDARD", tax_category: "S", tax_rate: "21.00", vat_exemption_reason: null,
  total_excluding_tax: sign * 10000, tax_amount: sign * 2100, total_including_tax: sign * 12100, unit_code: "C62", unit_name: "unitate" })
const breakdown = (sign: number) => ({ line_position: 1, tax_code: "RO_STANDARD", category: "S", rate: "21.00",
  vat_exemption_reason: null, taxable_amount: sign * 10000, tax_amount: sign * 2100 })
const invoice = (id: string, number: number, proformaId: string | null, extra: Record<string, unknown> = {}) => ({ ...party,
  ...totals(1), id, draft_id: null, source_proforma_id: proformaId, document_type: "invoice", series: "INV", number,
  issue_date: "2026-09-01", issued_at: "2026-09-01T10:00:00.000Z", sealed: 0, ...extra })

const lineColumns = ["id", "invoice_id", ...Object.keys(line(1))].join(",")
const breakdownColumns = Object.keys(breakdown(1)).join(",")

const insert = async (client: Pick<PoolClient, "query">, table: string, row: Record<string, unknown>): Promise<void> => {
  const columns = Object.keys(row)
  await client.query(`INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map((_, index) => `$${String(index + 1)}`).join(",")})`,
    Object.values(row))
}

/** A sealed invoice with its line, a sealed storno of it, an open draft and a proforma converted straight to an invoice. */
const seed = async (pool: Pool): Promise<void> => {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("INSERT INTO document_series VALUES('org-u','invoice','INV'),('org-u','proforma','PRO')")
    await insert(client, "invoice_drafts", { id: "draft-1", organization_id: "org-u", customer_party_type: "company",
      customer_legal_name: "Client SRL", customer_tax_identifier: "87654329", customer_country_code: "RO", customer_city: "Iasi",
      customer_street: "Strada 2", customer_county: "RO-IS", customer_vat_registered: 1, series: "INV", issue_date: "2026-09-01",
      currency: "RON", status: "draft" })
    await insert(client, "issued_invoices", invoice("inv-1", 1, null))
    await insert(client, "issued_lines", { id: "il-1", invoice_id: "inv-1", ...line(1) })
    await insert(client, "issued_tax_breakdown", { invoice_id: "inv-1", ...breakdown(1) })
    await insert(client, "correction_documents", { ...party, ...totals(-1), id: "corr-1", original_invoice_id: "inv-1",
      document_type: "correction", series: "INV", number: 2, issue_date: "2026-09-02", issued_at: "2026-09-02T10:00:00.000Z",
      reason: "Eroare", sealed: 0 })
    await insert(client, "correction_lines", { id: "cl-1", correction_id: "corr-1", ...line(-1) })
    await insert(client, "correction_tax_breakdown", { correction_id: "corr-1", ...breakdown(-1) })
    await insert(client, "proformas", { ...party, ...totals(1), id: "pf-1", document_type: "proforma", series: "PRO", number: 1,
      issue_date: "2026-08-20", issued_at: "2026-08-20T10:00:00.000Z", sealed: 0 })
    await client.query("UPDATE proformas SET sealed=1 WHERE id='pf-1'")
    // The deferred lineage key: the invoice names its conversion row before that row exists.
    await insert(client, "issued_invoices", invoice("inv-2", 3, "pf-1", { issue_date: "2026-09-03", issued_at: "2026-09-03T10:00:00.000Z" }))
    await insert(client, "proforma_invoice_conversions", { proforma_id: "pf-1", organization_id: "org-u",
      resulting_invoice_id: "inv-2", actor_id: "operator", converted_at: "2026-09-03T10:00:00.000Z" })
    await client.query("UPDATE issued_invoices SET sealed=1 WHERE sealed=0")
    await client.query("UPDATE correction_documents SET sealed=1 WHERE sealed=0")
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

const rejection = (pool: Pool, sql: string): Promise<{ readonly code?: string, readonly constraint?: string, readonly message: string }> =>
  pool.query(sql).then(() => assert.fail(`accepted: ${sql}`), (error: unknown) => error as { code?: string, constraint?: string, message: string })

void test("003 backfills the supply date of every issued invoice and keeps them immutable and sealed", async () => {
  const invoicing = migrationScopes.find(({ scope }) => scope === "invoicing")
  assert.ok(invoicing !== undefined, "the invoicing scope exists")
  const migrations = invoicing.migrations as Array<SchemaMigration>
  const supplyDate = migrations.pop()
  assert.ok(supplyDate?.name === "invoicing-003-supply-date", "003 is the last invoicing migration")
  resetFingerprintCache()
  let upgraded: TestRuntime | undefined
  let installed: TestRuntime | undefined
  try {
    try {
      upgraded = await freshRuntime("supply_upgrade")
      await seed(upgraded.pool)
    } finally {
      migrations.push(supplyDate)
      resetFingerprintCache()
    }
    const { pool } = upgraded
    assert.equal((await applyMigrations(pool)).changed, 1)
    assert.deepEqual((await pool.query("SELECT id, supply_date FROM issued_invoices ORDER BY id")).rows,
      [{ id: "inv-1", supply_date: "2026-09-01" }, { id: "inv-2", supply_date: "2026-09-03" }])
    assert.equal((await pool.query<{ supply_date: string | null }>("SELECT supply_date FROM invoice_drafts WHERE id='draft-1'")).rows[0]?.supply_date, null)

    const changed = await rejection(pool, "UPDATE issued_invoices SET supply_date='2026-08-01' WHERE id='inv-1'")
    assert.match(changed.message, /issued invoices are immutable except e_factura_status/u)
    const unsealed = await rejection(pool, "UPDATE issued_invoices SET sealed=0 WHERE id='inv-2'")
    assert.match(unsealed.message, /issued invoices are immutable/u)
    const lateLineValues = lineColumns.replace("id,", "'il-late',").replace("line_position", "9")
    const lateLine = await rejection(pool, `INSERT INTO issued_lines(${lineColumns}) SELECT ${lateLineValues} FROM issued_lines WHERE id='il-1'`)
    assert.match(lateLine.message, /issued invoice lines are sealed/u)
    const lateStorno = await rejection(pool, `INSERT INTO correction_tax_breakdown(correction_id,${breakdownColumns})
      SELECT correction_id,${breakdownColumns.replace("line_position", "9")} FROM correction_tax_breakdown WHERE correction_id='corr-1'`)
    assert.match(lateStorno.message, /correction tax breakdown is sealed/u)
    const lateDraft = await rejection(pool, "UPDATE invoice_drafts SET supply_date='2026-09-02' WHERE id='draft-1'")
    assert.deepEqual([lateDraft.code, lateDraft.constraint], ["23514", "invoice_drafts_supply_date_not_after_issue"])

    assert.equal((await applyMigrations(pool)).changed, 0)
    assert.deepEqual(await schemaDrift(pool), [])
    installed = await freshRuntime("supply_install")
    assert.deepEqual(await introspectSchema(installed.pool, "public"), await introspectSchema(pool, "public"),
      "a new install and an upgraded database have the same schema")
  } finally {
    for (const runtime of [upgraded, installed]) await runtime?.close()
  }
})
