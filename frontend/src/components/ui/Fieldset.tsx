import type { ReactNode } from "react"

import { cx } from "./cx.ts"

/** A group of controls under a legend that reads as a field label; `className` is the layout of the group. */
export const Fieldset = ({ legend, className, children }: {
  readonly legend: ReactNode
  readonly className?: string
  readonly children: ReactNode
}) => <fieldset className={cx("m-0 p-0 border-0", className)}>
  <legend className="pb-[.45rem] text-invoice-label text-invoice-field font-invoice-label">{legend}</legend>
  {children}
</fieldset>
