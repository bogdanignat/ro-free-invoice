import { useId } from "react"

import { Button } from "../ui/Button.tsx"
import { Card } from "../ui/Card.tsx"
import { CardText } from "../ui/CardText.tsx"
import { Combobox } from "../ui/Combobox.tsx"
import { Field } from "../ui/Field.tsx"
import { Hint } from "../ui/Hint.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import { SegmentedControl } from "../ui/SegmentedControl.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"
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
  return <Card className="grid gap-4">
    <SectionHeading title="Cumpărător" description="Alege un client salvat sau completează un client folosit doar pe acest document." />
    <SegmentedControl legend="Sursa cumpărătorului" name="buyerMode" value={form.buyerMode} onChange={props.onBuyerModeChange}
      choices={[
        { value: "saved", label: "Client salvat", disabled: props.disabled || !picker.usable },
        { value: "one-time", label: "Client ocazional", disabled: props.disabled },
      ]} />
    {form.buyerMode === "saved" ? <div className="grid gap-4">
      {!picker.usable
        ? <StatusNote role={null}>Registrul este gol. Alege „Client ocazional” și continuă fără să salvezi clientul în registru.</StatusNote>
        : <Field label="Client" required labelId={labelId}>
          <Combobox {...search.field} required disabled={props.disabled} aria-labelledby={labelId} placeholder="Caută după nume sau cod fiscal"
            value={picker.value} suggest options={search.options} optionKey={customerKey} optionLabel={partyLabel}
            listLabel="Clienți găsiți" onPick={picker.pick} onClose={search.close} />
          {search.hint === undefined ? null : <Hint as="span" role="status">{search.hint}</Hint>}
        </Field>}
      {props.customersHasMore
        ? <CardText><Button variant="secondary" size="sm" disabled={props.customersLoadingMore} onClick={props.onCustomersLoadMore}>
          {props.customersLoadingMore ? "Se încarcă…" : "Încarcă mai mulți clienți"}
        </Button></CardText>
        : null}
      <Hint>Datele clientului ocazional rămân păstrate dacă schimbi temporar modul.</Hint>
    </div> : <BuyerOneTimeFields
      form={form} disabled={props.disabled} sectorRequired={props.sectorRequired}
      onChange={props.onChange} onPartyTypeChange={props.onPartyTypeChange}
      onCountyChange={props.onCountyChange} onFiscalIdentifierChange={props.onFiscalIdentifierChange}
      onSectorChange={props.onSectorChange}
    />}
  </Card>
}
