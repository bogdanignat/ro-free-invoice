import assert from "node:assert/strict"
import test from "node:test"

import type { InvoiceRegisterRow } from "../../cubes/invoicing/index.ts"
import { eFacturaStatusView } from "./efactura-status.ts"

const row = (eFacturaStatus: InvoiceRegisterRow["eFacturaStatus"], issueDate = "2026-01-05"): InvoiceRegisterRow => ({
  kind: "invoice", id: eFacturaStatus, series: "T", number: 1, issueDate, customer: { name: "C" }, currency: "RON",
  totalIncludingVat: "1.00", dueDate: null, eFacturaStatus,
})
const page = { items: [row("not_sent"), row("queued"), row("accepted"), row("rejected"), row("refused"), row("unknown")], nextCursor: null }
const spvOf = (today: string) => eFacturaStatusView(true, () => new Date(`${today}T10:00:00Z`)).register(page).items.map((item) => item.spv)

void test("the register view adds the SPV group, deadline and urgency; urgency only for what is left to resolve", () => {
  const spv = spvOf("2026-01-12")
  assert.deepEqual(spv.map((item) => item?.state), ["not_sent", "in_progress", "accepted", "failed", "failed", "unknown"])
  assert.deepEqual(spv.map((item) => item?.deadline), Array<string>(6).fill("2026-01-12"))
  assert.deepEqual(spv.map((item) => item?.urgency), ["imminent", null, null, "imminent", "imminent", "imminent"])
  assert.equal(spvOf("2026-01-13")[0]?.urgency, "overdue")
  assert.equal(spvOf("2026-01-08")[0]?.urgency, "ok")
})

void test("the day is Bucharest's: 23:30 UTC on 2026-01-12 is already the 13th there", () => {
  const view = eFacturaStatusView(true, () => new Date("2026-01-12T23:30:00Z"))
  assert.equal(view.register({ items: [row("not_sent")], nextCursor: null }).items[0]?.spv?.urgency, "overdue")
})

void test("with the plugin off the register carries no e-Factura status and no SPV group", () => {
  const items = eFacturaStatusView(false).register(page).items
  assert.ok(items.every((item) => item.eFacturaStatus === null && item.spv === null))
})
