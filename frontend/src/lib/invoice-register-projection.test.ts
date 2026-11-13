import assert from "node:assert/strict"
import test from "node:test"

import { correctionDetailHref, invoiceDetailHref, projectInvoiceRegisterRow } from "./invoice-register-projection.ts"
import type { InvoiceRegisterCorrectionRow, InvoiceRegisterInvoiceRow } from "./invoice-register.ts"
import type { SpvState, SpvUrgency } from "./spv-status.ts"

const invoice: InvoiceRegisterInvoiceRow = {
  kind: "invoice",
  id: "inv-1",
  series: "FCT",
  number: 12,
  issueDate: "2026-02-03",
  customer: { name: "Alfa SRL" },
  currency: "RON",
  totalIncludingVat: "1190.00",
  dueDate: "2026-03-05",
  eFacturaStatus: "accepted",
  spv: { state: "accepted", deadline: "2026-02-10", urgency: null },
}

const correction: InvoiceRegisterCorrectionRow = {
  kind: "correction",
  id: "cor-1",
  series: "STR",
  number: 4,
  issueDate: "2026-02-10",
  customer: { name: "Alfa SRL" },
  currency: "RON",
  totalIncludingVat: "-1190.00",
  dueDate: null,
  eFacturaStatus: null,
  spv: null,
  originalReference: { id: "inv-1", series: "FCT", number: 12 },
}

void test("an invoice projects to its own detail route", () => {
  const row = projectInvoiceRegisterRow(invoice)
  assert.equal(row.documentHref, "/invoices/inv-1")
  assert.equal(row.kindLabel, null)
  assert.equal(row.originalInvoice, null)
  assert.equal(row.number, "FCT 12")
  assert.equal(row.total, "1,190.00 RON")
  assert.equal(row.status, "Acceptată")
})

// A correction is a document of its own, not a second view of the invoice: its
// row links to `/corrections/{id}` and offers the original as a separate link.
void test("a correction projects to the correction route and names its original", () => {
  const row = projectInvoiceRegisterRow(correction)
  assert.equal(row.documentHref, "/corrections/cor-1")
  assert.equal(row.kindLabel, "Storno")
  assert.deepEqual(row.originalInvoice, { label: "Factura inițială FCT 12", href: "/invoices/inv-1" })
})

void test("a correction's negative total is shown as stored, not flipped", () => {
  assert.equal(projectInvoiceRegisterRow(correction).total, "-1,190.00 RON")
})

void test("a correction's due date, and its status with e-Factura off, read as a dash instead of blank", () => {
  const row = projectInvoiceRegisterRow(correction)
  assert.equal(row.dueDate, "—")
  assert.equal(row.status, "—")
})

void test("an invoice without a due date also reads as a dash", () => {
  assert.equal(projectInvoiceRegisterRow({ ...invoice, dueDate: null }).dueDate, "—")
})

const spvOf = (state: SpvState, urgency: SpvUrgency | null) => ({ state, deadline: "2026-02-10", urgency })

void test("each SPV group has a Romanian label and a tone; failed and unknown read in the danger tone", () => {
  const rows = (["not_sent", "in_progress", "accepted", "failed", "unknown"] as const)
    .map((state) => projectInvoiceRegisterRow({ ...invoice, spv: spvOf(state, null) }))
  assert.deepEqual(rows.map((row) => row.status), ["Netrimisă", "În curs", "Acceptată", "Respinsă", "Neclar"])
  assert.deepEqual(rows.map((row) => row.statusClass), ["badge muted", "badge info", "badge positive",
    "badge text-invoice-danger-text", "badge text-invoice-danger-text"])
})

void test("the deadline shows only while something is left to resolve, with a warning tone when overdue or imminent", () => {
  const note = (urgency: SpvUrgency | null) => projectInvoiceRegisterRow({ ...invoice, spv: spvOf("not_sent", urgency) }).deadline
  assert.equal(note(null), null)
  assert.deepEqual(note("ok"), { text: "Termen SPV: 2026-02-10", className: "text-invoice-muted" })
  assert.deepEqual(note("imminent"), { text: "Expiră SPV: 2026-02-10", className: "font-bold text-invoice-danger-text" })
  assert.deepEqual(note("overdue"), { text: "Termen depășit SPV: 2026-02-10", className: "font-bold text-invoice-danger-text" })
  assert.equal(projectInvoiceRegisterRow(correction).deadline, null)
})

void test("a correction shows its own SPV group", () => {
  assert.equal(projectInvoiceRegisterRow({ ...correction, spv: spvOf("failed", "overdue") }).status, "Respinsă")
})

// The two kinds are numbered independently, so an invoice and a correction can
// share an id; the row key has to carry the kind as well to stay unique.
void test("row keys stay distinct when the two kinds share an id", () => {
  assert.equal(projectInvoiceRegisterRow({ ...invoice, id: "same" }).key, "invoice:same")
  assert.equal(projectInvoiceRegisterRow({ ...correction, id: "same" }).key, "correction:same")
})

void test("an identifier that is not path-safe is encoded into the href", () => {
  assert.equal(invoiceDetailHref("a/b?c"), "/invoices/a%2Fb%3Fc")
  assert.equal(correctionDetailHref("a/b?c"), "/corrections/a%2Fb%3Fc")
})
