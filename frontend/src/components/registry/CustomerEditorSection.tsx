import { Button } from "../ui/Button.tsx"
import { ButtonRow } from "../ui/ButtonRow.tsx"
import { Card } from "../ui/Card.tsx"
import { CustomerAddressFields } from "./CustomerAddressFields.tsx"
import { CustomerIdentityFields } from "./CustomerIdentityFields.tsx"
import { ErrorAlert } from "../AsyncState.tsx"
import { Field } from "../ui/Field.tsx"
import { FieldIssue } from "./FieldIssue.tsx"
import { Fieldset } from "../ui/Fieldset.tsx"
import { FormGrid } from "../ui/FormGrid.tsx"
import { Input } from "../ui/Input.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import { useEditorHeadingFocus } from "../../hooks/use-editor-heading-focus.ts"
import { useRefusedFieldFocus } from "../../hooks/use-refused-field-focus.ts"
import { CUSTOMER_FORM, registryFieldAria } from "../../lib/registry-fields.ts"
import type { CustomerField } from "../../lib/customer-payload.ts"
import type { CustomerForm } from "../../lib/customer-form.ts"
import type { PartyType } from "../../lib/document-authoring-form-model.ts"
import type { RegistryEditorIssue } from "../../hooks/use-registry-editor.ts"

interface CustomerEditorSectionProps {
  readonly form: CustomerForm
  /** The customer being edited; absent while a new one is created. */
  readonly editingId: string | undefined
  readonly sectorRequired: boolean
  readonly issue: RegistryEditorIssue<CustomerField> | undefined
  readonly pending: boolean
  readonly error: unknown
  readonly onChange: (patch: Partial<CustomerForm>) => void
  readonly onPartyTypeChange: (partyType: PartyType) => void
  readonly onIdentifierChange: (value: string) => void
  readonly onCountyChange: (county: string) => void
  readonly onSubmit: () => void
  readonly onClose: () => void
}

// One party type as a pill; the checked one takes the primary tint.
const CHOICE = "flex gap-[.4rem] items-center px-[.8rem] py-[.45rem] border border-invoice-control-border rounded-invoice-control"
  + " text-[.85rem] font-semibold cursor-pointer has-checked:border-invoice-primary has-checked:bg-invoice-primary-soft"

/** The customer editor: the party, its identity (completable from a CUI), its address and the payment term. */
export const CustomerEditorSection = (props: CustomerEditorSectionProps) => {
  const { editingId, form, issue, pending } = props
  const headingRef = useEditorHeadingFocus(editingId ?? "new")
  useRefusedFieldFocus(CUSTOMER_FORM, issue?.field)
  const aria = registryFieldAria(CUSTOMER_FORM, issue?.field)
  const company = form.partyType === "company"
  return <Card>
    <SectionHeading titleRef={headingRef} title={editingId === undefined ? "Client nou" : "Editezi clientul"}
      description="Datele sunt copiate pe document în momentul emiterii." />
    {props.error === null || props.error === undefined ? null : <ErrorAlert error={props.error} />}
    <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); props.onSubmit() }}>
      <FormGrid>
        <Fieldset legend="Tip persoană" className="col-span-full"><div className="flex flex-wrap gap-[.4rem]">
          <label className={CHOICE}><input className="w-auto min-h-0" type="radio" name="customerPartyType" value="company" checked={company} disabled={pending}
            onChange={() => { props.onPartyTypeChange("company") }} /><span>Persoană juridică (PJ)</span></label>
          <label className={CHOICE}><input className="w-auto min-h-0" type="radio" name="customerPartyType" value="individual" checked={!company} disabled={pending}
            onChange={() => { props.onPartyTypeChange("individual") }} /><span>Persoană fizică (PF)</span></label>
        </div></Fieldset>
        <CustomerIdentityFields form={form} editingId={editingId} disabled={pending} issue={issue} aria={aria}
          onChange={props.onChange} onIdentifierChange={props.onIdentifierChange} />
        <CustomerAddressFields form={form} disabled={pending} sectorRequired={props.sectorRequired}
          issue={issue} aria={aria} onChange={props.onChange} onCountyChange={props.onCountyChange} />
        <Field label="Termen de plată (zile)" optional>
          <Input disabled={pending} value={form.defaultPaymentTermDays} inputMode="numeric" pattern="[0-9]*"
            {...aria("defaultPaymentTermDays")}
            title="Număr întreg de zile, între 0 și 3650"
            onChange={(event) => { props.onChange({ defaultPaymentTermDays: event.currentTarget.value }) }} />
          <FieldIssue issue={issue} field="defaultPaymentTermDays" form={CUSTOMER_FORM} />
        </Field>
      </FormGrid>
      <ButtonRow>
        <Button type="submit" disabled={pending}>{pending ? "Se salvează…" : "Salvează clientul"}</Button>
        <Button variant="secondary" disabled={pending} onClick={props.onClose}>Renunță</Button>
      </ButtonRow>
    </form>
  </Card>
}
