import { AppLink } from "../ui/AppLink.tsx"
import type { InvoiceAuthoringSession } from "../../hooks/invoice-authoring-session-types.ts"
import { Button } from "../ui/Button.tsx"
import { Card } from "../ui/Card.tsx"
import { CardTitle } from "../ui/CardTitle.tsx"
import { Hint } from "../ui/Hint.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"
import { ISSUE_BLOCK_REASONS_ID, IssueBlockReasons } from "./IssueBlockReasons.tsx"

/**
 * Save, issue and delete, with every warning the session computed. Issuance is
 * confirmed before it leaves (the number and the fiscal document become
 * immutable), and the due-date note explains that a draft may be saved without
 * one while a positive-total invoice may not.
 */
export const AuthoringActions = ({ session }: { readonly session: InvoiceAuthoringSession }) => {
  const { actions, feedback, status, draftDeletion } = session
  return <Card className="grid gap-4">
    <CardTitle>Acțiuni document</CardTitle>
    <Button variant="secondary" fullWidth type="submit" disabled={status.pending || status.recoveryBlocked || !status.canSave}>
      {status.savePending ? "Se salvează toate modificările…" : "Salvează draftul"}
    </Button>
    <Hint>Draftul este opțional și rămâne editabil.</Hint>
    <CardTitle>Emitere factură</CardTitle>
    <Button fullWidth disabled={!status.canIssueInvoice} onClick={(event) => {
      if (event.currentTarget.form?.reportValidity() !== false) actions.issueInvoice()
    }} aria-describedby={feedback.issueBlockReasons.length === 0 ? undefined : ISSUE_BLOCK_REASONS_ID}>
      {status.invoicePending ? "Se emite…" : "Emite factura"}
    </Button>
    <IssueBlockReasons reasons={feedback.issueBlockReasons} />
    {draftDeletion.kind === "hidden" ? null : draftDeletion.kind === "available"
      ? <Button variant="danger" fullWidth disabled={status.pending} onClick={actions.deleteDraft}>Șterge draftul</Button>
      : draftDeletion.kind === "derived"
        ? <StatusNote role={null}>
          {draftDeletion.notice.message}{" "}
          <AppLink href={draftDeletion.notice.proformaHref}>{draftDeletion.notice.proformaLabel}</AppLink>
        </StatusNote>
        : null}
    <Hint>Dintr-un document nou poți emite direct. Dacă ai salvat deja draftul, salvează întâi orice modificare nouă.</Hint>
    {feedback.notice === null ? null : <StatusNote aria-live="polite">{feedback.notice}</StatusNote>}
  </Card>
}
