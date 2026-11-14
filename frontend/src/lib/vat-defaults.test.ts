import assert from "node:assert/strict"
import test from "node:test"

import { canonicalVatTreatment } from "./draft-decoders.ts"
import { periodOn, presetVatCode, sameVatRate } from "./vat-defaults.ts"
import { vatPeriod } from "./vat-periods.test-support.ts"
import type { VatRate } from "./draft-models.ts"

const ARTICLE_310 = "Regim special de scutire conform art. 310 din Codul fiscal"

void test("two rates are the same by value: trimmed, at most three integer digits and two decimals", () => {
  for (const [left, right] of [["21", "21.00"], [" 21 ", "21.0"], ["021", "21"], ["0", "0.00"], ["100", "100.00"], ["999.99", "999.99"]] as const) {
    assert.equal(sameVatRate(left, right), true, `${left} = ${right}`)
  }
  for (const [left, right] of [["21", "21.01"], ["1000", "1000"], ["0021", "21"], ["21.001", "21.001"], ["-21", "-21"], ["abc", "abc"],
    ["", ""], ["+21", "21"], ["2e1", "20"], [".5", "0.5"], ["21.", "21"]] as const) {
    assert.equal(sameVatRate(left, right), false, `${left} ≠ ${right}`)
  }
})

const rate = (code: string, value: string, kind: VatRate["kind"]): VatRate => ({
  code, rate: value, vatCategoryCode: kind === "non_vat" ? "O" : "S",
  vatExemptionReason: kind === "non_vat" ? ARTICLE_310 : null, kind, label: code, effectiveFrom: "2025-08-01",
})
const standard = rate("RO_STANDARD", "21.00", "standard")
const reduced = rate("RO_REDUCED", "11.00", "reduced")
const nonVat = rate("RO_NON_VAT", "0.00", "non_vat")

void test("the period on a date is the one whose interval holds it, both ends included", () => {
  const first = vatPeriod("2026-01-01", "2026-06-30", true, [standard])
  const middle = vatPeriod("2026-07-01", "2026-07-31", false, [nonVat])
  const open = vatPeriod("2026-09-01", undefined, true, [standard, reduced])
  const periods = [first, middle, open]
  assert.equal(periodOn(periods, "2026-01-01"), first)
  assert.equal(periodOn(periods, "2026-06-30"), first)
  assert.equal(periodOn(periods, "2026-07-15"), middle)
  assert.equal(periodOn(periods, "2026-08-15"), undefined)
  assert.equal(periodOn(periods, "2025-12-31"), undefined)
  assert.equal(periodOn(periods, "2026-09-01"), open)
  assert.equal(periodOn(periods, "2099-12-31"), open)
  assert.equal(periodOn([], "2026-01-01"), undefined)
})

void test("a product's preferred rate is kept only when the period offers it as a taxable rate", () => {
  const registered = vatPeriod("2026-01-01", undefined, true, [standard, reduced])
  assert.equal(presetVatCode("RO_REDUCED", registered), "RO_REDUCED")
  assert.equal(presetVatCode("RO_SUPER_REDUCED", registered), "RO_STANDARD")
  assert.equal(presetVatCode(undefined, registered), "RO_STANDARD")
  const exempt = vatPeriod("2026-01-01", undefined, false, [nonVat])
  assert.equal(presetVatCode("RO_NON_VAT", exempt), "RO_NON_VAT")
  assert.equal(presetVatCode("RO_REDUCED", exempt), "RO_NON_VAT")
  assert.equal(presetVatCode("RO_STANDARD", vatPeriod("2026-01-01", undefined, null)), "")
  assert.equal(presetVatCode("RO_STANDARD", undefined), "")
})

void test("the decoder admits a rate by the backend's grammar and range only", () => {
  const taxedOk = (rate: string) => { canonicalVatTreatment("RO_STANDARD", rate, "S", null) }
  for (const rate of ["0.01", "1", "21", "21.00", "99.99", "100", "100.00"]) assert.doesNotThrow(() => { taxedOk(rate) }, rate)
  for (const rate of ["100.01", "101", "021", "21.000", " 21", "+21", "-21", "1e1", ".5", "21.", ""]) {
    assert.throws(() => { taxedOk(rate) }, /^Error: invalid rate$/u, rate)
  }
  for (const rate of ["0", "0.00"]) assert.throws(() => { taxedOk(rate) }, /^Error: invalid VAT treatment$/u, rate)
  for (const rate of ["0", "0.0", "0.00"]) {
    assert.doesNotThrow(() => { canonicalVatTreatment("RO_NON_VAT", rate, "O", ARTICLE_310) }, rate)
  }
  assert.throws(() => { canonicalVatTreatment("RO_NON_VAT", "0.01", "O", ARTICLE_310) }, /^Error: invalid VAT treatment$/u)
})
