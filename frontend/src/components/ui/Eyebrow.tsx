import type { ReactNode } from "react"

/** The small capitals over a heading that name the area it belongs to; in a card they read muted, as the legacy `.card p` made them. */
export const Eyebrow = ({ children }: { readonly children: ReactNode }) =>
  <p className="m-0 text-invoice-primary-hover text-invoice-caption font-extrabold tracking-[.14em] uppercase in-data-[card]:text-invoice-muted in-data-[card]:leading-[1.6]">{children}</p>
