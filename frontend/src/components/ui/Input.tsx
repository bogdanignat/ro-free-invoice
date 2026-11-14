import type { ComponentPropsWithRef } from "react"

import { CONTROL } from "./control.ts"
import { cx } from "./cx.ts"

export const Input = ({ className, ...props }: ComponentPropsWithRef<"input">) =>
  <input {...props} className={cx(CONTROL, "min-h-[2.65rem]", className)} />
