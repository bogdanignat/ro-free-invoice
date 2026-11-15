import assert from "node:assert/strict"
import test from "node:test"

import { Effect } from "effect"

import { createInvoicingService } from "../../application/invoicing.ts"
import { brandingNormalizer, contextProvider, each, emptyState, fixedClock, identity, idempotent, memoryStore, sequentialIds } from "../../application/memory-store.test-support.ts"
import { ResourceNotFound, ValidationFailure } from "../../contracts/index.ts"

const address = { countryCode: "RO", city: "Iași", street: "Strada 1", county: "RO-IS" }
const customer = { partyType: "individual", name: "Client", fiscalIdentifier: "", vatRegistered: false, address } as const
const issuer = { name: "Emitent SRL", fiscalIdentifier: "12345674", address, legalForm: "srl", tradeRegistryNumber: "J40/123/2020",
  socialCapital: "200.00", iban: "", bankName: "", defaultCurrency: "RON", defaultPaymentTermDays: 15, branding: null } as const
const lines = [
  { description: "Ore", quantity: "1.333", unitPrice: "33.33", unitOfMeasure: each, vatRateCode: "RO_STANDARD" },
  { description: "Carte", quantity: "3", unitPrice: "19.99", unitOfMeasure: each, vatRateCode: "RO_REDUCED" },
  { description: "Mai multe ore", quantity: "2", unitPrice: "10.01", unitOfMeasure: each, vatRateCode: "RO_STANDARD" },
]
const totalsOf = ({ totalExcludingVat, vatTotal, totalIncludingVat, vatBreakdown }: { readonly totalExcludingVat: string
  readonly vatTotal: string; readonly totalIncludingVat: string; readonly vatBreakdown: unknown }) => ({ totalExcludingVat, vatTotal, totalIncludingVat, vatBreakdown })

const setup = async (vatChange: object | null = { registered: true, effectiveFrom: "2025-01-01" }) => {
  const state = emptyState()
  const service = createInvoicingService({ context: contextProvider({ identity, organization: { id: "org-1" } }), clock: fixedClock,
    ids: sequentialIds(), store: memoryStore(state), branding: brandingNormalizer, cubeIdentity: "invoicing" })
  if (vatChange !== null) await Effect.runPromise(service.configureIssuer({ ...issuer, vatChange } as never))
  await Effect.runPromise(service.addDocumentSeries({ documentType: "invoice", series: "INV" }))
  return { state, service }
}

const refusal = async (effect: Effect.Effect<unknown, unknown>) => {
  const failure = await Effect.runPromise(Effect.flip(effect))
  assert.ok(failure instanceof ValidationFailure)
  return failure.details
}

void test("the preview gives the saved draft's totals for the same lines and writes nothing", async () => {
  const { state, service } = await setup()
  for (const supplyDate of [undefined, "2025-07-20"]) {
    const header = { issueDate: "2025-08-05", ...(supplyDate === undefined ? {} : { supplyDate }) }
    const drafts = state.drafts.size
    const preview = await Effect.runPromise(service.previewDraftTotals({ ...header, lines }))
    assert.equal(state.drafts.size, drafts)
    const saved = await Effect.runPromise(service.createDraft(idempotent({ customer, series: "INV", ...header, lines })))
    assert.deepEqual(totalsOf(preview), totalsOf(saved))
    assert.deepEqual(preview.lines, saved.lines.map(({ totalExcludingVat, vatAmount, totalIncludingVat }) => ({ totalExcludingVat, vatAmount, totalIncludingVat })))
  }
  const plain = await Effect.runPromise(service.previewDraftTotals({ issueDate: "2025-08-05", lines }))
  assert.deepEqual(plain.vatBreakdown.map(({ code, rate }) => [code, rate]), [["RO_STANDARD", "21.00"], ["RO_REDUCED", "11.00"]])
  const supplied = await Effect.runPromise(service.previewDraftTotals({ issueDate: "2025-08-05", supplyDate: "2025-07-20", lines }))
  assert.deepEqual(supplied.vatBreakdown.map(({ code, rate }) => [code, rate]), [["RO_STANDARD", "19.00"], ["RO_REDUCED", "9.00"]])
  assert.deepEqual(await Effect.runPromise(service.previewDraftTotals({ issueDate: "2025-08-05", lines: [] })),
    { lines: [], totalExcludingVat: "0.00", vatTotal: "0.00", totalIncludingVat: "0.00", vatBreakdown: [] })
})

void test("a non-VAT issuer previews RO_NON_VAT lines without VAT and refuses a VAT rate", async () => {
  const { service } = await setup({ registered: false, effectiveFrom: "2025-01-01", nonVatBasis: "article_310" })
  const preview = await Effect.runPromise(service.previewDraftTotals({ issueDate: "2025-08-05",
    lines: [{ quantity: "2", unitPrice: "50", vatRateCode: "RO_NON_VAT" }] }))
  assert.deepEqual(totalsOf(preview), { totalExcludingVat: "100.00", vatTotal: "0.00", totalIncludingVat: "100.00",
    vatBreakdown: [{ code: "RO_NON_VAT", rate: "0.00", vatCategoryCode: "O", vatExemptionReason: preview.vatBreakdown[0]?.vatExemptionReason,
      vatBaseAmount: "100.00", vatAmount: "0.00" }] })
  const details = await refusal(service.previewDraftTotals({ issueDate: "2025-08-05", lines: [{ quantity: "1", unitPrice: "1", vatRateCode: "RO_STANDARD" }] }))
  assert.equal(details[0]?.field, "vatRateCode")
})

void test("the preview refuses what saving refuses, by code and field", async () => {
  const { state, service } = await setup()
  const line = { quantity: "1", unitPrice: "100", vatRateCode: "RO_STANDARD" }
  const preview = (issueDate: string, value: object, supplyDate?: string) =>
    service.previewDraftTotals({ issueDate, ...(supplyDate === undefined ? {} : { supplyDate }), lines: [line, { ...line, ...value }] })
  assert.deepEqual(await refusal(preview("2025-08-05", { quantity: "abc" })), [{ code: "decimal_syntax", field: "quantity" }])
  assert.deepEqual(await refusal(preview("2025-08-05", { quantity: "0" })), [{ code: "quantity_zero", field: "quantity" }])
  assert.deepEqual(await refusal(preview("2025-08-05", { unitPrice: "1.001" })), [{ code: "decimal_places", field: "unitPrice", params: { scale: 2 } }])
  assert.deepEqual(await refusal(preview("2025-08-05", { vatRateCode: "NOPE" })),
    [{ code: "vat_configuration_unresolved", field: "vatRateCode", params: { code: "NOPE", date: "2025-08-05" } }])
  assert.deepEqual(await refusal(preview("2025-02-30", {})), [{ code: "date_invalid", field: "issueDate" }])
  assert.deepEqual(await refusal(preview("2025-08-05", {}, "2025-08-06")), [{ code: "supply_date_after_issue", field: "supplyDate" }])
  assert.equal(state.drafts.size, 0)
})

void test("the preview without a configured issuer is the save's missing issuer", async () => {
  const { service } = await setup(null)
  const failure = await Effect.runPromise(Effect.flip(service.previewDraftTotals({ issueDate: "2025-08-05", lines: [] })))
  assert.ok(failure instanceof ResourceNotFound)
  assert.equal(failure.resource, "issuer")
})
