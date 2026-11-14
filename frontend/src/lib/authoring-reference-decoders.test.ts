import assert from "node:assert/strict"
import test from "node:test"

import { decodeIssuer, decodeReferenceData } from "./authoring-reference-decoders.ts"

const textLimits = { partyName: 200, street: 150, city: 50, postalCode: 20, lineDescription: 100, documentNotes: 300 }
const answer = { counties: [{ code: "RO-B", name: "București" }], textLimits }

void test("the reference data decodes as the server answers it", () => {
  assert.deepEqual(decodeReferenceData(answer), answer)
})

// A limit the decoder let through wrong would leave a field without its cap, silently.
void test("a missing, fractional or non-positive limit, or a malformed county, is refused", () => {
  for (const limit of [undefined, "200", 1.5, 0, -1]) {
    assert.throws(() => decodeReferenceData({ ...answer, textLimits: { ...textLimits, city: limit } }), /invalid city/u)
  }
  assert.throws(() => decodeReferenceData({ ...answer, textLimits: undefined }))
  assert.throws(() => decodeReferenceData({ ...answer, counties: [{ code: "RO-B" }] }), /invalid name/u)
  assert.throws(() => decodeReferenceData({ textLimits }))
})

const standard = {
  code: "RO_STANDARD", rate: "21.00", vatCategoryCode: "S", vatExemptionReason: null,
  kind: "standard", label: "TVA standard 21%", effectiveFrom: "2025-08-01",
}
const period = { effectiveFrom: "2025-08-01", registered: true, rates: [standard], defaultCode: "RO_STANDARD" }
const issuer = (vatPeriods: unknown) => ({
  organizationId: "org-1", name: "Exemplu SRL", fiscalIdentifier: "12345674",
  address: { countryCode: "RO", city: "Iași", street: "Strada 1", county: "RO-IS" },
  legalForm: "srl", tradeRegistryNumber: "J22/1/2020", iban: "", bankName: "", socialCapital: "200.00",
  defaultCurrency: "RON", defaultPaymentTermDays: 15, vatConfigurations: [], currentVat: null, vatPeriods, branding: null,
})

void test("the issuer's VAT periods decode as the server answers them", () => {
  const closed = { effectiveFrom: "2025-01-01", effectiveTo: "2025-07-31", registered: null, rates: [], defaultCode: null }
  assert.deepEqual(decodeIssuer(issuer([closed, period])).vatPeriods, [closed, period])
})

// A period read wrong would offer the wrong rates on a date, so the answer fails at the boundary.
void test("a VAT period without its start, or with a registration that is not a boolean or null, is refused", () => {
  const withoutStart = { registered: true, rates: [standard], defaultCode: "RO_STANDARD" }
  assert.throws(() => decodeIssuer(issuer([withoutStart])), /invalid effectiveFrom/u)
  for (const registered of ["true", 1, undefined]) {
    assert.throws(() => decodeIssuer(issuer([{ ...period, registered }])), /invalid registered/u)
  }
  assert.throws(() => decodeIssuer(issuer(undefined)), /invalid vatPeriods/u)
  assert.throws(() => decodeIssuer(issuer([{ ...period, defaultCode: undefined }])), /invalid defaultCode/u)
})

void test("a VAT period whose default is not one of its rates, or that offers rates for an unnamed regime, is refused", () => {
  assert.throws(() => decodeIssuer(issuer([{ ...period, defaultCode: null }])), /invalid VAT period defaultCode/u)
  assert.throws(() => decodeIssuer(issuer([{ ...period, rates: [] }])), /invalid VAT period defaultCode/u)
  assert.throws(() => decodeIssuer(issuer([{ ...period, defaultCode: "RO_REDUCED" }])), /invalid VAT period defaultCode/u)
  assert.throws(() => decodeIssuer(issuer([{ ...period, registered: null }])), /invalid VAT period rates/u)
})
