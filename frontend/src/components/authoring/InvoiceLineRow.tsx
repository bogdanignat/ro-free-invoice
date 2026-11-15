import type { EditableInvoiceLine } from "../../lib/invoice-authoring-model.ts"
import type { ProductPreset, UnitOfMeasure, VatCatalogue } from "../../lib/draft-models.ts"
import type { LineTotals } from "../../lib/draft-totals-preview.ts"
import { AUTHORING_CURRENCY } from "../../lib/document-authoring-form-model.ts"
import { Field } from "../ui/Field.tsx"
import { Hint } from "../ui/Hint.tsx"
import { Input } from "../ui/Input.tsx"
import { useTextLimits } from "../../hooks/use-reference-data.ts"
import { Select } from "../ui/Select.tsx"
import { Button } from "../ui/Button.tsx"
import { Combobox } from "../ui/Combobox.tsx"
import { useProductPresetSearch } from "../../hooks/use-registry-search.ts"
import { UnitOfMeasureOptions } from "../UnitOfMeasureOptions.tsx"
import { money } from "../../lib/money.ts"
import { vatTreatmentLabel } from "../../lib/vat-snapshots.ts"
import { barcodeIssue, itemCodeIssue } from "../../lib/item-identifiers.ts"
import { LineIdentifierField } from "./LineIdentifierField.tsx"

interface InvoiceLineRowProps {
  readonly line: EditableInvoiceLine
  readonly index: number
  /** The server's preview for this line; absent while it is incomplete or not answered yet. */
  readonly totals: LineTotals | undefined
  readonly productPresets: ReadonlyArray<ProductPreset>
  readonly vatRates: ReadonlyArray<VatCatalogue["rates"][number]>
  readonly unitOfMeasures: ReadonlyArray<UnitOfMeasure>
  readonly pending: boolean
  readonly onChange: (key: string, patch: Partial<EditableInvoiceLine>) => void
  readonly onApplyPreset: (lineKey: string, preset: ProductPreset) => void
  readonly onDelete: (line: EditableInvoiceLine) => void
}

const presetKey = (preset: ProductPreset): string => preset.id
const presetLabel = (preset: ProductPreset): string => `${preset.code} — ${preset.description} — ${money(preset.unitPrice, AUTHORING_CURRENCY)}`

/** One line of the document: preset prefill, the copied code and EAN (editable, may be cleared), amounts, unit and the VAT code resolved on the document date. */
export const InvoiceLineRow = (props: InvoiceLineRowProps) => {
  const limits = useTextLimits()
  const { line, index, productPresets, vatRates, unitOfMeasures, pending } = props
  const presets = useProductPresetSearch(productPresets)
  const lineNumber = String(index + 1)
  return <fieldset className="grid gap-[.9rem] m-0 p-4 border border-invoice-border rounded-invoice-control">
    <legend className="px-[.4rem] text-invoice-muted text-[.74rem] font-invoice-label">Linia {lineNumber}{line.lineId === undefined ? " — nesalvată" : ""}</legend>
    {productPresets.length === 0 ? null : <Field label="Produs predefinit">
      <Combobox {...presets.field} aria-label={`Produs predefinit, linia ${lineNumber}`} placeholder="Caută pentru precompletare" disabled={pending}
        value={presets.text ?? ""} suggest options={presets.options} optionKey={presetKey} optionLabel={presetLabel}
        listLabel={`Produse predefinite, linia ${lineNumber}`} onClose={presets.close}
        onPick={(preset) => { presets.restore(); props.onApplyPreset(line.key, preset) }} />
      {presets.hint === undefined ? null : <Hint as="span" role="status">{presets.hint}</Hint>}
    </Field>}
    <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
      <Field label="Descriere" required>
        <Input id={`line-${line.key}-description`} required disabled={pending} value={line.description} maxLength={limits?.lineDescription} onChange={(event) => { props.onChange(line.key, { description: event.currentTarget.value }) }} />
      </Field>
      <LineIdentifierField label="Cod articol" id={`line-${line.key}-code`} value={line.itemCode ?? ""} maxLength={50}
        issue={itemCodeIssue(line.itemCode ?? "")} disabled={pending}
        onChange={(itemCode) => { props.onChange(line.key, { itemCode }) }} />
      <LineIdentifierField label="EAN" id={`line-${line.key}-ean`} value={line.barcode ?? ""} maxLength={14} numeric
        issue={barcodeIssue(line.barcode ?? "")} disabled={pending}
        onChange={(barcode) => { props.onChange(line.key, { barcode }) }} />
      <Field label="Cantitate" required>
        <Input required disabled={pending} inputMode="decimal" value={line.quantity} onChange={(event) => { props.onChange(line.key, { quantity: event.currentTarget.value }) }} />
      </Field>
      <Field label="U.M." required>
        <Select required disabled={pending} value={line.unitOfMeasure.code}
          onChange={(event) => {
            const selected = unitOfMeasures.find(({ code }) => code === event.currentTarget.value)
            if (selected !== undefined) props.onChange(line.key, { unitOfMeasure: selected })
          }}>
          <option value="" disabled>Alege U.M.</option>
          <UnitOfMeasureOptions units={unitOfMeasures} />
        </Select>
      </Field>
      <Field label="Preț unitar fără TVA" required>
        <Input required disabled={pending} inputMode="decimal" value={line.unitPrice} onChange={(event) => { props.onChange(line.key, { unitPrice: event.currentTarget.value }) }} />
      </Field>
      <Field label="TVA" required>
        <Select required disabled={pending} value={line.vatRateCode} onChange={(event) => { props.onChange(line.key, { vatRateCode: event.currentTarget.value }) }}>
          <option value="" disabled>Alege TVA</option>
          {vatRates.map((tax) => <option key={`${tax.code}-${tax.effectiveFrom}`} value={tax.code}>{vatTreatmentLabel(tax)}</option>)}
        </Select>
      </Field>
    </div>
    {props.totals === undefined ? null : <Hint>
      Total linie: {money(props.totals.totalIncludingVat, AUTHORING_CURRENCY)} cu TVA ({money(props.totals.totalExcludingVat, AUTHORING_CURRENCY)} fără TVA)
    </Hint>}
    <div className="flex justify-end">
      <Button variant="danger" size="sm" aria-label={`Șterge linia ${lineNumber}: ${line.description || "linie fără descriere"}`}
        disabled={pending} onClick={() => { props.onDelete(line) }}>Șterge linia</Button>
    </div>
  </fieldset>
}
