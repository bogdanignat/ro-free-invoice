import type { AriaRole, ReactNode } from "react"

import { cx } from "./cx.ts"

export type HintTone = "neutral" | "warning"

const TONES: Readonly<Record<HintTone, string>> = {
  neutral: "text-invoice-muted font-medium",
  warning: "text-invoice-danger-text font-invoice-emphasis",
}

/**
 * A small line under a control or a section: help in the muted tone, a refusal in the warning one.
 * `span` is for a line inside a label; only a paragraph took the legacy `.card p` line height.
 */
export const Hint = ({ tone = "neutral", as: Tag = "p", id, role, "aria-live": live, className, children }: {
  readonly tone?: HintTone
  readonly as?: "p" | "span"
  readonly id?: string
  readonly role?: AriaRole
  readonly "aria-live"?: "polite"
  /** Layout from outside (a grid span), never the look. */
  readonly className?: string
  readonly children: ReactNode
}) => <Tag id={id} role={role} aria-live={live}
  className={cx("m-0 text-[.78rem]", TONES[tone], Tag === "p" && "in-data-[card]:leading-[1.6]", className)}>{children}</Tag>
