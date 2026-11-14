import type { AriaRole, ReactNode } from "react"

import { cx } from "./cx.ts"

export type HintTone = "neutral" | "warning"

const TONES: Readonly<Record<HintTone, string>> = {
  neutral: "text-invoice-muted font-medium",
  warning: "text-invoice-danger-text font-invoice-emphasis",
}

/** A small line under a control or a section: help in the muted tone, a refusal in the warning one. */
export const Hint = ({ tone = "neutral", id, role, className, children }: {
  readonly tone?: HintTone
  readonly id?: string
  readonly role?: AriaRole
  /** Layout from outside (a grid span), never the look. */
  readonly className?: string
  readonly children: ReactNode
}) => <p id={id} role={role} className={cx("m-0 text-[.78rem]", TONES[tone], className)}>{children}</p>
