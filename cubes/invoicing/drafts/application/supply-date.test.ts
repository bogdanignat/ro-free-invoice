import assert from "node:assert/strict"
import test from "node:test"

import { Effect } from "effect"

import { createInvoicingService } from "../../application/invoicing.ts"
import { brandingNormalizer, contextProvider, each, emptyState, fixedClock, identity, idempotent, memoryStore, sequentialIds } from "../../application/memory-store.test-support.ts"
import { ValidationFailure } from "../../contracts/index.ts"

const address = { countryCode: "RO", city: "Iași", street: "Strada 1", county: "RO-IS" }
const customer = { partyType: "individual", name: "Client", fiscalIdentifier: "", vatRegistered: false, address } as const
const line = { description: "Serviciu", quantity: "1", unitPrice: "100", unitOfMeasure: each, vatRateCode: "RO_STANDARD" }

const setup = async (vatFrom = "2025-01-01") => {
  const state = emptyState()
  const service = createInvoicingService({ context: contextProvider({ identity, organization: { id: "org-1" } }), clock: fixedClock,
    ids: sequentialIds(), store: memoryStore(state), branding: brandingNormalizer, cubeIdentity: "invoicing" })
  await Effect.runPromise(service.configureIssuer({ name: "Emitent SRL", fiscalIdentifier: "12345674", address, legalForm: "srl",
    tradeRegistryNumber: "J40/123/2020", socialCapital: "200.00", iban: "", bankName: "", defaultCurrency: "RON",
    defaultPaymentTermDays: 15, branding: null, vatChange: { registered: true, effectiveFrom: vatFrom } }))
  await Effect.runPromise(service.addDocumentSeries({ documentType: "invoice", series: "INV" }))
  await Effect.runPromise(service.addDocumentSeries({ documentType: "proforma", series: "PRO" }))
  const createDraft = (supplyDate?: string | null) => service.createDraft(idempotent({ customer, series: "INV", issueDate: "2025-08-05", dueDate: "2025-08-20",
    ...(supplyDate === undefined ? {} : { supplyDate }), lines: [line] }))
  return { state, service, createDraft }
}

const refusal = async (effect: Effect.Effect<unknown, unknown>) => {
  const failure = await Effect.runPromise(Effect.flip(effect))
  assert.ok(failure instanceof ValidationFailure)
  return failure
}

void test("the VAT follows the supply date on the draft and on its invoice", async () => {
  const { service, createDraft } = await setup()
  const supplied = await Effect.runPromise(createDraft("2025-07-20"))
  assert.equal(supplied.supplyDate, "2025-07-20")
  assert.equal(supplied.lines[0]?.vatRate, "19.00")
  const invoice = await Effect.runPromise(service.issueInvoice(idempotent({ draftId: supplied.id })))
  assert.equal(invoice.lines[0]?.vatRate, "19.00")
  assert.equal(invoice.supplyDate, "2025-07-20")
  assert.equal(invoice.issueDate, "2025-08-05")
  const plain = await Effect.runPromise(createDraft(null))
  assert.equal(plain.supplyDate, undefined)
  assert.equal(plain.lines[0]?.vatRate, "21.00")
  assert.equal((await Effect.runPromise(service.issueInvoice(idempotent({ draftId: plain.id })))).supplyDate, "2025-08-05")
})

void test("a supply after the issue date is refused on create, update and issue", async () => {
  const { state, service, createDraft } = await setup()
  const created = await refusal(createDraft("2025-08-06"))
  assert.deepEqual(created.details, [{ code: "supply_date_after_issue", field: "supplyDate" }])
  assert.equal((await refusal(createDraft("2025-02-30"))).details[0]?.field, "supplyDate")
  const draft = await Effect.runPromise(createDraft())
  const updated = await refusal(service.updateDraft({ draftId: draft.id, customer, issueDate: "2025-07-19", supplyDate: "2025-07-20" }))
  assert.equal(updated.details[0]?.code, "supply_date_after_issue")
  // Deliberate invalid store fixture: authoring never saves it, so issuance must still refuse it.
  state.drafts.set(draft.id, { ...draft, supplyDate: "2025-08-06" })
  const issued = await refusal(service.issueInvoice(idempotent({ draftId: draft.id })))
  assert.equal(issued.details[0]?.code, "supply_date_after_issue")
  assert.equal(state.issued.size, 0)
})

void test("an update keeps a given supply date, clears an absent one and recalculates the lines", async () => {
  const { service, createDraft } = await setup()
  const draft = await Effect.runPromise(createDraft())
  const kept = await Effect.runPromise(service.updateDraft({ draftId: draft.id, customer, issueDate: "2025-08-05", supplyDate: "2025-07-20" }))
  assert.equal(kept.supplyDate, "2025-07-20")
  assert.equal(kept.lines[0]?.vatRate, "19.00")
  const added = await Effect.runPromise(service.addDraftLine({ draftId: draft.id, ...line }))
  assert.equal(added.lines[1]?.vatRate, "19.00")
  const cleared = await Effect.runPromise(service.updateDraft({ draftId: draft.id, customer, issueDate: "2025-08-05" }))
  assert.equal(cleared.supplyDate, undefined)
  assert.deepEqual(cleared.lines.map((value) => value.vatRate), ["21.00", "21.00"])
})

void test("a VAT regime missing on the supply date is named with that date", async () => {
  const { createDraft } = await setup("2025-08-01")
  const failure = await refusal(createDraft("2025-07-20"))
  assert.deepEqual(failure.details, [{ code: "vat_registration_missing", params: { date: "2025-07-20" } }])
})

void test("a draft issued as a proforma ignores its supply date", async () => {
  const { service, createDraft } = await setup()
  const draft = await Effect.runPromise(createDraft("2025-07-20"))
  const failure = await refusal(service.issueProforma(idempotent({ draftId: draft.id, series: "PRO" })))
  assert.ok(failure.issues.includes("VAT pair RO_STANDARD/19.00 is not supported on 2025-08-05"))
})
