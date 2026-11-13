import { validationFailure } from "../../contracts/failures.ts"
import { compareDecimal } from "../../money/index.ts"
import type { BuyerSnapshot, DocumentSource, DraftLine, IssuerCompanySnapshot, VatBreakdown } from "../../domain/invoice.ts"
import { controlCharacterIssues } from "../../domain/validation.ts"
import * as issue from "../../issues/index.ts"
export interface CreateCorrectionInput {
  readonly originalInvoiceId: string
  readonly reason: string
  readonly issueDate?: string
  readonly source?: DocumentSource
}
export interface CorrectionDocument {
  readonly id: string; readonly organizationId: string; readonly originalInvoiceId: string
  readonly source?: DocumentSource
  readonly fiscalYear: number; readonly series: string; readonly number: number
  readonly issueDate: string; readonly issuedAt: string; readonly reason: string; readonly actorId: string
  readonly currency: string
  readonly issuer: IssuerCompanySnapshot
  readonly customer: BuyerSnapshot
  readonly lines: ReadonlyArray<DraftLine>
  readonly vatBreakdown: ReadonlyArray<VatBreakdown>
  readonly totalExcludingVat: string; readonly vatTotal: string; readonly totalIncludingVat: string
}
export const validateCreateCorrectionInput = (input: CreateCorrectionInput): void => {
  const issues: Array<issue.IssueDetail> = []
  if (input.originalInvoiceId.trim().length === 0) issues.push(issue.required("originalInvoiceId"))
  if (input.reason.trim().length === 0) issues.push(issue.required("reason"))
  if (input.reason.trim().length > 300) issues.push(issue.tooLong("reason", 300))
  controlCharacterIssues("reason", input.reason.trim(), issues, true)
  if (input.issueDate !== undefined) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.issueDate)
    if (m === null) issues.push(issue.dateYyyyMmDd("issueDate"))
    else {
      const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]); const date = new Date(Date.UTC(y, mo - 1, d))
      if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) issues.push(issue.dateInvalid("issueDate"))
    }
  }
  if (issues.length > 0) throw validationFailure(issues)
}
/** Flips the sign of a decimal string on its text, so its scale stays; zero is never signed ("-0.0000" -> "0.0000"). */
export const negateDecimal = (value: string): string => compareDecimal(value, "0") === 0 ? value.replace(/^-/u, "")
  : value.startsWith("-") ? value.slice(1) : `-${value}`
