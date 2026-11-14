import type { ComponentPropsWithRef } from "react"

import { CONTROL } from "./control.ts"
import { cx } from "./cx.ts"

export const Select = ({ className, ...props }: ComponentPropsWithRef<"select">) =>
  <select {...props} className={cx(CONTROL, "min-h-[2.65rem] appearance-auto", className)} />
