import type { ComponentPropsWithRef, ReactNode } from "react"

type CheckboxProps = Omit<ComponentPropsWithRef<"input">, "type" | "className"> & {
  readonly children: ReactNode
}

/** A native checkbox with its label beside it; the input props go straight to the input. */
export const Checkbox = ({ children, ...props }: CheckboxProps) =>
  <label className="flex gap-2 items-center text-[.85rem] font-semibold">
    <input {...props} className="w-auto min-h-0" type="checkbox" />
    {children}
  </label>
