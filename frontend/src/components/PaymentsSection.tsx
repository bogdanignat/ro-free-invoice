import { Badge } from "./ui/Badge.tsx"
import { Button } from "./ui/Button.tsx"
import { ButtonRow } from "./ui/ButtonRow.tsx"
import { Card } from "./ui/Card.tsx"
import { EmptyState, ErrorAlert, Loading } from "./AsyncState.tsx"
import { FactList } from "./ui/FactList.tsx"
import { Field } from "./ui/Field.tsx"
import { FormGrid } from "./ui/FormGrid.tsx"
import { Input } from "./ui/Input.tsx"
import { ListItem } from "./ui/ListItem.tsx"
import { SectionHeading } from "./ui/SectionHeading.tsx"
import { Select } from "./ui/Select.tsx"
import { StatusNote } from "./ui/StatusNote.tsx"
import { Textarea } from "./ui/Textarea.tsx"
import type { InvoicePaymentsModel } from "../hooks/invoice-payments-query.ts"
import { ORGANIZATION_TIME_ZONE, todayIn } from "../lib/format.ts"
import { OVERPAID_NOTE, PAYMENT_METHODS } from "../lib/payment-state.ts"

/**
 * The payments of an issued invoice, rendered from the model: which rows may
 * be reversed, whether the form is offered and what the totals read are all
 * decided in `payment-state.ts`. The form is uncontrolled and keyed on the
 * paid amount, so every recorded payment remounts it with the new balance as
 * its default instead of the one it was first rendered with.
 */
export const PaymentsSection = ({ payments }: { readonly payments: InvoicePaymentsModel }) => {
  const { view } = payments
  return <Card>
    <SectionHeading eyebrow="Încasări" title="Plăți"
      aside={view === undefined ? undefined : <Badge tone={view.statusTone}>{view.statusLabel}</Badge>} />
    {view === undefined
      ? payments.isPending
        ? <Loading label="Se încarcă plățile…" />
        : <ErrorAlert error={payments.error} onRetry={payments.retry} />
      : <>
        <FactList layout="payments" items={[
          { label: "Încasat", value: view.paid }, { label: "Stornat", value: view.credited }, { label: "Rămas", value: view.remaining },
        ]} />
        {payments.notice === undefined ? null : <StatusNote>{payments.notice}</StatusNote>}
        {payments.error === null || payments.error === undefined
          ? null
          : <ErrorAlert error={payments.error} onRetry={payments.retry} />}
        {view.rows.length === 0
          ? <EmptyState>Nu există plăți înregistrate.</EmptyState>
          : <div>
            {view.rows.map((row) => <ListItem key={row.id} muted={row.isReversal} actions={row.canReverse
              ? <Button variant="secondary" size="sm" aria-label={row.reverseLabel} disabled={payments.pending} onClick={() => { payments.reverse(row.id) }}>
                Anulează
              </Button>
              : undefined}>
              <strong>{row.amount}</strong>
              <small>{row.caption}</small>
              {row.reference === undefined ? null : <small>{row.reference}</small>}
              {row.note === undefined ? null : <small>{row.note}</small>}
            </ListItem>)}
          </div>}
        {view.isOverpaid
          ? <StatusNote tone="warning" role={null}>{OVERPAID_NOTE}</StatusNote>
          : null}
        {view.closedNote === undefined ? null : <StatusNote role={null}>{view.closedNote}</StatusNote>}
        {view.canRecordPayment
          ? <details>
            <summary>Înregistrează o plată</summary>
            <form className="grid gap-5" key={view.formKey} onSubmit={(event) => { event.preventDefault(); payments.record(new FormData(event.currentTarget)) }}>
              <FormGrid>
                <Field label="Sumă" required>
                  <Input name="amount" inputMode="decimal" defaultValue={view.remainingAmount} required />
                </Field>
                <Field label="Data plății" required>
                  <Input name="paymentDate" type="date" defaultValue={todayIn(ORGANIZATION_TIME_ZONE)} required />
                </Field>
                <Field label="Metodă" required>
                  <Select name="method" defaultValue="transfer" required>
                    {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                  </Select>
                </Field>
                <Field label="Referință" optional>
                  <Input name="externalReference" />
                </Field>
                <Field label="Notă" optional className="col-span-full">
                  <Textarea name="note" rows={2} />
                </Field>
              </FormGrid>
              <ButtonRow>
                <Button type="submit" disabled={payments.pending}>{payments.pending ? "Se salvează…" : "Salvează plata"}</Button>
              </ButtonRow>
            </form>
          </details>
          : view.isOverpaid || view.closedNote !== undefined
            ? null
            : <StatusNote role={null}>Soldul facturii este închis; nu mai sunt necesare plăți.</StatusNote>}
      </>}
  </Card>
}
