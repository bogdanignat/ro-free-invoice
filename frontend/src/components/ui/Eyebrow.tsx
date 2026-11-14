import type { ReactNode } from "react"

/** The small capitals over a heading that name the area it belongs to. */
export const Eyebrow = ({ children }: { readonly children: ReactNode }) =>
  <p className="m-0 text-invoice-primary-hover text-invoice-caption font-extrabold tracking-[.14em] uppercase">{children}</p>
