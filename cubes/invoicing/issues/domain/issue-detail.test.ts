import assert from "node:assert/strict"
import test from "node:test"

import { validationFailure, ValidationFailure } from "../../contracts/failures.ts"
import * as documentIssue from "./document-issues.ts"
import * as fieldIssue from "./field-issues.ts"
import { renderIssue, type IssueDetail } from "./issue-detail.ts"
import { issueTemplates, type IssueCode } from "./issue-templates.ts"

void test("a detail renders to the exact English text of its template", () => {
  assert.equal(renderIssue(fieldIssue.tooLong("description", 100)), "description must be at most 100 characters")
  assert.equal(renderIssue(fieldIssue.required("notes")), "notes is required")
  assert.equal(renderIssue(fieldIssue.decimalPlaces("quantity", 4)), "quantity supports at most 4 decimal places")
  assert.equal(renderIssue(documentIssue.vatGroupInconsistent("S:21.00")), "VAT group S:21.00 contains inconsistent code or exemption reason")
})

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
    due_date_required: documentIssue.dueDateRequired(), issue_date_future: documentIssue.issueDateFuture(),
    issue_date_before_original: documentIssue.issueDateBeforeOriginal(),
    issue_date_before_last: documentIssue.issueDateBeforeLast("2026-09-01", "invoice", "QWBE"),
    vat_registration_missing: documentIssue.vatRegistrationMissing("2026-09-01"), vat_registration_changed: documentIssue.vatRegistrationChanged(),
    vat_pair_unsupported: documentIssue.vatPairUnsupported("RO_STANDARD", "21.00", "2026-09-01"),
    vat_pair_needs_non_vat: documentIssue.vatPairNeedsNonVat("RO_NON_VAT", "0.00", "2026-09-01"),
    vat_pair_needs_vat: documentIssue.vatPairNeedsVat("RO_STANDARD", "21.00", "2026-09-01"),
    range_inverted: documentIssue.rangeInverted(), period_too_long: documentIssue.periodTooLong(36), kind_invalid: documentIssue.kindInvalid(),
    spv_invalid: documentIssue.spvInvalid(),
  }
  assert.deepEqual(Object.keys(calls).sort(), Object.keys(issueTemplates).sort())
  for (const [code, detail] of Object.entries(calls)) {
    assert.equal(detail.code, code)
    assert.equal(/[{}]|undefined/u.test(renderIssue(detail)), false, code)
  }
})

void test("a failure mixing coded and bare issues keeps details aligned, with a hole for each bare one", () => {
  const failure = validationFailure(["fiscalIdentifier is required for company", fieldIssue.tooLong("name", 200)])
  assert.deepEqual(failure.issues, ["fiscalIdentifier is required for company", "name must be at most 200 characters"])
  assert.deepEqual(failure.details, [undefined, { code: "too_long", field: "name", params: { maximum: 200 } }])
})

void test("a failure built from details keeps issues and details aligned; bare text carries none", () => {
  const failure = validationFailure([fieldIssue.required("a"), fieldIssue.tooLong("b", 5)])
  assert.deepEqual(failure.issues, ["a is required", "b must be at most 5 characters"])
  assert.deepEqual(failure.details, [{ code: "required", field: "a" }, { code: "too_long", field: "b", params: { maximum: 5 } }])
  assert.equal(new ValidationFailure({ issues: ["x"] }).details, undefined)
})
