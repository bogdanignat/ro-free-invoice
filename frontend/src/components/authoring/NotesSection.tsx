import { Card } from "../ui/Card.tsx"
import { Hint } from "../ui/Hint.tsx"
import { Textarea } from "../ui/Textarea.tsx"

/** The document's free-text notes, with the length count (or the refusal) under them. */
export const NotesSection = ({ statusId, value, maxLength, issue, disabled, onChange }: {
  readonly statusId: string
  readonly value: string
  readonly maxLength: number
  readonly issue: string | null
  readonly disabled: boolean
  readonly onChange: (value: string) => void
}) => <Card className="grid gap-4">
  {/* Not `Field`: here the label text and "opțional" are separate grid items, so the marker sits on its own row. */}
  <label className="grid gap-[.42rem] text-invoice-label text-invoice-field font-invoice-label">Observații <span className="text-invoice-muted font-invoice-subtle">opțional</span>
    <Textarea disabled={disabled} maxLength={maxLength} rows={3}
      aria-describedby={statusId} aria-invalid={issue !== null}
      value={value} onChange={(event) => { onChange(event.currentTarget.value) }} />
  </label>
  <Hint tone={issue === null ? "neutral" : "warning"} id={statusId} aria-live="polite">
    {issue ?? `${String(value.length)}/${String(maxLength)}`}
  </Hint>
</Card>
