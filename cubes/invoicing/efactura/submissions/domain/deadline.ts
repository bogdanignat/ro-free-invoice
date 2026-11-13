import { SPV_UNRESOLVED_STATUSES } from "../../../corrections/index.ts"
import type { FiscalState } from "./states.ts"

/** Where an issued document stands for the operator, grouped from its current submission. */
export const SPV_STATES = ["not_sent", "in_progress", "accepted", "failed", "unknown"] as const
export type SpvState = (typeof SPV_STATES)[number]

/** A document's `e_factura_status`: the current submission's state, or `not_sent` when there is none (or only superseded ones). */
type SpvInput = FiscalState | "not_sent"

/** `failed` (rejected, refused) and `unknown` are not "not sent": the first must be corrected, the second reconciled, never resent blindly. */
export const spvState = (status: SpvInput): SpvState => {
  switch (status) {
    case "not_sent": return "not_sent"
    case "queued":
    case "validating":
    case "uploading":
    case "processing": return "in_progress"
    case "accepted": return "accepted"
    case "rejected":
    case "refused": return "failed"
    case "unknown": return "unknown"
  }
}

/** Still to resolve in SPV: the same list the register's `spv: unresolved` filter keeps. */
export const spvNeedsAction = (status: SpvInput): boolean => (SPV_UNRESOLVED_STATUSES as ReadonlyArray<string>).includes(status)

const DAY_MS = 86_400_000
const WORKING_DAYS_FROM = "2026-01-01"

const toDay = (date: string): number => {
  const [year, month, day] = date.split("-").map(Number)
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}
const fromDay = (day: number): string => new Date(day).toISOString().slice(0, 10)
const isWeekend = (day: number): boolean => [0, 6].includes(new Date(day).getUTCDay())

/** `date` plus `count` Monday-to-Friday days; the day itself is not counted. */
const addWorkingDays = (date: string, count: number): string => {
  let day = toDay(date)
  for (let left = count; left > 0;) {
    day += DAY_MS
    if (!isWeekend(day)) left -= 1
  }
  return fromDay(day)
}

/** The 15th of the month after the supply: the latest issue date (art. 319 alin. (16) Cod fiscal). */
const issueTermFor = (supplyDate: string): string => {
  const [year, month] = supplyDate.split("-").map(Number)
  return fromDay(Date.UTC(year ?? 1970, month ?? 1, 15))
}

/**
 * The application's operational SPV deadline, `YYYY-MM-DD`. It is NOT the exact
 * legal deadline (OUG 120/2021 art. 10 alin. 7, as changed by OUG 89/2025):
 * 5 days after the issue date, but no later than 5 days after the latest issue
 * date the supply allows (the 15th of the following month). From 2026-01-01
 * the days are working days, counting only Monday to Friday and ignoring public
 * holidays, so it is never later than the legal one (a holiday would push the
 * legal one later); counted from a day up to 2025-12-31 they are calendar days.
 * The day counted from picks the rule, so each of the two terms is the legal
 * count. Without a supply date (a correction) only the issue date counts.
 */
export const spvDeadline = (issueDate: string, supplyDate?: string): string => {
  const plusFive = (date: string): string =>
    date >= WORKING_DAYS_FROM ? addWorkingDays(date, 5) : fromDay(toDay(date) + 5 * DAY_MS)
  const fromIssue = plusFive(issueDate)
  if (supplyDate === undefined) return fromIssue
  const fromIssueTerm = plusFive(issueTermFor(supplyDate))
  return fromIssueTerm < fromIssue ? fromIssueTerm : fromIssue
}

export type SpvUrgency = "overdue" | "imminent" | "ok"

/** Overdue after the deadline day; imminent when it falls on or before the next working day after `today` (Bucharest, `YYYY-MM-DD`). */
export const spvUrgency = (deadline: string, today: string): SpvUrgency => {
  if (deadline < today) return "overdue"
  return deadline <= addWorkingDays(today, 1) ? "imminent" : "ok"
}
