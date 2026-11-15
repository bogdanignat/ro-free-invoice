import type { ReactNode } from "react"

/** A screen that cannot do its work yet says why, in a note with the primary edge. */
export const SetupNote = ({ children }: { readonly children: ReactNode }) =>
  <p className="m-0 p-5 border-l-3 border-l-invoice-primary-hover rounded-invoice-control text-invoice-muted bg-invoice-secondary-surface leading-[1.6]">{children}</p>
