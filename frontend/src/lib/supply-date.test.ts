import assert from "node:assert/strict"
import test from "node:test"

import { ApiFailure, parseApiFailure } from "./api-errors.ts"
import {
  effectiveSupplyDate, issueDeadline, lateIssueWarning, invoiceSupplyDateIssue, placeSupplyDateError, trackSupplyDateRefusal,
} from "./supply-date.ts"

void test("the VAT date is the supply date when given, the issue date when empty or absent", () => {
  assert.equal(effectiveSupplyDate({ issueDate: "2026-09-01", supplyDate: "2026-08-20" }), "2026-08-20")
  assert.equal(effectiveSupplyDate({ issueDate: "2026-09-01", supplyDate: "" }), "2026-09-01")
  assert.equal(effectiveSupplyDate({ issueDate: "2026-09-01" }), "2026-09-01")
})

void test("a supply after the issue is named on the field; the same day or earlier is not", () => {
  assert.equal(invoiceSupplyDateIssue({ issueDate: "2026-09-01", supplyDate: "2026-09-02" }), "Data livrării nu poate fi după data emiterii.")
  assert.equal(invoiceSupplyDateIssue({ issueDate: "2026-09-01", supplyDate: "2026-09-01" }), null)
  assert.equal(invoiceSupplyDateIssue({ issueDate: "2026-09-01", supplyDate: "" }), null)
})

void test("the deadline is the 15th of the next month, December rolling into January", () => {
  assert.equal(issueDeadline("2026-08-31"), "2026-09-15")
  assert.equal(issueDeadline("2026-12-03"), "2027-01-15")
})

void test("an issue after the 15th of the next month warns, the 15th itself does not", () => {
  assert.equal(lateIssueWarning({ issueDate: "2026-09-15", supplyDate: "2026-08-20" }), null)
  assert.equal(lateIssueWarning({ issueDate: "2026-09-16", supplyDate: "2026-08-20" }),
    "Factura trebuia emisă până pe 2026-09-15. Poți emite, dar termenul legal a trecut.")
  assert.match(lateIssueWarning({ issueDate: "2027-01-16", supplyDate: "2026-12-31" }) ?? "", /2027-01-15/u)
  assert.equal(lateIssueWarning({ issueDate: "2027-01-15", supplyDate: "2026-12-31" }), null)
})

void test("without a supply date, or with a date still being typed, nothing is late", () => {
  assert.equal(lateIssueWarning({ issueDate: "2026-09-16", supplyDate: "" }), null)
  assert.equal(lateIssueWarning({ issueDate: "", supplyDate: "2026-08-20" }), null)
})

const sent = { issueDate: "2026-09-01", supplyDate: "2026-09-05" }
const refusal = (code: string) => parseApiFailure({ error: "ValidationFailure", issues: ["x"], details: [{ code, field: "supplyDate" }] }, 400)
const placed = (error: unknown, issue: string | null, dates = sent) => placeSupplyDateError({ error, dates: sent }, issue, dates)

void test("the server's refusal of the supply date moves under the field; any other stays in the page alert", () => {
  assert.deepEqual(placed(refusal("supply_date_after_issue"), null),
    { error: null, supplyDateIssue: "Data livrării nu poate fi după data emiterii." })
  assert.match(placed(refusal("date_invalid"), null).supplyDateIssue ?? "", /data livrării/u)
  assert.equal(placed(refusal("supply_date_after_issue"), "local").supplyDateIssue, "local")
  const other = new ApiFailure({ message: "altceva", field: "issueDate" })
  assert.deepEqual(placed(other, null), { error: other, supplyDateIssue: null })
  assert.deepEqual(placed(null, null), { error: null, supplyDateIssue: null })
})

void test("the refusal under the field goes once the supply or the issue date changes", () => {
  const error = refusal("supply_date_after_issue")
  assert.deepEqual(placed(error, null, { ...sent, supplyDate: "2026-08-30" }), { error: null, supplyDateIssue: null })
  assert.deepEqual(placed(error, null, { ...sent, issueDate: "2026-09-10" }), { error: null, supplyDateIssue: null })
  assert.deepEqual(placed(error, null, { ...sent, supplyDate: "" }), { error: null, supplyDateIssue: null })
})

void test("a refusal keeps the dates it arrived with; a new failure takes the current ones", () => {
  const error = refusal("supply_date_after_issue")
  const first = trackSupplyDateRefusal({ error: null, dates: sent }, error, sent)
  assert.deepEqual(first, { error, dates: sent })
  const edited = { ...sent, supplyDate: "2026-08-30" }
  assert.equal(trackSupplyDateRefusal(first, error, edited), first)
  const again = refusal("supply_date_after_issue")
  assert.deepEqual(trackSupplyDateRefusal(first, again, edited), { error: again, dates: edited })
})
