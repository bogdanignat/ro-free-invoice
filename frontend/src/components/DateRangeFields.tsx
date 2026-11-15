import { useId, type ReactNode } from "react"

import { Field } from "./ui/Field.tsx"
import { Hint } from "./ui/Hint.tsx"
import { Input } from "./ui/Input.tsx"
import type { ReportRange } from "../lib/report-period.ts"

interface DateRangeFieldsProps {
  readonly range: ReportRange
  /** Why the interval is refused, announced and tied to both inputs; undefined when it is not. */
  readonly error: string | undefined
  readonly onEdit: (field: keyof ReportRange, value: string) => void
  readonly required?: boolean
  /** A standing note under the inputs (how the dates are applied), described by both inputs. */
  readonly hint?: string | undefined
  /** The earliest date the picker offers. */
  readonly min?: string | undefined
  /** Rendered after the inputs and before the error, e.g. an apply button. */
  readonly children?: ReactNode
}

const DATE_FIELD = "min-w-[10.5rem] narrow:min-w-0 narrow:flex-[1_1_9rem]"

/** The two dates of an interval, laid out by the caller's flex container. */
export const DateRangeFields = ({ range, error, onEdit, required = false, hint, min, children }: DateRangeFieldsProps) => {
  const hintId = useId()
  const errorId = useId()
  const refused = error !== undefined
  const describedIds = [...(hint === undefined ? [] : [hintId]), ...(refused ? [errorId] : [])]
  const described = describedIds.length === 0 ? undefined : describedIds.join(" ")
  return <>
    <Field label="De la" className={DATE_FIELD}>
      <Input type="date" value={range.from} required={required} min={min} aria-invalid={refused} aria-describedby={described}
        onChange={(event) => { onEdit("from", event.target.value) }} />
    </Field>
    <Field label="Până la" className={DATE_FIELD}>
      <Input type="date" value={range.to} required={required} min={min} aria-invalid={refused} aria-describedby={described}
        onChange={(event) => { onEdit("to", event.target.value) }} />
    </Field>
    {children}
    {hint === undefined ? null : <Hint id={hintId} className="basis-full">{hint}</Hint>}
    {refused ? <Hint tone="warning" id={errorId} role="alert" className="basis-full">{error}</Hint> : null}
  </>
}
