import { Button } from "../ui/Button.tsx"
import { ButtonRow } from "../ui/ButtonRow.tsx"
import { Card } from "../ui/Card.tsx"
import { UnitOfMeasureOptions } from "../UnitOfMeasureOptions.tsx"
import { ErrorAlert } from "../AsyncState.tsx"
import { Field } from "../ui/Field.tsx"
import { FormGrid } from "../ui/FormGrid.tsx"
import { Input } from "../ui/Input.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import { useTextLimits } from "../../hooks/use-reference-data.ts"
import { Select } from "../ui/Select.tsx"
import { FieldIssue } from "./FieldIssue.tsx"
import { useEditorHeadingFocus } from "../../hooks/use-editor-heading-focus.ts"
import { useRefusedFieldFocus } from "../../hooks/use-refused-field-focus.ts"
import { PRODUCT_FORM, registryFieldAria } from "../../lib/registry-fields.ts"
import {
  PRODUCT_PRICE_PATTERN, productKindLabels, type ProductPresetField, type ProductPresetForm,
} from "../../lib/product-preset-form.ts"
import type { PresetVatOption } from "../../lib/product-preset-vat.ts"
import type { RegistryEditorIssue } from "../../hooks/use-registry-editor.ts"
import type { ProductKind, UnitOfMeasure } from "../../lib/draft-models.ts"

interface ProductPresetEditorSectionProps {
  readonly form: ProductPresetForm
  /** The product being edited; absent while a new one is created. */
  readonly editingId: string | undefined
  readonly units: ReadonlyArray<UnitOfMeasure>
  readonly vatOptions: ReadonlyArray<PresetVatOption>
  readonly issue: RegistryEditorIssue<ProductPresetField> | undefined
  readonly pending: boolean
  readonly error: unknown
  readonly onChange: (patch: Partial<ProductPresetForm>) => void
  readonly onSubmit: () => void
  readonly onClose: () => void
}

/** The product editor: one controlled form, and the refusal the model named. */
export const ProductPresetEditorSection = (props: ProductPresetEditorSectionProps) => {
  const limits = useTextLimits()
  const { editingId, form, issue, pending } = props
  const headingRef = useEditorHeadingFocus(editingId ?? "new")
  useRefusedFieldFocus(PRODUCT_FORM, issue?.field)
  const aria = registryFieldAria(PRODUCT_FORM, issue?.field)
  const refusal = (field: ProductPresetField) => <FieldIssue issue={issue} field={field} form={PRODUCT_FORM} />
  return <Card>
    <SectionHeading titleRef={headingRef} title={editingId === undefined ? "Produs nou" : "Editezi produsul"}
      description="Prețul se scrie fără TVA, cu maximum două zecimale." />
    {props.error === null || props.error === undefined ? null : <ErrorAlert error={props.error} />}
    <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); props.onSubmit() }}>
      <FormGrid>
        <Field label="Cod articol" required>
          <Input required disabled={pending} value={form.code} maxLength={50} {...aria("code")}
            onChange={(event) => { props.onChange({ code: event.currentTarget.value }) }} />
          {refusal("code")}
        </Field>
        <Field label="Tip" required>
          <Select required disabled={pending} value={form.kind}
            onChange={(event) => { props.onChange({ kind: event.currentTarget.value as ProductKind }) }}>
            {Object.entries(productKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Descriere" required className="col-span-full">
          <Input required disabled={pending} value={form.description} maxLength={limits?.lineDescription} {...aria("description")}
            onChange={(event) => { props.onChange({ description: event.currentTarget.value }) }} />
          {refusal("description")}
        </Field>
        <Field label="Unitate de măsură" required>
          <Select required disabled={pending} value={form.unitOfMeasureCode} {...aria("unitOfMeasure")}
            onChange={(event) => { props.onChange({ unitOfMeasureCode: event.currentTarget.value }) }}>
            <option value="" disabled>Alege unitatea</option>
            <UnitOfMeasureOptions units={props.units} />
          </Select>
          {refusal("unitOfMeasure")}
        </Field>
        <Field label="Preț unitar (RON, fără TVA)" required>
          <Input required disabled={pending} value={form.unitPrice} inputMode="decimal"
            pattern={PRODUCT_PRICE_PATTERN} {...aria("unitPrice")}
            title="Număr nenegativ cu maximum două zecimale"
            onChange={(event) => { props.onChange({ unitPrice: event.currentTarget.value }) }} />
          {refusal("unitPrice")}
        </Field>
        <Field label="EAN">
          <Input disabled={pending} value={form.barcode} inputMode="numeric" maxLength={14} {...aria("barcode")}
            title="GTIN de 8, 12, 13 sau 14 cifre"
            onChange={(event) => { props.onChange({ barcode: event.currentTarget.value }) }} />
          {refusal("barcode")}
        </Field>
        <Field label="Cotă TVA preferată" className="col-span-full">
          <Select disabled={pending} value={form.preferredVatRateCode} {...aria("preferredVatRateCode")}
            onChange={(event) => { props.onChange({ preferredVatRateCode: event.currentTarget.value }) }}>
            {props.vatOptions.map((option) =>
              <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          {refusal("preferredVatRateCode")}
        </Field>
      </FormGrid>
      <ButtonRow>
        <Button type="submit" disabled={pending}>{pending ? "Se salvează…" : "Salvează produsul"}</Button>
        <Button variant="secondary" disabled={pending} onClick={props.onClose}>Renunță</Button>
      </ButtonRow>
    </form>
  </Card>
}
