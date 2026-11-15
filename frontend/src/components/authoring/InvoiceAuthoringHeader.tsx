import type { InvoiceAuthoringSession } from "../../hooks/invoice-authoring-session-types.ts"
import { BuyerEditor } from "./BuyerEditor.tsx"
import { Card } from "../ui/Card.tsx"
import { Field } from "../ui/Field.tsx"
import { Input } from "../ui/Input.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import { Select } from "../ui/Select.tsx"
import { StaticField } from "../ui/StaticField.tsx"
import { SupplyDateField } from "./SupplyDateField.tsx"

/**
 * The document head: identity, series, dates and currency, next to the issuer
 * the invoice will be signed by. The series stays a choice while the draft is
 * open; a series archived since the draft was saved is still listed, marked,
 * until another one is chosen.
 */
export const InvoiceAuthoringHeader = ({ session }: { readonly session: InvoiceAuthoringSession }) => {
  const { actions, document, feedback, status } = session
  return <Card as="div" className="grid gap-4">
    <SectionHeading title={document.draft === undefined ? "Document nou" : `Draft ${document.draft.series}`}
      description="Numărul se alocă la emitere. Totalurile sunt calculate de server la fiecare salvare." />
    <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
      <Field label="Serie factură" required>
        <Select required disabled={status.pending} value={document.form.series}
          aria-describedby={feedback.seriesWarning === undefined ? undefined : "invoice-series-warning"}
          onChange={(event) => { actions.changeForm({ series: event.currentTarget.value }) }}>
          {document.seriesChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        </Select>
      </Field>
      <Field label="Data emiterii" required>
        <Input required disabled={status.pending} type="date" value={document.form.issueDate}
          onChange={(event) => { actions.chooseIssueDate(event.currentTarget.value) }} />
      </Field>
      <Field label="Data scadenței" required={status.dueDateRequired} optional={!status.dueDateRequired}>
        <Input disabled={status.pending} type="date" min={document.form.issueDate} value={document.form.dueDate}
          aria-required={status.dueDateRequired}
          aria-describedby={feedback.dueDateIssue === null ? undefined : "invoice-due-date-issue"}
          onChange={(event) => { actions.chooseDueDate(event.currentTarget.value) }} />
      </Field>
      <SupplyDateField value={document.form.supplyDate} issueDate={document.form.issueDate}
        issue={feedback.supplyDateIssue} warning={feedback.supplyDateWarning} disabled={status.pending}
        onChange={(supplyDate) => { actions.changeForm({ supplyDate }) }} />
      <StaticField label="Monedă">RON</StaticField>
    </div>
    <BuyerEditor
      form={document.form} customers={document.customers} chosenCustomer={document.chosenCustomer} savedBuyer={document.savedBuyer}
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
