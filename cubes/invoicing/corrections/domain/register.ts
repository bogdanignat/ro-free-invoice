import type { EFacturaStatus } from "../../domain/invoice.ts"
import { maximumSearchLength, normalizeSearchText, searchTextIssues } from "../../domain/search.ts"
import { isCalendarDate } from "./reports.ts"

export type InvoiceRegisterKind = "invoice" | "correction"

/**
 * What a client may narrow the register to. Every field is optional and an
 * absent one does not filter: `{}` is the whole register, as before the filters.
 * `from`/`to` bound `issueDate` inclusively; `search` matches series + number
 * (spaces ignored) or the customer name, case-insensitively.
 */
export interface InvoiceRegisterFilter {
  readonly from?: string | undefined
  readonly to?: string | undefined
  readonly kind?: InvoiceRegisterKind | undefined
  readonly search?: string | undefined
  /** `unresolved`: only documents still to resolve in SPV (not sent, rejected/refused, unknown). */
  readonly spv?: "unresolved" | undefined
}

export const maximumRegisterSearchLength = maximumSearchLength
/** What `spv: unresolved` keeps: not sent, rejected/refused (correct and resend) or unknown (reconcile). */
export const SPV_UNRESOLVED_STATUSES = ["not_sent", "rejected", "refused", "unknown"] as const satisfies ReadonlyArray<EFacturaStatus>
const registerSpvFilters: ReadonlyArray<string> = ["unresolved"] satisfies ReadonlyArray<NonNullable<InvoiceRegisterFilter["spv"]>>
const registerKinds: ReadonlyArray<string> = ["invoice", "correction"] satisfies ReadonlyArray<InvoiceRegisterKind>

/** Empty when the filter can be asked for; the rule lives here so every caller (HTTP, CLI) gets it. */
export const registerFilterIssues = (filter: InvoiceRegisterFilter): ReadonlyArray<string> => {
  const issues = (["from", "to"] as const)
    .filter((field) => filter[field] !== undefined && !isCalendarDate(filter[field]))
    .map((field) => `${field} must be a calendar date in YYYY-MM-DD format`)
  if (issues.length === 0 && filter.from !== undefined && filter.to !== undefined && filter.from > filter.to) {
    issues.push("from must not be after to")
  }
  if (filter.kind !== undefined && !registerKinds.includes(filter.kind)) {
    issues.push("kind must be invoice or correction")
  }
  if (filter.spv !== undefined && !registerSpvFilters.includes(filter.spv)) issues.push("spv must be unresolved")
  issues.push(...searchTextIssues(filter.search))
  return issues
}

/** The filter the store runs: a blank search is no search, and the search is trimmed. */
export const normalizeRegisterFilter = (filter: InvoiceRegisterFilter): InvoiceRegisterFilter =>
  ({ ...filter, search: normalizeSearchText(filter.search) })

interface RegisterRow {
  readonly id: string
  readonly series: string
  readonly number: number
  readonly issueDate: string
  readonly customer: { readonly name: string }
  readonly currency: string
  readonly totalIncludingVat: string
}

export interface InvoiceRegisterInvoiceRow extends RegisterRow {
  readonly kind: "invoice"
  readonly dueDate: string | null
  readonly eFacturaStatus: EFacturaStatus
}

export interface InvoiceRegisterCorrectionRow extends RegisterRow {
  readonly kind: "correction"
  readonly dueDate: null
  readonly eFacturaStatus: EFacturaStatus
  readonly originalReference: { readonly id: string; readonly series: string; readonly number: number }
}

export type InvoiceRegisterRow = InvoiceRegisterInvoiceRow | InvoiceRegisterCorrectionRow
export interface InvoiceRegisterCursor {
  readonly issueDate: string
  readonly number: number
  readonly id: string
  readonly kind: InvoiceRegisterKind
}
