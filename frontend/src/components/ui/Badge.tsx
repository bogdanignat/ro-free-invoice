import type { ReactNode } from "react"

import { cx } from "./cx.ts"

export type BadgeTone = "neutral" | "muted" | "info" | "positive" | "danger" | "storno"

// A stacked table cell (narrow) is a grid: the badge keeps its own width instead of filling the row.
const BASE = "inline-block px-[.55rem] py-[.2rem] rounded-full text-[.74rem] font-bold narrow:in-[td]:justify-self-start"

const TONES: Readonly<Record<BadgeTone, string>> = {
  neutral: "bg-invoice-badge-surface",
  muted: "text-invoice-muted bg-invoice-badge-surface",
  info: "text-invoice-label bg-invoice-secondary-surface",
  positive: "text-invoice-primary bg-invoice-primary-soft",
  danger: "text-invoice-danger-text bg-invoice-badge-surface",
  storno: "mt-1 text-invoice-storno-text bg-invoice-storno-surface narrow:justify-self-start",
}

/** A short state word on a pill; `danger` is the needs-a-person tone, in text colour only. */
export const Badge = ({ tone = "neutral", children }: { readonly tone?: BadgeTone; readonly children: ReactNode }) =>
  <span className={cx(BASE, TONES[tone])}>{children}</span>
