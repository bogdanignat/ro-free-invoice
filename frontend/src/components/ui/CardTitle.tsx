import type { ReactNode } from "react"

/** An `h2` set straight in a card, as the legacy `.card h2`: 1.1rem, indented .7rem (a grid card shows it as a block). */
export const CardTitle = ({ children }: { readonly children: ReactNode }) =>
  <h2 className="inline ml-[.7rem] text-[1.1rem]">{children}</h2>
