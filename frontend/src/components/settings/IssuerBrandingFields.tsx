import { Button } from "../ui/Button.tsx"
import { Field } from "../ui/Field.tsx"
import { FieldIssue } from "../registry/FieldIssue.tsx"
import { Fieldset } from "../ui/Fieldset.tsx"
import { FormGrid } from "../ui/FormGrid.tsx"
import { Hint } from "../ui/Hint.tsx"
import { Input } from "../ui/Input.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"
import { ISSUER_BRAND_TEXT_MAX_CODE_POINTS } from "../../lib/issuer-branding.ts"
import { ISSUER_FORM, registryFieldId, type RegistryFieldAria } from "../../lib/registry-fields.ts"
import type { IssuerBrandingModel } from "../../hooks/use-issuer-branding.ts"
import type { IssuerField } from "../../lib/issuer-payload.ts"
import type { IssuerSettingsForm } from "../../lib/issuer-form.ts"
import type { RegistryEditorIssue } from "../../hooks/use-registry-editor.ts"

interface IssuerBrandingFieldsProps {
  readonly form: IssuerSettingsForm
  readonly disabled: boolean
  readonly branding: IssuerBrandingModel
  readonly issue: RegistryEditorIssue<IssuerField> | undefined
  readonly aria: (field: IssuerField) => RegistryFieldAria
  readonly onChange: (patch: Partial<IssuerSettingsForm>) => void
  /** Text and logo in one action; the model clears both. */
  readonly onClearBranding: () => void
}

/**
 * The optional brand on the document: a line of text, a logo, or both.
 *
 * The file input is cleared after every choice so the same file can be chosen
 * again after it was refused — a `change` event does not fire for an unchanged
 * value. Everything the file has to satisfy is decided in the model; what is
 * rendered here is the preview, the refusal and the two ways out of it.
 *
 * A refused file marks the control itself: `role="alert"` announces the sentence
 * once, when it appears, and nothing again to someone who tabs back to the
 * input — so the input is `aria-invalid` and describes itself by that message
 * for as long as it stands, as the legacy screen did.
 */
export const IssuerBrandingFields = (props: IssuerBrandingFieldsProps) => {
  const { branding, disabled, issue, aria } = props
  const image = branding.image
  const imageAria = aria("brandImage")
  const hintId = `${registryFieldId(ISSUER_FORM, "brandImage")}-hint`
  const refusedId = `${registryFieldId(ISSUER_FORM, "brandImage")}-refused`
  const refused = branding.imageIssue !== undefined
  return <Fieldset className="grid gap-[.8rem]"
    legend={<>Brand documente <span className="text-invoice-muted font-invoice-subtle">opțional</span></>}>
    <FormGrid>
      <Field label="Text de brand" optional className="col-span-full">
        <Input disabled={disabled} value={props.form.brandText} {...aria("brandText")}
          maxLength={ISSUER_BRAND_TEXT_MAX_CODE_POINTS}
          onChange={(event) => { props.onChange({ brandText: event.currentTarget.value }) }} />
        <FieldIssue issue={issue} field="brandText" form={ISSUER_FORM} />
      </Field>
    </FormGrid>
    <Field label="Siglă PNG sau JPEG" optional htmlFor={registryFieldId(ISSUER_FORM, "brandImage")}>
      <Input type="file" accept="image/png,image/jpeg" disabled={disabled} {...imageAria}
        aria-invalid={refused ? true : imageAria["aria-invalid"]}
        aria-describedby={[hintId, imageAria["aria-describedby"], refused ? refusedId : undefined]
          .filter(Boolean).join(" ")}
        onChange={(event) => {
          branding.select(event.currentTarget.files?.[0])
          event.currentTarget.value = ""
        }} />
    </Field>
    <Hint id={hintId}>
      Maximum 256 KiB, 2048 px pe axă și 4 megapixeli.
    </Hint>
    <FieldIssue issue={issue} field="brandImage" form={ISSUER_FORM} />
    {branding.imageIssue === undefined
      ? null
      : <Hint tone="warning" role="alert" id={refusedId}>{branding.imageIssue} <Button variant="secondary" size="sm"
        onClick={branding.discardRefused}>Renunță la fișierul respins</Button></Hint>}
    {branding.pending ? <StatusNote>Se validează imaginea…</StatusNote> : null}
    {image === null
      ? null
      : <div className="flex flex-wrap gap-[.8rem] items-center p-[.8rem] border border-invoice-border rounded-invoice-control bg-invoice-secondary-surface">
        <img className="max-w-[min(18rem,100%)] h-auto" src={image.previewUrl} alt="Sigla curentă" width={image.width} height={image.height} />
        <Button variant="secondary" size="sm" disabled={disabled} onClick={branding.remove}>Elimină sigla</Button>
      </div>}
    {props.form.brandText === "" && image === null
      ? null
      : <Button variant="danger" size="sm" disabled={disabled}
        onClick={props.onClearBranding}>Elimină tot brandingul</Button>}
  </Fieldset>
}
