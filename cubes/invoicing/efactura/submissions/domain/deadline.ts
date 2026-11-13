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

/**
 * The application's operational SPV deadline, `YYYY-MM-DD`. It is NOT the exact
 * legal deadline (OUG 120/2021 art. 10 alin. 7, as changed by OUG 89/2025).
 * From 2026-01-01 it is the issue date plus 5 working days, counting only
 * Monday to Friday and ignoring public holidays, so it is never later than the
 * legal one (a holiday would push the legal one later). Until 2025-12-31 the
 * legal term is 5 calendar days. The delivery date can also cap the legal term;
 * it is not known yet and will be added then as `min(...)`.
 */
export const spvDeadline = (issueDate: string): string =>
  issueDate >= WORKING_DAYS_FROM ? addWorkingDays(issueDate, 5) : fromDay(toDay(issueDate) + 5 * DAY_MS)

export type SpvUrgency = "overdue" | "imminent" | "ok"

/** Overdue after the deadline day; imminent when it falls on or before the next working day after `today` (Bucharest, `YYYY-MM-DD`). */
export const spvUrgency = (deadline: string, today: string): SpvUrgency => {
  if (deadline < today) return "overdue"
  return deadline <= addWorkingDays(today, 1) ? "imminent" : "ok"
}
