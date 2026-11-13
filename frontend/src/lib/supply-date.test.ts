import assert from "node:assert/strict"
import test from "node:test"

import { effectiveSupplyDate, issueDeadline, lateIssueWarning, invoiceSupplyDateIssue } from "./supply-date.ts"

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
