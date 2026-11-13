import assert from "node:assert/strict"
import test from "node:test"

import { authoringDerived, savedDraftStaleLineIds } from "./invoice-authoring-derived.ts"
import { newAuthoringForm, selectIssueDate } from "./document-authoring-transitions.ts"
import { newEditableInvoiceLine } from "./invoice-authoring-model.ts"
import type { DraftInvoice, Issuer, VatCatalogue, VatRate } from "./draft-models.ts"

const unit = { code: "C62", name: "unitate" }

const standard = (rate: string, from: string, to?: string): VatRate => ({
  code: "RO_STANDARD", rate, vatCategoryCode: "S", vatExemptionReason: null, kind: "standard",
  label: `TVA ${rate}%`, effectiveFrom: from, ...(to === undefined ? {} : { effectiveTo: to }),
})

// The August 2025 change: 19% up to 31 July, 21% from 1 August.
const catalogue: VatCatalogue = { rates: [standard("19.00", "2024-01-01", "2025-07-31"), standard("21.00", "2025-08-01")] }

const issuer: Issuer = {
  organizationId: "org", name: "Beta", fiscalIdentifier: "321",
  address: { countryCode: "RO", city: "B", street: "s", county: "RO-B", sector: 1 },
  legalForm: "srl", tradeRegistryNumber: "J40/1/2020", iban: "RO00XXXX0000000000", bankName: "Banca",
  socialCapital: "100.00", defaultCurrency: "RON", defaultPaymentTermDays: 14,
  vatConfigurations: [{ code: "RO_STANDARD", rate: "21.00", vatCategoryCode: "S", vatExemptionReason: null, effectiveFrom: "2024-01-01" }],
  currentVat: null, branding: null,
}

const derivedFor = (supplyDate: string, issueDate = "2025-08-05") => authoringDerived({
  form: { ...newAuthoringForm(issuer, "FCT", false, issueDate), supplyDate },
  lines: [newEditableInvoiceLine("k1", "RO_STANDARD", unit)],
  draft: undefined, workflowPending: false, issuer, vatCatalogue: catalogue,
  staleLineIds: () => [], invoiceSeries: ["FCT"],
})

const savedLine = (vatRate: string): DraftInvoice["lines"][number] => ({
  id: `line-${vatRate}`, description: "Consultanță", quantity: "1", unitPrice: "100.00", unitOfMeasure: unit,
  vatRateCode: "RO_STANDARD", vatRate, vatCategoryCode: "S", vatExemptionReason: null,
  totalExcludingVat: "100.00", vatAmount: "0.00", totalIncludingVat: "100.00",
})

const draftOf = (supplyDate: string | undefined): DraftInvoice => ({
  id: "draft-1", organizationId: "org",
  customer: { partyType: "company", name: "Alfa", fiscalIdentifier: "123", vatRegistered: false,
    address: { countryCode: "RO", city: "B", street: "s", county: "RO-B", sector: 1 } },
  sourceProformaId: null, series: "FCT", issueDate: "2025-08-05", dueDate: null, currency: "RON",
  notes: null, status: "draft", lines: [savedLine("19.00"), savedLine("21.00")],
  vatBreakdown: [], totalExcludingVat: "200.00", vatTotal: "0.00", totalIncludingVat: "200.00",
  ...(supplyDate === undefined ? {} : { supplyDate }),
})

void test("a July supply invoiced in August takes the VAT date and the rates of the supply", () => {
  const supplied = derivedFor("2025-07-20")
  assert.equal(supplied.vatDate, "2025-07-20")
  assert.deepEqual(supplied.vatRates.map(({ rate }) => rate), ["19.00"])
  const plain = derivedFor("")
  assert.equal(plain.vatDate, "2025-08-05")
  assert.deepEqual(plain.vatRates.map(({ rate }) => rate), ["21.00"])
})

void test("a saved draft's stale lines are judged on its supply date, or its issue date without one", () => {
  assert.deepEqual(savedDraftStaleLineIds(draftOf("2025-07-20"), catalogue, issuer), ["line-21.00"])
  assert.deepEqual(savedDraftStaleLineIds(draftOf(undefined), catalogue, issuer), ["line-19.00"])
})

void test("an issue date moved before the supply keeps the supply date and holds back save and issue", () => {
  const form = { ...newAuthoringForm(issuer, "FCT", false, "2025-08-05"), supplyDate: "2025-08-01" }
  const moved = selectIssueDate(form, "2025-07-25", undefined, issuer, true)
  assert.equal(moved.supplyDate, "2025-08-01")
  const late = derivedFor(moved.supplyDate, moved.issueDate)
  assert.equal(late.supplyDateIssue, "Data livrării nu poate fi după data emiterii.")
  assert.equal(late.canSave, false)
  assert.equal(late.issuable, false)
  assert.equal(derivedFor("2025-08-01").canSave, true)
})
