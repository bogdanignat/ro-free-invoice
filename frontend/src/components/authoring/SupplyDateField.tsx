import { Field } from "../ui/Field.tsx"
import { Hint } from "../ui/Hint.tsx"
import { Input } from "../ui/Input.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"

interface SupplyDateFieldProps {
  readonly value: string
  readonly issueDate: string
  /** The supply falls after the issue: the server refuses it. */
  readonly issue: string | null
  /** The legal issue term has passed; issuing stays open. */
  readonly warning: string | null
  readonly disabled: boolean
  readonly onChange: (value: string) => void
}

const HINT_ID = "invoice-supply-date-hint"
const ISSUE_ID = "invoice-supply-date-issue"
const WARNING_ID = "invoice-supply-date-warning"

/**
 * The invoice's supply date, left empty when it is the issue date. The notes
 * sit beside the label rather than in it, so the control's name stays the label.
 */
export const SupplyDateField = ({ value, issueDate, issue, warning, disabled, onChange }: SupplyDateFieldProps) => {
  const describedBy = [HINT_ID, issue === null ? null : ISSUE_ID, warning === null ? null : WARNING_ID]
    .filter((id) => id !== null).join(" ")
  return <div className="grid content-start gap-1">
    <Field label="Data livrării/prestării" optional>
      <Input disabled={disabled} type="date" max={issueDate} value={value}
        aria-invalid={issue === null ? undefined : true} aria-describedby={describedBy}
        onChange={(event) => { onChange(event.currentTarget.value) }} />
    </Field>
    <Hint id={HINT_ID}>Completezi doar dacă livrarea sau prestarea a fost înainte de data emiterii.</Hint>
    {issue === null ? null : <Hint tone="warning" id={ISSUE_ID} role="alert">{issue}</Hint>}
    {warning === null ? null : <StatusNote id={WARNING_ID}>{warning}</StatusNote>}
  </div>
}
