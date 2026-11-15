import { AppLink } from "../ui/AppLink.tsx"
import type { InvoiceAuthoringSessionInput } from "../../hooks/invoice-authoring-session-types.ts"
import { useInvoiceAuthoringSession } from "../../hooks/use-invoice-authoring-session.ts"
import { useTotalsPreview } from "../../hooks/use-totals-preview.ts"
import { InvoiceAuthoringHeader } from "./InvoiceAuthoringHeader.tsx"
import { InvoiceLinesEditor } from "./InvoiceLinesEditor.tsx"
import { InvoiceTotals } from "./InvoiceTotals.tsx"
import { AuthoringActions } from "./AuthoringActions.tsx"
import { OperationRecoveryNotice } from "./OperationRecoveryNotice.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"
import { AuthoringLayout } from "./AuthoringLayout.tsx"
import { NotesSection } from "./NotesSection.tsx"
import { ErrorAlert } from "../AsyncState.tsx"

/**
 * The whole authoring form around one session view-model: header and buyer,
 * notes, lines, then the server's preview of the totals and the actions. The
 * component only renders what the session hook computed; save, issuance and
 * deletion all live behind its actions.
 */
export const InvoiceAuthoringSession = (input: InvoiceAuthoringSessionInput) => {
  const session = useInvoiceAuthoringSession(input)
  const { actions, document, feedback, status } = session
  const totals = useTotalsPreview(document.form.issueDate, document.form.supplyDate, document.lines)
  return <>
    {feedback.backgroundErrors.map((issue, index) => <ErrorAlert key={`${issue.error.message}-${String(index)}`} error={issue.error} onRetry={issue.retry} />)}
    {feedback.mutationError === null || feedback.mutationError === undefined ? null : <ErrorAlert error={feedback.mutationError} />}
    <OperationRecoveryNotice
      notice={feedback.recoveryNotice} pending={status.recoveryPending}
      onReplay={actions.replayRecovery} onDismiss={actions.dismissRecovery}
    />
    {feedback.resumableSave
      ? <StatusNote>Draftul a fost creat și păstrat în această pagină. Corectează eroarea și apasă din nou „Salvează draftul”; vor fi retrimise numai liniile rămase sau modificate.</StatusNote>
      : null}
    {feedback.unconfirmedMessage === undefined
      ? null
      : <StatusNote tone="warning" role="status">{feedback.unconfirmedMessage}{" "}<AppLink href="/invoices">Registrul de facturi</AppLink></StatusNote>}
    {feedback.issueUnconfirmedMessage === undefined
      ? null
      : <StatusNote tone="warning" role="status">{feedback.issueUnconfirmedMessage}{" "}<AppLink href="/invoices">Verifică registrul de facturi</AppLink></StatusNote>}
    {feedback.issuerWarning === undefined
      ? null
      : <StatusNote tone="warning" role="status">{feedback.issuerWarning} Salvarea draftului rămâne disponibilă; API-ul verifică emiterea.</StatusNote>}
    {feedback.staleTaxWarning === null ? null : <StatusNote tone="warning" role="status" aria-live="polite">{feedback.staleTaxWarning}</StatusNote>}
    {feedback.seriesWarning === undefined ? null
      : <StatusNote tone="warning" id="invoice-series-warning" role="status" aria-live="polite">{feedback.seriesWarning}</StatusNote>}
    <AuthoringLayout onSubmit={(event) => { event.preventDefault(); actions.save() }}
      side={<>
        <InvoiceTotals preview={totals} dueDate={document.form.dueDate} />
        <AuthoringActions session={session} />
      </>}>
      <InvoiceAuthoringHeader session={session} />
      {feedback.dueDateIssue === null
        ? null
        : <StatusNote tone="warning" id="invoice-due-date-issue" role="status">{feedback.dueDateIssue} Draftul poate fi salvat fără scadență.</StatusNote>}
      <NotesSection statusId="notes-status" value={document.form.notes} maxLength={feedback.notesMaxLength}
        issue={feedback.notesIssue} disabled={status.pending}
        onChange={(notes) => { actions.changeForm({ notes }) }} />
      <InvoiceLinesEditor
        lines={document.lines} lineTotals={totals.lineTotals} productPresets={document.productPresets}
        presetsHasMore={document.presetsHasMore} presetsLoadingMore={document.presetsLoadingMore}
        onPresetsLoadMore={document.presetsLoadMore}
        vatRates={document.vatRates} unitOfMeasures={document.unitOfMeasures} pending={status.pending}
        onAdd={actions.addLine} onChange={actions.changeLine} onApplyPreset={actions.choosePreset} onDelete={actions.deleteLine}
      />
    </AuthoringLayout>
  </>
}
