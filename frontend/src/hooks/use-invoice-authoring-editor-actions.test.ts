import assert from "node:assert/strict"
import test from "node:test"

import type { SetStateAction } from "react"

import { createInvoiceAuthoringEditorActions } from "./use-invoice-authoring-editor-actions.ts"
import { newAuthoringForm } from "../lib/document-authoring-transitions.ts"
import type { Customer, Issuer, ProductPreset, VatCatalogue } from "../lib/draft-models.ts"
import type { EditableInvoiceLine, InvoiceAuthoringForm } from "../lib/invoice-authoring-model.ts"

/**
 * The editor actions take the customer and the product the picker found, which
 * may be on no loaded page, instead of looking an id up in the first page.
 */
const unit = { code: "C62", name: "unitate" }
const catalogue: VatCatalogue = { rates: [{
  code: "RO_STANDARD", rate: "21.00", vatCategoryCode: "S", vatExemptionReason: null, kind: "standard",
  label: "TVA 21%", effectiveFrom: "2025-08-01",
}] }
const address = { countryCode: "RO", city: "B", street: "s", county: "RO-B", sector: 1 } as const
const issuer: Issuer = {
  organizationId: "org", name: "Beta", fiscalIdentifier: "321", address,
  legalForm: "srl", tradeRegistryNumber: "J40/1/2020", iban: "RO00XXXX0000000000", bankName: "Banca",
  socialCapital: "100.00", defaultCurrency: "RON", defaultPaymentTermDays: 14,
  vatConfigurations: [{ code: "RO_STANDARD", rate: "21.00", vatCategoryCode: "S", vatExemptionReason: null, effectiveFrom: "2024-01-01" }],
  currentVat: null, branding: null,
}
const customer = (id: string, defaultPaymentTermDays?: number): Customer => ({
  id, organizationId: "org", partyType: "company", name: `Client ${id}`, fiscalIdentifier: "123", vatRegistered: false, address,
  ...(defaultPaymentTermDays === undefined ? {} : { defaultPaymentTermDays }),
})
const firstPage = [customer("page-1")]
const preset: ProductPreset = {
  id: "preset-on-page-2", organizationId: "org", code: "P2", kind: "service", description: "Mentenanță",
  unitPrice: "250.00", unitOfMeasure: unit,
}

const editor = (chosenCustomer?: Customer) => {
  let form: InvoiceAuthoringForm = newAuthoringForm(issuer, "FCT", true, "2026-01-10")
  let lines: ReadonlyArray<EditableInvoiceLine> = []
  const remembered: Array<Customer> = []
  const actions = createInvoiceAuthoringEditorActions({
    issuer, vatCatalogue: catalogue, unitOfMeasures: [unit], customers: firstPage, chosenCustomer,
    rememberCustomer: (picked) => { remembered.push(picked) },
    vatDate: "2026-01-10", deriveDueDate: true,
    setForm: (next: SetStateAction<InvoiceAuthoringForm>) => { form = typeof next === "function" ? next(form) : next },
    setLines: (next: SetStateAction<ReadonlyArray<EditableInvoiceLine>>) => { lines = typeof next === "function" ? next(lines) : next },
  })
  return { actions, remembered, form: () => form, lines: () => lines }
}

void test("a customer found by search, on no loaded page, is chosen with its own payment term and remembered", () => {
  const found = customer("page-2", 30)
  const screen = editor()
  screen.actions.chooseCustomer(found)
  assert.equal(screen.form().customerId, "page-2")
  assert.equal(screen.form().dueDate, "2026-02-09")
  assert.deepEqual(screen.remembered, [found])
})

void test("a later issue date and a return to saved mode still read the remembered customer's term", () => {
  const found = customer("page-2", 30)
  const screen = editor(found)
  screen.actions.chooseCustomer(found)
  screen.actions.chooseIssueDate("2026-03-01")
  assert.equal(screen.form().dueDate, "2026-03-31")
  screen.actions.chooseBuyerMode("one-time")
  assert.equal(screen.form().dueDate, "2026-03-15")
  screen.actions.chooseBuyerMode("saved")
  assert.equal(screen.form().dueDate, "2026-03-31")
})

void test("a preset found by search fills the line it was picked for", () => {
  const screen = editor()
  const first = screen.actions.addLine()
  const second = screen.actions.addLine()
  screen.actions.choosePreset(second, preset)
  assert.deepEqual(screen.lines().map(({ key, description, unitPrice }) => ({ key, description, unitPrice })), [
    { key: first, description: "", unitPrice: "" },
    { key: second, description: "Mentenanță", unitPrice: "250.00" },
  ])
})

void test("adding a line returns the key the new line carries, for the focus to follow", () => {
  const screen = editor()
  const key = screen.actions.addLine()
  assert.deepEqual(screen.lines().map((line) => line.key), [key])
})
