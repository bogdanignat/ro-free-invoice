import { useId, type ComponentPropsWithRef, type ReactNode } from "react"

import { Checkbox } from "./Checkbox.tsx"
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
    <Checkbox {...props} role="switch" aria-describedby={description === undefined ? undefined : descriptionId}>{label}</Checkbox>
    {description === undefined ? null : <Hint id={descriptionId}>{description}</Hint>}
  </div>
}
