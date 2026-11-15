import type { AriaRole, ReactNode } from "react"

import { cx } from "./cx.ts"

export type CardTextTone = "muted" | "title" | "strong"
export type CardTextSize = "body" | "small"
export type CardTextLayout = "flow" | "status"

const TONES: Readonly<Record<CardTextTone, string>> = {
  muted: "in-data-[card]:text-invoice-muted",
  // A title line keeps its own ink: the legacy `.card p` colour lost to it, only the line height stayed.
  title: "font-bold text-invoice-ink",
  // A bold line the legacy `.card p` colour still won over (a party's name): bold, but muted in a card.
  strong: "font-bold in-data-[card]:text-invoice-muted",
}

const SIZES: Readonly<Record<CardTextSize, string>> = {
  body: "",
  // A side line under a document's head (the invoice a correction reverses).
  small: "text-[.85rem]",
}

const LAYOUTS: Readonly<Record<CardTextLayout, string>> = {
  flow: "",
  // Badges as a wrapping row over the actions that follow, as the legacy `.conversion-state`.
  status: "flex flex-wrap gap-[.6rem] items-center mb-4",
}

/** A paragraph that reads, inside a card, as the legacy `.card p` did: muted, line height 1.6. */
export const CardText = ({ tone = "muted", size = "body", layout = "flow", id, role, children }: {
  readonly tone?: CardTextTone
  readonly size?: CardTextSize
  readonly layout?: CardTextLayout
  /** For an `aria-describedby` that points at the sentence. */
  readonly id?: string
  readonly role?: AriaRole
  readonly children: ReactNode
}) => <p id={id} role={role} className={cx("m-0 in-data-[card]:leading-[1.6]", TONES[tone], SIZES[size], LAYOUTS[layout])}>{children}</p>
