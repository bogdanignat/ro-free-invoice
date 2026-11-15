import type { ReactNode } from "react"

/** Form controls side by side, as many columns as fit; a `col-span-full` field takes the whole row. */
export const FormGrid = ({ children }: { readonly children: ReactNode }) =>
  <div className="grid gap-x-5 gap-y-4 grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">{children}</div>
