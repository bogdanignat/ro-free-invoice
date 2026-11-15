import { AppLink } from "../ui/AppLink.tsx"
import type { ProformaAuthoringSessionInput } from "../../hooks/proforma-authoring-session-types.ts"
import { useProformaAuthoringSession } from "../../hooks/use-proforma-authoring-session.ts"
import { InvoiceLinesEditor } from "./InvoiceLinesEditor.tsx"
import { OperationRecoveryNotice } from "./OperationRecoveryNotice.tsx"
import { ProformaAuthoringActions } from "./ProformaAuthoringActions.tsx"
import { ProformaAuthoringHeader } from "./ProformaAuthoringHeader.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"
import { AuthoringLayout } from "./AuthoringLayout.tsx"
import { NotesSection } from "./NotesSection.tsx"
import { ErrorAlert } from "../AsyncState.tsx"

/**
 * The proforma form around one session view-model: head and buyer, notes, lines,
 * then the single save.
 *
 * There is no draft and no issuance step here, so an unconfirmed write is a
 * dead end by design: the notice sends the user to the register to check whether
 * the proforma exists instead of offering a second save under a new key.
 */
export const ProformaAuthoringSession = (input: ProformaAuthoringSessionInput) => {
  const session = useProformaAuthoringSession(input)
  const { actions, document, feedback, status } = session
  return <>
    {feedback.backgroundErrors.map((issue, index) => <ErrorAlert key={`${issue.error.message}-${String(index)}`} error={issue.error} onRetry={issue.retry} />)}
    {feedback.mutationError === null || feedback.mutationError === undefined ? null : <ErrorAlert error={feedback.mutationError} />}
    <OperationRecoveryNotice
      notice={feedback.recoveryNotice} pending={status.recoveryPending}
      onReplay={actions.replayRecovery} onDismiss={actions.dismissRecovery}
    />
    {feedback.unconfirmedMessage === undefined
      ? null
      : <StatusNote tone="warning" role="status">{feedback.unconfirmedMessage}{" "}<AppLink href="/proformas">Registrul de proforme</AppLink></StatusNote>}
    {feedback.issuerWarning === undefined
      ? null
      : <StatusNote tone="warning" role="status">{feedback.issuerWarning} Proforma nu este document fiscal; salvarea rămâne disponibilă.</StatusNote>}
    <AuthoringLayout onSubmit={(event) => { event.preventDefault(); actions.save() }} side={<ProformaAuthoringActions session={session} />}>
      <ProformaAuthoringHeader session={session} />
      <NotesSection statusId="proforma-notes-status" value={document.form.notes} maxLength={feedback.notesMaxLength}
        issue={feedback.notesIssue} disabled={status.pending}
        onChange={(notes) => { actions.changeForm({ notes }) }} />
      <InvoiceLinesEditor
        lines={document.lines} productPresets={document.productPresets}
        presetsHasMore={document.presetsHasMore} presetsLoadingMore={document.presetsLoadingMore}
        onPresetsLoadMore={document.presetsLoadMore}
        vatRates={document.vatRates} unitOfMeasures={document.unitOfMeasures} pending={status.pending}
        onAdd={actions.addLine} onChange={actions.changeLine} onApplyPreset={actions.choosePreset} onDelete={actions.deleteLine}
      />
    </AuthoringLayout>
  </>
}
