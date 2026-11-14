import type { ReactNode } from "react"

/** The actions under a form or a panel, in one wrapping row. */
export const ButtonRow = ({ children }: { readonly children: ReactNode }) =>
  <div className="flex flex-wrap gap-[.6rem]">{children}</div>
