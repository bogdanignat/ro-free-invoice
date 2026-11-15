import { AppLink } from "./ui/AppLink.tsx"
import { Button } from "./ui/Button.tsx"
import { ButtonRow } from "./ui/ButtonRow.tsx"
import { Card } from "./ui/Card.tsx"
import { EmptyState, ErrorAlert, Loading } from "./AsyncState.tsx"
import { Field } from "./ui/Field.tsx"
import { FormGrid } from "./ui/FormGrid.tsx"
import { Hint } from "./ui/Hint.tsx"
import { Input } from "./ui/Input.tsx"
import { ListItem } from "./ui/ListItem.tsx"
import { SectionHeading } from "./ui/SectionHeading.tsx"
import { StatusNote } from "./ui/StatusNote.tsx"
import { Textarea } from "./ui/Textarea.tsx"
import type { InvoiceCorrectionsModel } from "../hooks/use-invoice-corrections.ts"
import { CORRECTION_ALREADY_ISSUED_NOTE, CORRECTION_REASON_MAX_LENGTH } from "../lib/correction-state.ts"
import { ORGANIZATION_TIME_ZONE, todayIn } from "../lib/format.ts"

/**
 * The stornos of an issued invoice, rendered from the model: whether the form
 * is offered, what each row reads and what the server already settled are all
 * decided in `use-invoice-corrections.ts` and `correction-state.ts`.
 */
export const CorrectionsSection = ({ corrections }: { readonly corrections: InvoiceCorrectionsModel }) => {
  const { view } = corrections
  return <Card>
    <SectionHeading eyebrow="Corecții fiscale" title="Documente storno" />
    {view === undefined
      ? corrections.isPending
        ? <Loading label="Se încarcă documentele storno…" />
        : <ErrorAlert error={corrections.error} onRetry={corrections.retry} />
      : <>
        {corrections.error === null || corrections.error === undefined
          ? null
          : <ErrorAlert error={corrections.error} onRetry={corrections.retry} />}
        {corrections.unconfirmedMessage === undefined
          ? null
          : <StatusNote tone="warning">{corrections.unconfirmedMessage}</StatusNote>}
        {corrections.alreadyCorrected === undefined
          ? null
          : <StatusNote tone="warning">{corrections.alreadyCorrected}</StatusNote>}
        {view.rows.length === 0
          ? <EmptyState>Factura nu are documente storno.</EmptyState>
          : <div>
            {view.rows.map((row) => <ListItem key={row.id}>
              <AppLink href={row.href}><strong>{row.title}</strong></AppLink>
              <small>{row.caption}</small>
              <small>{row.reason}</small>
            </ListItem>)}
          </div>}
        {view.canIssue
          ? <details>
            <summary>Emite storno integral</summary>
            <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); corrections.issue(new FormData(event.currentTarget)) }}>
              <FormGrid>
                <Field label="Motivul stornării" required className="col-span-full">
                  <Textarea name="reason" rows={3} maxLength={CORRECTION_REASON_MAX_LENGTH} required />
                </Field>
                <Field label="Data documentului" required>
                  <Input name="issueDate" type="date" defaultValue={todayIn(ORGANIZATION_TIME_ZONE)} required />
                </Field>
              </FormGrid>
              <Hint>Se creează un document fiscal nou, imuabil, cu valorile facturii negate.</Hint>
              <ButtonRow>
                <Button variant="danger" type="submit" disabled={!corrections.canIssue}>
                  {corrections.pending ? "Se emite…" : "Emite storno integral"}
                </Button>
              </ButtonRow>
            </form>
          </details>
          : <StatusNote role={null}>{CORRECTION_ALREADY_ISSUED_NOTE}</StatusNote>}
      </>}
  </Card>
}
