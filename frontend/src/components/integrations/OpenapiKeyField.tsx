import { Button } from "../ui/Button.tsx"
import { ButtonRow } from "../ui/ButtonRow.tsx"
import { Field } from "../ui/Field.tsx"
import { Hint } from "../ui/Hint.tsx"
import { Input } from "../ui/Input.tsx"
import type { OpenapiKeyEditor } from "../../hooks/use-company-lookup-settings.ts"
import { useFocusOnReturn } from "../../hooks/use-focus-on-return.ts"
import { keyStatus, type CompanyLookupSettings } from "../../lib/company-lookup-settings.ts"

interface OpenapiKeyFieldProps {
  readonly settings: CompanyLookupSettings
  readonly editor: OpenapiKeyEditor
  readonly disabled: boolean
}

/**
 * The openapi.ro key, write-only: once stored it is shown only by its last four
 * characters, and replaced or deleted, never read back into the field.
 */
export const OpenapiKeyField = ({ settings, editor, disabled }: OpenapiKeyFieldProps) => {
  // "Renunță" and a saved replacement both close the field: the keyboard goes back to "Înlocuiește".
  const replaceButton = useFocusOnReturn<HTMLButtonElement>(!editor.editing, !disabled)
  return <div className="grid gap-3">
  <h3 className="m-0 text-invoice-muted text-invoice-field font-extrabold tracking-[.1em] uppercase">Cheia openapi.ro</h3>
  <Hint>{keyStatus(settings)}</Hint>
  {editor.editing ? <KeyForm editor={editor} disabled={disabled} /> : <ButtonRow>
    <Button ref={replaceButton} variant="secondary" size="sm" disabled={disabled} onClick={editor.startReplace}>
      Înlocuiește<span className="sr-only"> cheia openapi.ro</span>
    </Button>
    <Button variant="danger" size="sm" disabled={disabled} onClick={editor.clear}>
      Șterge<span className="sr-only"> cheia openapi.ro</span>
    </Button>
  </ButtonRow>}
  {settings.provider === "openapi" && !editor.editing
    ? <Hint>Ștergerea cheii oprește și openapi.ro.</Hint>
    : null}
  </div>
}

const KeyForm = ({ editor, disabled }: { readonly editor: OpenapiKeyEditor; readonly disabled: boolean }) =>
  <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); editor.save() }}>
    <Field label={editor.replacing ? "Cheie nouă" : "Cheie"} required>
      <Input type="password" required disabled={disabled} value={editor.draft} autoComplete="off"
        spellCheck={false} autoFocus={editor.replacing}
        onChange={(event) => { editor.change(event.currentTarget.value) }} />
    </Field>
    <Hint>Cheia se păstrează criptată pe server și nu mai poate fi afișată după salvare.</Hint>
    <ButtonRow>
      <Button variant="secondary" type="submit" disabled={disabled}>{disabled ? "Se salvează…" : "Salvează cheia"}</Button>
      {editor.replacing ? <Button variant="secondary" disabled={disabled} onClick={editor.cancelReplace}>Renunță</Button> : null}
    </ButtonRow>
  </form>
