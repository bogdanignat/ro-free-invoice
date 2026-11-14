import type { ComponentPropsWithRef } from "react"

import { CONTROL } from "./control.ts"
import { cx } from "./cx.ts"

export const Textarea = ({ className, ...props }: ComponentPropsWithRef<"textarea">) =>
  <textarea {...props} className={cx(CONTROL, "min-h-20 resize-y", className)} />
