import assert from "node:assert/strict"
import test from "node:test"

import { ValidationFailure } from "../../contracts/failures.ts"
import { article310VatExemptionReason } from "../../domain/validation.ts"
import { normalizeIssuerDetails } from "./issuer-details.ts"
import { scheduleVatRegistration } from "./vat-regime.ts"
import { normalizeBrandingText, validateIssuer as validateIssuerOn } from "./validation.ts"

const validateIssuer = (issuer: Parameters<typeof validateIssuerOn>[0]): void => { validateIssuerOn(issuer) }
const s = { vatCategoryCode: "S" as const, vatExemptionReason: null }
const nonVat = { vatCategoryCode: "O" as const, vatExemptionReason: article310VatExemptionReason }

void test("normalizes branding text and rejects all Unicode Other categories", () => {
  assert.equal(normalizeBrandingText(null), null)
  assert.equal(normalizeBrandingText("   "), null)
  assert.equal(normalizeBrandingText("  Știință & Tehnică 😀  "), "Știință & Tehnică 😀")
  assert.equal(normalizeBrandingText("W".repeat(80)), "W".repeat(80))
  assert.equal(normalizeBrandingText("😀".repeat(80)), "😀".repeat(80))
  assert.throws(() => normalizeBrandingText("😀".repeat(81)), ValidationFailure)
  const disallowed = [
    ["control", "\u0000"], ["format", "\u200b"], ["surrogate", "\ud800"],
    ["private use", "\ue000"], ["unassigned", "\u0378"],
  ] as const
  for (const [category, character] of disallowed) {
    assert.throws(() => normalizeBrandingText(`Studio${character}X`), ValidationFailure, category)
  }
})

void test("requires a Romanian CUI, RON currency and valid VAT tuples for the issuer", () => {
  const party = {
    name: "Exemplu SRL",
    fiscalIdentifier: "45561046",
    address: { countryCode: "RO", city: "Botoșani", street: "Strada Mare 1", county: "RO-BT" },
  }
  const hasIssue = (expected: string) => (error: unknown): boolean =>
    error instanceof ValidationFailure && error.issues.includes(expected)
  const issuer = {
    ...party,
    organizationId: "org-1",
    legalForm: "srl" as const,
    tradeRegistryNumber: "J40/123/2020",
    socialCapital: "200.00",
    iban: "",
    bankName: "",
    defaultCurrency: "RON",
    defaultPaymentTermDays: 15,
    branding: null,
    vatConfigurations: [{ code: "RO_NON_VAT", rate: "0", ...nonVat, effectiveFrom: "2026-01-01" }],
  }
  assert.throws(() => { validateIssuer({ ...issuer, fiscalIdentifier: "" }) }, hasIssue("fiscalIdentifier must be a valid Romanian CUI"))
  assert.throws(() => { validateIssuer({ ...issuer, defaultCurrency: "EUR" }) }, hasIssue("defaultCurrency must be RON"))
  assert.doesNotThrow(() => { validateIssuer({
    ...issuer,
    vatConfigurations: [{ code: "RO_STANDARD", rate: "21", ...s, effectiveFrom: "2026-01-01" }],
  }) })
  assert.throws(() => { validateIssuer({
    ...issuer,
    fiscalIdentifier: "45561046",
    vatConfigurations: [{ code: "RO_NON_VAT", rate: "21", ...nonVat, effectiveFrom: "2026-01-01" }],
  }) }, (error: unknown) => error instanceof ValidationFailure && error.issues.includes("Invalid VAT tuple"))
  assert.doesNotThrow(() => { validateIssuer({
    ...issuer,
    fiscalIdentifier: "45561046",
    vatConfigurations: [
      { code: "RO_STANDARD", rate: "21", ...s, effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31" },
      { code: "RO_NON_VAT", rate: "0", ...nonVat, effectiveFrom: "2027-01-01" },
    ],
  }) })
  assert.doesNotThrow(() => { validateIssuer({
    ...issuer,
    fiscalIdentifier: "45561046",
    vatConfigurations: [{ code: "RO_REDUCED", rate: "11", ...s, effectiveFrom: "2026-01-01" }],
  }) })
})

void test("rejects overlapping effective ranges for the same tax code", () => {
  const base = {
    organizationId: "org-1",
    name: "Exemplu SRL",
    fiscalIdentifier: "12345674",
    address: { countryCode: "RO", city: "Botoșani", street: "Strada Mare 1", county: "RO-BT" },
    legalForm: "srl" as const,
    tradeRegistryNumber: "J40/123/2020",
    socialCapital: "200.00",
    iban: "",
    bankName: "",
    defaultCurrency: "RON",
    defaultPaymentTermDays: 15,
    branding: null,
  }
  assert.throws(() => { validateIssuer({
    ...base,
    vatConfigurations: [
      { code: "RO_STANDARD", rate: "19", ...s, effectiveFrom: "2020-01-01", effectiveTo: "2025-08-01" },
      { code: "RO_STANDARD", rate: "21", ...s, effectiveFrom: "2025-08-01" },
    ],
  }) }, (error: unknown) => error instanceof ValidationFailure)
  assert.throws(() => { validateIssuer({
    ...base,
    vatConfigurations: [
      { code: "RO_STANDARD", rate: "19", ...s, effectiveFrom: "2020-01-01" },
      { code: "RO_STANDARD", rate: "21", ...s, effectiveFrom: "2025-08-01" },
    ],
  }) }, (error: unknown) => error instanceof ValidationFailure)
  assert.throws(() => { validateIssuer({
    ...base,
    vatConfigurations: [
      { code: "RO_STANDARD", rate: "21", ...s, effectiveFrom: "2025-08-01" },
      { code: "RO_NON_VAT", rate: "0", ...nonVat, effectiveFrom: "2026-01-01" },
    ],
  }) }, (error: unknown) => error instanceof ValidationFailure)
  assert.doesNotThrow(() => { validateIssuer({
    ...base,
    vatConfigurations: [
      { code: "RO_STANDARD", rate: "19", ...s, effectiveFrom: "2020-01-01", effectiveTo: "2025-07-31" },
      { code: "RO_STANDARD", rate: "21", ...s, effectiveFrom: "2025-08-01" },
    ],
  }) })
})

void test("issuer legal details and VAT changes are refused with a code the browser says in Romanian", () => {
  const details = { legalForm: "srl" as const, tradeRegistryNumber: "", iban: "", bankName: "", socialCapital: "" }
  assert.throws(() => normalizeIssuerDetails({ ...details, legalForm: "sa" as never }), { details: [{ code: "legal_form_invalid", field: "legalForm" }] })
  assert.throws(() => normalizeIssuerDetails({ ...details, tradeRegistryNumber: "J40-123" }),
    { details: [{ code: "trade_registry_invalid", field: "tradeRegistryNumber" }] })
  assert.throws(() => normalizeIssuerDetails({ ...details, iban: "RO49AAAA1B31007593840001" }), { details: [{ code: "iban_checksum", field: "iban" }] })
  assert.throws(() => normalizeIssuerDetails({ ...details, iban: "RO49" }), { details: [{ code: "iban_invalid", field: "iban" }] })
  assert.throws(() => scheduleVatRegistration([], { registered: true, effectiveFrom: "2020-01-01" }),
    { details: [{ code: "vat_catalogue_not_covered", field: "vatChange.effectiveFrom", params: { date: "2020-01-01" } }] })
})
