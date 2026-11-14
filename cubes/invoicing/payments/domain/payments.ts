import { formatDecimal, parseDecimal, parseUnsignedDecimal } from "../../money/index.ts"
import { controlCharacterIssues, validateDate } from "../../domain/validation.ts"
import * as issue from "../../issues/index.ts"
import { ValidationFailure, validationFailure } from "../contracts/failures.ts"

// Same rule as the invoicing cube: the fiscal "today" is the Romanian calendar day, not UTC.
export const organizationTimeZone = "Europe/Bucharest"
export const calendarDate = (instant: Date, timeZone: string = organizationTimeZone): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant)

export type PaymentStatus = "unpaid" | "partially_paid" | "paid" | "overpaid" | "overdue" | "credited"
// A reversal is a second immutable row that cancels one payment in full; nothing is ever edited or deleted.
export type PaymentKind = "payment" | "reversal"
export interface Payment {
  readonly id: string
  readonly invoiceId: string
  readonly organizationId: string
  readonly kind: PaymentKind
  readonly reversesPaymentId?: string
  readonly amount: string
  readonly currency: string
  readonly paymentDate: string
  readonly method: string
  readonly externalReference?: string
  readonly note?: string
  readonly actorId: string
  readonly createdAt: string
}
export interface ReversePaymentInput {
  readonly invoiceId: string
  readonly paymentId: string
  readonly reason?: string
}
export interface IdempotencyAttempt { readonly key: string; readonly fingerprint: string }
export interface Idempotent<Input> { readonly request: Input; readonly idempotency: IdempotencyAttempt }
export type PaymentOperation = "record_payment" | "reverse_payment"
export interface PaymentIdempotencyRecord extends IdempotencyAttempt {
  readonly organizationId: string
  readonly operation: PaymentOperation
  readonly resultId: string
  readonly createdAt: string
}
export interface RecordPaymentInput {
  readonly invoiceId: string
  readonly amount: string
  readonly currency: string
  readonly paymentDate: string
  readonly method: string
  readonly externalReference?: string
  readonly note?: string
}

/** An amount typed in: trimmed, unsigned, at most two decimals and strictly positive. */
const parseMoneyMinor = (value: string, field: string): bigint => {
  const parsed = parseUnsignedDecimal(value.trim(), 2)
  if (!parsed.ok) throw validationFailure([issue.amountInvalid(field)])
  if (parsed.units <= 0n) throw validationFailure([issue.amountNotPositive(field)])
  return parsed.units
}
/** The details a check refused with; any other failure propagates as is. */
const refusedWith = (check: () => unknown): ReadonlyArray<issue.IssueDetail> => {
  try { check() } catch (error) {
    if (!(error instanceof ValidationFailure)) throw error
    return error.details
  }
  return []
}
/** A text as stored (trimmed); the baseline CHECKs the same lengths. A note may span lines. */
const boundedText = (field: string, value: string | undefined, maximum: number, issues: Array<issue.IssueDetail>, newlines = false): void => {
  if (value === undefined) return
  const text = value.trim()
  if (text.length > maximum) issues.push(issue.tooLong(field, maximum))
  controlCharacterIssues(field, text, issues, newlines)
}
export const validateRecordPaymentInput = (input: RecordPaymentInput): void => {
  const issues: Array<issue.IssueDetail> = []
  if (input.invoiceId.trim().length === 0) issues.push(issue.required("invoiceId"))
  issues.push(...refusedWith(() => parseMoneyMinor(input.amount, "amount")))
  if (!/^[A-Z]{3}$/.test(input.currency)) issues.push(issue.currencyInvalid())
  if (input.method.trim().length === 0) issues.push(issue.required("method"))
  if (input.externalReference !== undefined && input.externalReference.trim().length === 0) issues.push(issue.emptyWhenProvided("externalReference"))
  if (input.note !== undefined && input.note.trim().length === 0) issues.push(issue.emptyWhenProvided("note"))
  boundedText("method", input.method, 50, issues)
  boundedText("externalReference", input.externalReference, 100, issues)
  boundedText("note", input.note, 500, issues, true)
  issues.push(...refusedWith(() => { validateDate(input.paymentDate, "paymentDate") }))
  if (issues.length > 0) throw validationFailure(issues)
}
export const validateReversePaymentInput = (input: ReversePaymentInput): void => {
  const issues: Array<issue.IssueDetail> = []
  if (input.invoiceId.trim().length === 0) issues.push(issue.required("invoiceId"))
  if (input.paymentId.trim().length === 0) issues.push(issue.required("paymentId"))
  if (input.reason !== undefined && input.reason.trim().length === 0) issues.push(issue.emptyWhenProvided("reason"))
  boundedText("reason", input.reason, 500, issues, true)
  if (issues.length > 0) throw validationFailure(issues)
}
/** A canonical amount ("12.50", "-0.05") or a validated input amount, in bani. */
export const moneyMinor = (value: string): bigint => {
  const text = value.trim()
  const parsed = parseDecimal(text, 2)
  return parsed.ok && /\.\d{2}$/u.test(text) ? parsed.units : parseMoneyMinor(value, "money")
}
export const formatMinor = (value: bigint): string => formatDecimal(value, 2)
