import { issue, type IssueDetail } from "./issue-detail.ts"

export const lineTotalsInconsistent = (): IssueDetail => issue("line_totals_inconsistent")
export const vatGroupInconsistent = (group: string): IssueDetail => issue("vat_group_inconsistent", undefined, { group })
export const documentWithoutLines = (): IssueDetail => issue("document_without_lines")
export const documentTotalsInconsistent = (): IssueDetail => issue("document_totals_inconsistent")
export const linesRequired = (kind: string): IssueDetail => issue("lines_required", undefined, { kind })
export const customerChoice = (): IssueDetail => issue("customer_choice")
export const currencyNotRon = (): IssueDetail => issue("currency_not_ron", "currency")
export const currencyMismatch = (): IssueDetail => issue("currency_mismatch", "currency")
export const dueDateBeforeIssue = (): IssueDetail => issue("due_date_before_issue", "dueDate")
export const dueDateRequired = (): IssueDetail => issue("due_date_required", "dueDate")
export const issueDateFuture = (): IssueDetail => issue("issue_date_future", "issueDate")
export const issueDateBeforeOriginal = (): IssueDetail => issue("issue_date_before_original", "issueDate")
export const issueDateBeforeLast = (latest: string, kind: string, series: string): IssueDetail =>
  issue("issue_date_before_last", "issueDate", { latest, kind, series })
export const vatRegistrationMissing = (date: string): IssueDetail => issue("vat_registration_missing", undefined, { date })
export const vatRegistrationChanged = (): IssueDetail => issue("vat_registration_changed")
export const vatPairUnsupported = (code: string, rate: string, date: string): IssueDetail =>
  issue("vat_pair_unsupported", undefined, { code, rate, date })
export const vatPairNeedsNonVat = (code: string, rate: string, date: string): IssueDetail =>
  issue("vat_pair_needs_non_vat", undefined, { code, rate, date })
export const vatPairNeedsVat = (code: string, rate: string, date: string): IssueDetail =>
  issue("vat_pair_needs_vat", undefined, { code, rate, date })
export const rangeInverted = (): IssueDetail => issue("range_inverted", "from")
export const periodTooLong = (maximum: number): IssueDetail => issue("period_too_long", undefined, { maximum })
export const kindInvalid = (): IssueDetail => issue("kind_invalid", "kind")
export const spvInvalid = (): IssueDetail => issue("spv_invalid", "spv")
