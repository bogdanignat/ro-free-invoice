import { useId, type ComponentPropsWithRef, type ReactNode } from "react"

import { Hint } from "./Hint.tsx"

type SwitchProps = Omit<ComponentPropsWithRef<"input">, "type" | "role" | "aria-describedby" | "className"> & {
  readonly label: ReactNode
  readonly description?: ReactNode
}

/**
 * An on/off control: a native checkbox announced as a switch, with its label
 * and an optional description it is described by.
 */
export const Switch = ({ label, description, ...props }: SwitchProps) => {
  const descriptionId = useId()
  return <div className="grid gap-1">
    <label className="flex gap-2 items-center text-[.85rem] font-semibold">
      <input {...props} className="w-auto min-h-0" type="checkbox" role="switch" aria-describedby={description === undefined ? undefined : descriptionId} />
      {label}
    </label>
    {description === undefined ? null : <Hint id={descriptionId}>{description}</Hint>}
  </div>
}
