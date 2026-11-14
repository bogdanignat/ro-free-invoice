import type { ReactNode } from "react"

import { cx } from "./cx.ts"

interface FieldProps {
  /** The label text; markers like "obligatorie" are stated by the caller as part of it or via the flags. */
  readonly label: ReactNode
  readonly required?: boolean
  readonly optional?: boolean
  readonly children: ReactNode
  readonly className?: string
  readonly htmlFor?: string
  /**
   * An id for the label text alone. A control that also renders content inside
   * the field (a combobox's listbox) names itself with `aria-labelledby` on it,
   * so its name is the label and not the options under it.
   */
  readonly labelId?: string
}

/**
 * A labelled form control on the shared design tokens: one place for the label
 * text, its optional/required marker and the wrapping layout class, so a field
 * reads the same everywhere the authoring form is built.
 */
export const Field = ({ label, required = false, optional = false, children, className, htmlFor, labelId }: FieldProps) =>
  <label className={cx("grid gap-[.42rem] text-invoice-label text-invoice-field font-invoice-label", className)} htmlFor={htmlFor}>
    <span id={labelId}>
      {label}
      {optional ? <span className="text-invoice-muted font-invoice-subtle"> opțional</span> : null}
      {required ? <span className="text-invoice-primary-hover font-bold"> obligatoriu</span> : null}
    </span>
    {children}
  </label>
