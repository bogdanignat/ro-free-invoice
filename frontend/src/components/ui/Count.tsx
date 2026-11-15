import type { ReactNode } from "react"

/** How many rows a section holds, as a pill beside its heading. */
export const Count = ({ "aria-live": live, children }: { readonly "aria-live"?: "polite"; readonly children: ReactNode }) =>
  <span aria-live={live}
    className="px-[.65rem] py-[.3rem] rounded-invoice-control text-invoice-label bg-invoice-badge-surface text-[.8rem] font-bold whitespace-nowrap">{children}</span>
