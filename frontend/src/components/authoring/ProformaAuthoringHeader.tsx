import type { ProformaAuthoringSession } from "../../hooks/proforma-authoring-session-types.ts"
import { BuyerEditor } from "./BuyerEditor.tsx"
import { Card } from "../ui/Card.tsx"
import { Field } from "../ui/Field.tsx"
import { Hint } from "../ui/Hint.tsx"
import { Input } from "../ui/Input.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import { Select } from "../ui/Select.tsx"
import { StaticField } from "../ui/StaticField.tsx"

/**
 * The proforma's head: series, dates and currency, then the buyer.
 *
 * The series starts on the catalogue's first entry (`use-proforma-authoring-session.ts:38`)
 * and the empty option exists only for a catalogue that offers none; an
 * organisation with several proforma series therefore has to change it
 * deliberately. The due date stays optional, but the note under it says what
 * leaving it out costs later.
 */
export const ProformaAuthoringHeader = ({ session }: { readonly session: ProformaAuthoringSession }) => {
  const { actions, document, feedback, status } = session
  return <Card as="div" className="grid gap-4">
    <SectionHeading title="Proformă nouă" description="Numărul se alocă la salvare. Totalurile sunt calculate de server." />
    <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
      <Field label="Serie proformă" required>
        <Select required disabled={status.pending} value={document.form.series}
          onChange={(event) => { actions.changeForm({ series: event.currentTarget.value }) }}>
          <option value="" disabled>Alege seria</option>
          {document.proformaSeries.map((series) => <option key={series} value={series}>{series}</option>)}
        </Select>
      </Field>
      <Field label="Data emiterii" required>
        <Input required disabled={status.pending} type="date" value={document.form.issueDate}
          onChange={(event) => { actions.chooseIssueDate(event.currentTarget.value) }} />
      </Field>
      <Field label="Data scadenței" optional>
        <Input disabled={status.pending} type="date" min={document.form.issueDate} value={document.form.dueDate}
          aria-describedby={feedback.dueDateNote === null ? undefined : "proforma-due-date-note"}
          onChange={(event) => { actions.chooseDueDate(event.currentTarget.value) }} />
      </Field>
      <StaticField label="Monedă">RON</StaticField>
    </div>
    {feedback.dueDateNote === null
      ? null
      : <Hint id="proforma-due-date-note" aria-live="polite">{feedback.dueDateNote}</Hint>}
    <BuyerEditor
      form={document.form} customers={document.customers} chosenCustomer={document.chosenCustomer} savedBuyer={undefined}
      customersHasMore={document.customersHasMore} customersLoadingMore={document.customersLoadingMore}
      onCustomersLoadMore={document.customersLoadMore}
      disabled={status.pending} sectorRequired={document.buyerSectorRequired}
      onChange={actions.changeForm} onBuyerModeChange={actions.chooseBuyerMode}
      onSavedCustomerChange={actions.chooseCustomer} onPartyTypeChange={actions.choosePartyType}
      onCountyChange={actions.chooseCounty} onFiscalIdentifierChange={actions.changeFiscalIdentifier}
      onSectorChange={actions.chooseSector}
    />
  </Card>
}
