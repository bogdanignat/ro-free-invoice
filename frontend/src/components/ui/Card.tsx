import type { HTMLAttributes } from "react"

import { cx } from "./cx.ts"

type CardProps = HTMLAttributes<HTMLElement> & { readonly as?: "section" | "article" | "div" }

// `data-card` lets the primitives inside read as the legacy `.card p` / `.card h2` did (`in-data-[card]:`).
// The `.alert`/`.empty-state`/`.center-state` lines bridge `AsyncState`, still on the legacy classes, until it moves.
const CARD = "p-6 border border-invoice-border rounded-invoice-panel bg-invoice-surface shadow-invoice-panel"
  + " [&_.alert_p]:text-invoice-muted [&_.alert_p]:leading-[1.6] [&_.center-state_p]:leading-[1.6] [&_.empty-state]:leading-[1.6]"

/** A panel on the canvas; `className` is for the layout inside it (a grid, a gap). */
export const Card = ({ as: Tag = "section", className, ...props }: CardProps) =>
  <Tag {...props} data-card="" className={cx(CARD, className)} />
