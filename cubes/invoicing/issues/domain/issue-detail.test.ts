import assert from "node:assert/strict"
import test from "node:test"

import { validationFailure } from "../../contracts/failures.ts"
import * as catalogIssue from "./catalog-issues.ts"
import * as documentIssue from "./document-issues.ts"
import * as fieldIssue from "./field-issues.ts"
import { renderIssue, type IssueDetail } from "./issue-detail.ts"
import { issueTemplates, type IssueCode } from "./issue-templates.ts"
import * as partyIssue from "./party-issues.ts"
import * as requestIssue from "./request-issues.ts"

void test("a detail renders to the exact English text of its template", () => {
  assert.equal(renderIssue(fieldIssue.tooLong("description", 100)), "description must be at most 100 characters")
  assert.equal(renderIssue(fieldIssue.required("notes")), "notes is required")
  assert.equal(renderIssue(fieldIssue.decimalPlaces("quantity", 4)), "quantity supports at most 4 decimal places")
  assert.equal(renderIssue(documentIssue.vatGroupInconsistent("S:21.00")), "VAT group S:21.00 contains inconsistent code or exemption reason")
})

const partyCalls = {
  integer_out_of_range: partyIssue.integerOutOfRange("defaultPaymentTermDays", 0, 365), cui_invalid: partyIssue.cuiInvalid(),
  cnp_invalid: partyIssue.cnpInvalid(), company_cui_required: partyIssue.companyCuiRequired(), country_not_ro: partyIssue.countryNotRo(),
  county_invalid: partyIssue.countyInvalid(), sector_invalid: partyIssue.sectorInvalid(), sector_not_allowed: partyIssue.sectorNotAllowed(),
  party_type_invalid: partyIssue.partyTypeInvalid(), individual_vat_registered: partyIssue.individualVatRegistered(),
  legal_form_invalid: partyIssue.legalFormInvalid(), trade_registry_invalid: partyIssue.tradeRegistryInvalid(),
  bank_name_invalid: partyIssue.bankNameInvalid(), social_capital_invalid: partyIssue.socialCapitalInvalid(), iban_invalid: partyIssue.ibanInvalid(),
  iban_checksum: partyIssue.ibanChecksum(), not_canonical: partyIssue.notCanonical("iban"), required_for_issuance: partyIssue.requiredForIssuance("iban"),
  social_capital_required: partyIssue.socialCapitalRequired(), branding_empty: partyIssue.brandingEmpty(),
  branding_image_invalid: partyIssue.brandingImageInvalid(), branding_image_unreadable: partyIssue.brandingImageUnreadable(),
  vat_configuration_unresolved: partyIssue.vatConfigurationUnresolved("S", "2026-09-01"),
  vat_configurations_empty: partyIssue.vatConfigurationsEmpty(), vat_configuration_code_invalid: partyIssue.vatConfigurationCodeInvalid(),
  vat_configuration_rate_invalid: partyIssue.vatConfigurationRateInvalid("S"), vat_configuration_range_invalid: partyIssue.vatConfigurationRangeInvalid("S"),
  vat_configurations_overlap: partyIssue.vatConfigurationsOverlap(), vat_configuration_inconsistent: partyIssue.vatConfigurationInconsistent("2026-09-01"),
  non_vat_basis_not_allowed: partyIssue.nonVatBasisNotAllowed(), non_vat_basis_invalid: partyIssue.nonVatBasisInvalid(),
  vat_catalogue_not_covered: partyIssue.vatCatalogueNotCovered("2020-01-01"), vat_registry_unknown_cif: partyIssue.vatRegistryUnknownCif("12345674"),
  vat_registry_not_registered: partyIssue.vatRegistryNotRegistered("12345674", "2026-09-01"),
  vat_registry_registered: partyIssue.vatRegistryRegistered("12345674", "2026-09-01"),
}
const catalogCalls = {
  product_kind_invalid: catalogIssue.productKindInvalid(), preferred_vat_rate_invalid: catalogIssue.preferredVatRateInvalid("2026-09-01"),
  item_code_invalid: catalogIssue.itemCodeInvalid("sellerItemCode"), barcode_invalid: catalogIssue.barcodeInvalid("standardItemCode"),
  unit_invalid: catalogIssue.unitInvalid(), cui_digits_only: catalogIssue.cuiDigitsOnly(), cui_too_short: catalogIssue.cuiTooShort(2),
  query_too_few_letters: catalogIssue.queryTooFewLetters(3), provider_invalid: catalogIssue.providerInvalid("anaf, openapi"),
  openapi_key_conflict: catalogIssue.openapiKeyConflict(), openapi_key_invalid: catalogIssue.openapiKeyInvalid(),
  openapi_key_required: catalogIssue.openapiKeyRequired(),
}
const requestCalls = {
  invalid_input: requestIssue.invalidInput("quantity"), pagination_repeated: requestIssue.paginationRepeated(),
  source_filter_incomplete: requestIssue.sourceFilterIncomplete(), request_not_fingerprintable: requestIssue.requestNotFingerprintable(),
  upload_index_invalid: requestIssue.uploadIndexInvalid(), confirmation_required: requestIssue.confirmationRequired(),
  spv_filter_unavailable: requestIssue.spvFilterUnavailable(), efactura_rule: requestIssue.efacturaIssue("x (BR-RO-120)"),
  efactura_contract: requestIssue.efacturaIssue("x"),
}

