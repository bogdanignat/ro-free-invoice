import type { HTMLAttributes } from "react"

import { cx } from "./cx.ts"

type CardProps = HTMLAttributes<HTMLElement> & { readonly as?: "section" | "article" | "div" }

/** A panel on the canvas; `className` is for the layout inside it (a grid, a gap). */
export const Card = ({ as: Tag = "section", className, ...props }: CardProps) =>
  <Tag {...props} className={cx("p-6 border border-invoice-border rounded-invoice-panel bg-invoice-surface shadow-invoice-panel", className)} />
