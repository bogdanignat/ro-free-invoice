import type { AriaRole, ReactNode } from "react"

import { cx } from "./cx.ts"

export type StatusNoteTone = "info" | "warning" | "error"

// In a card a note paragraph keeps the legacy `.card p` line height.
const NOTE = "mb-4 px-4 py-3 border-l-3 rounded-invoice-control text-[.84rem] in-data-[card]:leading-[1.6]"
const ALERT = "mb-4 px-4 py-[.85rem] border-l-3 rounded-invoice-control text-[.82rem] [&_p]:mt-1"

const TONES: Readonly<Record<StatusNoteTone, string>> = {
  // The legacy `.card p` outranks the note's own colour, so inside a card an info note reads muted.
  info: "border-l-invoice-primary-hover text-invoice-label bg-invoice-primary-soft [.card_&]:text-invoice-muted in-data-[card]:text-invoice-muted",
  warning: "border-l-invoice-danger text-invoice-danger-text bg-invoice-danger-soft",
  error: "border-l-invoice-danger text-invoice-danger-text bg-invoice-danger-soft",
}

/**
 * A sentence about the screen's state: a warning or an error is announced at
 * once, anything else politely. An error may hold paragraphs, so it is a block.
 * `role={null}` leaves the note without a role, for a sentence that is only read
 * where it stands or that announces itself through `aria-live`.
 */
export const StatusNote = ({ tone = "info", role, id, "aria-live": live, children }: {
  readonly tone?: StatusNoteTone
  readonly role?: AriaRole | null
  readonly id?: string
  readonly "aria-live"?: "polite" | "assertive"
  readonly children: ReactNode
}) => {
  const Note = tone === "error" ? "div" : "p"
  return <Note id={id} className={cx(tone === "error" ? ALERT : NOTE, TONES[tone])} aria-live={live}
    role={role === null ? undefined : role ?? (tone === "info" ? "status" : "alert")}>{children}</Note>
}
