import { ApiFailure } from "./api-errors.ts"
import { issueMessages } from "./issue-messages.ts"

/** An invoice's dates as the screen holds them: an empty or absent supply date means the issue date. */
export interface SuppliedDates {
  readonly issueDate: string
  readonly supplyDate?: string | undefined
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u

const givenSupplyDate = ({ supplyDate }: SuppliedDates): string | undefined =>
  supplyDate === undefined || supplyDate === "" ? undefined : supplyDate

/** The date an invoice's VAT follows (art. 280 alin. (4) Cod fiscal): the supply, or the issue when none is set. */
export const effectiveSupplyDate = (dates: SuppliedDates): string => givenSupplyDate(dates) ?? dates.issueDate

/** Art. 319 alin. (20) lit. c): the server refuses a supply after the issue; the field says so first. */
export const invoiceSupplyDateIssue = (dates: SuppliedDates): string | null => {
  const supplyDate = givenSupplyDate(dates)
  return supplyDate !== undefined && supplyDate > dates.issueDate ? issueMessages.supply_date_after_issue ?? null : null
}

/** Art. 319 alin. (16): the invoice is due by the 15th of the month after the supply. */
export const issueDeadline = (supplyDate: string): string => {
  const year = Number(supplyDate.slice(0, 4))
  const month = Number(supplyDate.slice(5, 7))
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
  return `${String(next.year)}-${String(next.month).padStart(2, "0")}-15`
}

/** A late invoice is still issued; the warning only says the legal term has passed. */
export const lateIssueWarning = (dates: SuppliedDates): string | null => {
  const supplyDate = effectiveSupplyDate(dates)
  if (!ISO_DATE.test(supplyDate) || !ISO_DATE.test(dates.issueDate)) return null
  const deadline = issueDeadline(supplyDate)
  return dates.issueDate > deadline
    ? `Factura trebuia emisă până pe ${deadline}. Poți emite, dar termenul legal a trecut.`
    : null
}

/** A failure as the screen received it, with the dates on screen when it arrived. */
export interface SupplyDateRefusal {
  readonly error: unknown
  readonly dates: SuppliedDates
}

/** The same failure keeps the dates it arrived with; a new one takes the current dates. */
export const trackSupplyDateRefusal = (previous: SupplyDateRefusal, error: unknown, dates: SuppliedDates): SupplyDateRefusal =>
  previous.error === error ? previous : { error, dates }

const sameDates = (left: SuppliedDates, right: SuppliedDates) =>
  left.issueDate === right.issueDate && givenSupplyDate(left) === givenSupplyDate(right)

/**
 * A server refusal of the supply date (a supply after the issue, a malformed
 * date) is shown under the field rather than in the page alert, and only until
 * the user changes the supply or the issue date.
 */
export const placeSupplyDateError = (refusal: SupplyDateRefusal, issue: string | null, dates: SuppliedDates) => {
  const { error } = refusal
  if (!(error instanceof ApiFailure && error.field === "supplyDate")) return { error, supplyDateIssue: issue }
  return { error: null, supplyDateIssue: issue ?? (sameDates(refusal.dates, dates) ? error.message : null) }
}
