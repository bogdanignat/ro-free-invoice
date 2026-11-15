import assert from "node:assert/strict"
import test from "node:test"

import { cube } from "./index.ts"
import { invoicingMigrations } from "./contracts/index.ts"

void test("declares invoicing as the required parent cube with its tables and migrations", () => {
  assert.equal(cube.manifest.name, "invoicing")
  assert.equal(cube.manifest.required, true)
  assert.deepEqual(cube.manifest.tables, [
    "document_series",
    "invoice_drafts",
    "draft_lines",
    "invoice_sequences",
    "issued_invoices",
    "issued_lines",
    "issued_tax_breakdown",
    "proformas",
    "proforma_lines",
    "proforma_tax_breakdown",
    "proforma_conversions",
    "proforma_invoice_conversions",
    "correction_documents",
    "correction_lines",
    "correction_tax_breakdown",
    "idempotency_records",
    "audit_events",
  ])
  assert.deepEqual(invoicingMigrations.map(({ name }) => name), ["invoicing-001-baseline", "invoicing-002-seal-issued-documents", "invoicing-003-supply-date"])
})
