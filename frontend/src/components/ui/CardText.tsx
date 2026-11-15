import type { AriaRole, ReactNode } from "react"

import { cx } from "./cx.ts"

export type CardTextTone = "muted" | "title" | "strong"

const TONES: Readonly<Record<CardTextTone, string>> = {
  muted: "in-data-[card]:text-invoice-muted",
  // A title line keeps its own ink: the legacy `.card p` colour lost to it, only the line height stayed.
  title: "font-bold text-invoice-ink",
  // A bold line the legacy `.card p` colour still won over (a party's name): bold, but muted in a card.
  strong: "font-bold in-data-[card]:text-invoice-muted",
}

/** A paragraph that reads, inside a card, as the legacy `.card p` did: muted, line height 1.6. */
export const CardText = ({ tone = "muted", role, className, children }: {
  readonly tone?: CardTextTone
  readonly role?: AriaRole
  /** Spacing or size from the layout around it, never the colour. */
  readonly className?: string
  readonly children: ReactNode
}) => <p role={role} className={cx("m-0 in-data-[card]:leading-[1.6]", TONES[tone], className)}>{children}</p>
