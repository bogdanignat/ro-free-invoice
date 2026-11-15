import type { InvoiceAuthoringForm, PartyType } from "../../lib/invoice-authoring-model.ts"
import { CompanyNameField } from "../company-lookup/CompanyNameField.tsx"
import { CompanyProposalCard } from "../company-lookup/CompanyProposalCard.tsx"
import { Checkbox } from "../ui/Checkbox.tsx"
import { Field } from "../ui/Field.tsx"
import { FormGrid } from "../ui/FormGrid.tsx"
import { Input } from "../ui/Input.tsx"
import { useCounties, useTextLimits } from "../../hooks/use-reference-data.ts"
import { SegmentedControl } from "../ui/SegmentedControl.tsx"
import { Select } from "../ui/Select.tsx"
import { identifierLabel } from "../../lib/document-authoring-transitions.ts"
import { romanianCuiPattern } from "../../lib/vat-defaults.ts"
import { oneTimeBuyerFill } from "../../lib/company-proposal-fill.ts"
import { useCompanyLookup } from "../../hooks/use-company-lookup.ts"

interface BuyerOneTimeFieldsProps {
  readonly form: InvoiceAuthoringForm
  readonly disabled: boolean
  readonly sectorRequired: boolean
  readonly onChange: (patch: Partial<InvoiceAuthoringForm>) => void
  readonly onPartyTypeChange: (partyType: PartyType) => void
  readonly onCountyChange: (county: string) => void
  readonly onFiscalIdentifierChange: (value: string) => void
  readonly onSectorChange: (sector: string) => void
}

/** The one-time (ad-hoc) buyer: a party typed on this document and never written to a registry; a company can be completed from its CUI. */
export const BuyerOneTimeFields = (props: BuyerOneTimeFieldsProps) => {
  const limits = useTextLimits()
  const counties = useCounties()
  const { form, disabled, sectorRequired } = props
  const { lookup, nameRef } = useCompanyLookup(form.partyType, form.partyType === "company")
  const fiscalIdentifier = form.partyType === "company" ? form.companyTaxIdentifier : form.individualTaxIdentifier
  return <FormGrid>
    <SegmentedControl legend="Tip persoană" name="partyType" className="col-span-full" value={form.partyType} onChange={props.onPartyTypeChange}
      choices={[
        { value: "company", label: "Persoană juridică (PJ)", disabled },
        { value: "individual", label: "Persoană fizică (PF)", disabled },
      ]} />
    <CompanyNameField lookup={lookup} inputRef={nameRef} label={form.partyType === "company" ? "Denumire" : "Nume complet"} value={form.name}
      disabled={disabled} maxLength={limits?.partyName} onChange={(name) => { props.onChange({ name }) }} />
    <Field label={identifierLabel(form.partyType)} optional={form.partyType === "individual"} required={form.partyType === "company"}>
      <Input value={fiscalIdentifier} required={form.partyType === "company"} disabled={disabled}
        pattern={form.partyType === "company" ? romanianCuiPattern : "(?:[0-9]{13})?"} maxLength={13}
        title={form.partyType === "company" ? "CUI românesc numeric; prefixul RO introdus este eliminat" : "CNP valid din 13 cifre sau câmp gol"}
        inputMode={form.partyType === "individual" ? "numeric" : "text"}
        onChange={(event) => { props.onFiscalIdentifierChange(event.currentTarget.value); lookup.typeCui(event.currentTarget.value) }} />
    </Field>
    <CompanyProposalCard lookup={lookup} vat="suggested" disabled={disabled}
      onApply={(proposal) => { props.onChange(oneTimeBuyerFill(form, proposal)) }} />
    {form.partyType === "company"
      ? <Checkbox checked={form.vatRegistered} disabled={disabled} onChange={(event) => { props.onChange({ vatRegistered: event.currentTarget.checked }) }}>
        Cumpărător înregistrat în scopuri de TVA
      </Checkbox>
      : null}
    <Field label="Țară"><Select value="RO" disabled><option value="RO">România (RO)</option></Select></Field>
    <Field label="Localitate" required>
      <Input required disabled={disabled} value={form.city} maxLength={limits?.city} onChange={(event) => { props.onChange({ city: event.currentTarget.value }) }} />
    </Field>
    <Field label="Stradă și număr" required className="col-span-full">
      <Input required disabled={disabled} value={form.street} maxLength={limits?.street} onChange={(event) => { props.onChange({ street: event.currentTarget.value }) }} />
    </Field>
    <Field label="Județ" required>
      <Select required disabled={disabled} value={form.county} onChange={(event) => { props.onCountyChange(event.currentTarget.value) }}>
        <option value="" disabled>Alege județul</option>
        {counties.map((county) => <option key={county.code} value={county.code}>{county.name}</option>)}
      </Select>
    </Field>
    {sectorRequired
      ? <Field label="Sector" required>
        <Select required disabled={disabled} value={form.sector ?? ""} onChange={(event) => { props.onSectorChange(event.currentTarget.value) }}>
          <option value="" disabled>Alege sectorul</option>
          {[1, 2, 3, 4, 5, 6].map((sector) => <option key={sector} value={sector}>Sector {sector}</option>)}
        </Select>
      </Field>
      : null}
    <Field label="Cod poștal" optional>
      <Input disabled={disabled} value={form.postalCode} maxLength={limits?.postalCode} onChange={(event) => { props.onChange({ postalCode: event.currentTarget.value }) }} />
    </Field>
  </FormGrid>
}
