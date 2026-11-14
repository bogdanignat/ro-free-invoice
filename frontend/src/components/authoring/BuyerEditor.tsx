import { useId } from "react"

import { Button } from "../Button.tsx"
import { Combobox } from "../ui/Combobox.tsx"
import { Field } from "../ui/Field.tsx"
import { BuyerOneTimeFields } from "./BuyerOneTimeFields.tsx"
import { partyLabel, useCustomerPicker } from "../../hooks/use-customer-picker.ts"
import type { SavedBuyer } from "../../hooks/invoice-authoring-session-types.ts"
import type { BuyerMode, InvoiceAuthoringForm, PartyType } from "../../lib/invoice-authoring-model.ts"
import type { Customer } from "../../lib/draft-models.ts"

interface BuyerEditorProps {
  readonly form: InvoiceAuthoringForm
  readonly customers: ReadonlyArray<Customer>
  /** The saved customer the draft was written for, even when the paged registry has not reached it yet. */
  readonly savedBuyer: SavedBuyer | undefined
  /** The customer last picked here, held by the session so it outlives this component. */
  readonly chosenCustomer: Customer | undefined
  readonly customersHasMore: boolean
  readonly customersLoadingMore: boolean
  readonly onCustomersLoadMore: () => void
  readonly disabled: boolean
  readonly sectorRequired: boolean
  readonly onChange: (patch: Partial<InvoiceAuthoringForm>) => void
  readonly onBuyerModeChange: (buyerMode: BuyerMode) => void
  readonly onSavedCustomerChange: (customer: Customer) => void
  readonly onPartyTypeChange: (partyType: PartyType) => void
  readonly onCountyChange: (county: string) => void
  readonly onFiscalIdentifierChange: (value: string) => void
  readonly onSectorChange: (sector: string) => void
}

const customerKey = (customer: Customer): string => customer.id

/** The buyer half of the authoring form: a saved customer or a one-time party, never a registry write. */
export const BuyerEditor = (props: BuyerEditorProps) => {
  const { form } = props
  const labelId = useId()
  const picker = useCustomerPicker(form, props.customers, props.savedBuyer, props.chosenCustomer, props.onSavedCustomerChange)
  const { search } = picker
  return <section className="card authoring-section">
    <div className="section-heading"><div><h2>Cumpărător</h2><p>Alege un client salvat sau completează un client folosit doar pe acest document.</p></div></div>
    <fieldset className="segmented-fieldset"><legend>Sursa cumpărătorului</legend><div className="segmented-control">
      <label><input type="radio" name="buyerMode" value="saved" checked={form.buyerMode === "saved"} disabled={props.disabled || !picker.usable} onChange={() => { props.onBuyerModeChange("saved") }} /><span>Client salvat</span></label>
      <label><input type="radio" name="buyerMode" value="one-time" checked={form.buyerMode === "one-time"} disabled={props.disabled} onChange={() => { props.onBuyerModeChange("one-time") }} /><span>Client ocazional</span></label>
    </div></fieldset>
    {form.buyerMode === "saved" ? <div className="authoring-section">
      {!picker.usable
        ? <p className="status-note">Registrul este gol. Alege „Client ocazional” și continuă fără să salvezi clientul în registru.</p>
        : <Field label="Client" required labelId={labelId}>
          <Combobox {...search.field} required disabled={props.disabled} aria-labelledby={labelId} placeholder="Caută după nume sau cod fiscal"
            value={picker.value} suggest options={search.options} optionKey={customerKey} optionLabel={partyLabel}
            listLabel="Clienți găsiți" onPick={picker.pick} onClose={search.close} />
          {search.hint === undefined ? null : <span className="hint" role="status">{search.hint}</span>}
        </Field>}
      {props.customersHasMore
        ? <p><Button className="secondary small" disabled={props.customersLoadingMore} onClick={props.onCustomersLoadMore}>
          {props.customersLoadingMore ? "Se încarcă…" : "Încarcă mai mulți clienți"}
        </Button></p>
        : null}
      <p className="hint">Datele clientului ocazional rămân păstrate dacă schimbi temporar modul.</p>
    </div> : <BuyerOneTimeFields
      form={form} disabled={props.disabled} sectorRequired={props.sectorRequired}
      onChange={props.onChange} onPartyTypeChange={props.onPartyTypeChange}
      onCountyChange={props.onCountyChange} onFiscalIdentifierChange={props.onFiscalIdentifierChange}
      onSectorChange={props.onSectorChange}
    />}
  </section>
}