void test("every code's constructor fills each placeholder of its template", () => {
  const calls: Readonly<Record<IssueCode, IssueDetail>> = {
    invalid_vat_tuple: fieldIssue.invalidVatTuple(), date_format: fieldIssue.dateFormat("issueDate"), date_yyyy_mm_dd: fieldIssue.dateYyyyMmDd("issueDate"),
    date_invalid: fieldIssue.dateInvalid("issueDate"), document_type_invalid: fieldIssue.documentTypeInvalid(), series_invalid: fieldIssue.seriesInvalid(),
    required: fieldIssue.required("notes"), surrounding_whitespace: fieldIssue.surroundingWhitespace("notes"), too_long: fieldIssue.tooLong("notes", 300),
    control_characters: fieldIssue.containsControlCharacters("notes"), decimal_syntax: fieldIssue.decimalSyntax("quantity"),
    decimal_places: fieldIssue.decimalPlaces("quantity", 4), quantity_zero: fieldIssue.quantityZero(), amount_invalid: fieldIssue.amountInvalid("amount"),
    amount_not_positive: fieldIssue.amountNotPositive("amount"), currency_invalid: fieldIssue.currencyInvalid(),
    empty_when_provided: fieldIssue.emptyWhenProvided("note"), cursor_invalid: fieldIssue.cursorInvalid(), limit_out_of_range: fieldIssue.limitOutOfRange(100),
    idempotency_key_invalid: fieldIssue.idempotencyKeyInvalid(), idempotency_fingerprint_invalid: fieldIssue.idempotencyFingerprintInvalid(),
    line_totals_inconsistent: documentIssue.lineTotalsInconsistent(), vat_group_inconsistent: documentIssue.vatGroupInconsistent("S:21.00"),
    document_without_lines: documentIssue.documentWithoutLines(), document_totals_inconsistent: documentIssue.documentTotalsInconsistent(),
    lines_required: documentIssue.linesRequired("invoice"), customer_choice: documentIssue.customerChoice(), currency_not_ron: documentIssue.currencyNotRon(),
    currency_mismatch: documentIssue.currencyMismatch(), due_date_before_issue: documentIssue.dueDateBeforeIssue(),
    due_date_required: documentIssue.dueDateRequired(), supply_date_after_issue: documentIssue.supplyDateAfterIssue(), issue_date_future: documentIssue.issueDateFuture(),
    issue_date_before_original: documentIssue.issueDateBeforeOriginal(),
    issue_date_before_last: documentIssue.issueDateBeforeLast("2026-09-01", "invoice", "QWBE"),
    vat_registration_missing: documentIssue.vatRegistrationMissing("2026-09-01"), vat_registration_changed: documentIssue.vatRegistrationChanged(),
    vat_pair_unsupported: documentIssue.vatPairUnsupported("RO_STANDARD", "21.00", "2026-09-01"),
    vat_pair_needs_non_vat: documentIssue.vatPairNeedsNonVat("RO_NON_VAT", "0.00", "2026-09-01"),
    vat_pair_needs_vat: documentIssue.vatPairNeedsVat("RO_STANDARD", "21.00", "2026-09-01"),
    range_inverted: documentIssue.rangeInverted(), period_too_long: documentIssue.periodTooLong(36), kind_invalid: documentIssue.kindInvalid(),
    spv_invalid: documentIssue.spvInvalid(), ...partyCalls, ...catalogCalls, ...requestCalls,
  }
  assert.deepEqual(Object.keys(calls).sort(), Object.keys(issueTemplates).sort())
  for (const [code, detail] of Object.entries(calls)) {
    assert.equal(detail.code, code)
    assert.equal(/[{}]|undefined/u.test(renderIssue(detail)), false, code)
  }
})

void test("a failure keeps issues and details aligned 1:1", () => {
  const failure = validationFailure([fieldIssue.required("a"), fieldIssue.tooLong("b", 5)])
  assert.deepEqual(failure.issues, ["a is required", "b must be at most 5 characters"])
  assert.deepEqual(failure.details, [{ code: "required", field: "a" }, { code: "too_long", field: "b", params: { maximum: 5 } }])
})

void test("an e-Factura refusal is coded by its BR rule, keeping the validator's text", () => {
  const text = "id must contain at least one digit (BR-RO-010)"
  assert.deepEqual(requestIssue.efacturaIssue(text), { code: "efactura_rule", params: { rule: "BR-RO-010", text: "id must contain at least one digit" } })
  assert.deepEqual(requestIssue.efacturaIssue("UBL root is missing"), { code: "efactura_contract", params: { text: "UBL root is missing" } })
  assert.equal(renderIssue(requestIssue.efacturaIssue(text)), text)
})

void test("a decoding refusal is invalid_input on its field, none at the root", () => {
  assert.deepEqual(requestIssue.invalidInput("lines.0.quantity"), { code: "invalid_input", field: "lines.0.quantity" })
  assert.deepEqual(requestIssue.invalidInput(""), { code: "invalid_input" })
})
