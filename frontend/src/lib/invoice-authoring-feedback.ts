import type { Issuer } from "./draft-models.ts"
import { documentLinesStarted } from "./document-authoring-readiness.ts"
import type { AuthoringDerived, AuthoringRecoveryDerived } from "./invoice-authoring-derived.ts"
import type { EditableInvoiceLine, InvoiceAuthoringForm } from "./invoice-authoring-model.ts"
import { issueBlockReasons, issuerIssuanceWarning } from "./invoice-authoring-workflow.ts"
import { documentNotesIssue } from "./invoice-notes-validation.ts"

/**
 * What the invoice authoring screen says and which of its buttons are open,
 * assembled from answers the session already computed (draft workflow,
 * issuance, journal, derived rules) so the rules can be read and tested
 * without React. The shapes below are what the session's hooks return.
 */
export interface AuthoringMutationErrorInput {
  readonly draftWorkflow: { readonly error: unknown }
  readonly issuance: { readonly error: unknown }
  readonly recovery: { readonly error: unknown }
  readonly recoveryState: Pick<AuthoringRecoveryDerived, "suppressIssuanceError">
}

/**
 * The one failure the page alert shows: the draft's first, then the issuance's,
 * then the journal replay's. The known-result notice already says what happened
 * to the issuance; the same effects failure as a second, bare message only adds noise.
 */
export const invoiceAuthoringMutationError = (input: AuthoringMutationErrorInput): unknown =>
  input.draftWorkflow.error
  ?? (input.recoveryState.suppressIssuanceError ? null : input.issuance.error)
  ?? input.recovery.error

export interface InvoiceAuthoringStatusInput {
  readonly draftWorkflow: { readonly pending: boolean; readonly savePending: boolean }
  readonly issuance: {
    readonly pending: boolean
    readonly canIssue: boolean
    readonly unconfirmedMessage: string | undefined
  }
  readonly recovery: { readonly pending: boolean }
  readonly recoveryState: Pick<AuthoringRecoveryDerived, "blocked">
  readonly derived: Pick<AuthoringDerived, "canSave" | "dueDateRequired">
}

export const invoiceAuthoringStatus = (input: InvoiceAuthoringStatusInput) => ({
  // An issuance whose outcome is unknown freezes the document: only an explicit
  // retry of the exact same payload (the controller refuses an edited one
  // locally) may be sent, so editing and saving are held back.
  pending: input.draftWorkflow.pending || input.issuance.pending
    || input.issuance.unconfirmedMessage !== undefined || input.recovery.pending,
  savePending: input.draftWorkflow.savePending,
  canSave: input.derived.canSave,
  invoicePending: input.issuance.pending,
  canIssueInvoice: input.issuance.canIssue,
  dueDateRequired: input.derived.dueDateRequired,
  recoveryBlocked: input.recoveryState.blocked,
  recoveryPending: input.recovery.pending,
})

export interface InvoiceAuthoringFeedbackInput {
  readonly input: {
    readonly issuer: Pick<Issuer, "legalForm" | "tradeRegistryNumber" | "socialCapital">
    readonly notesMaxLength: number
  }
  readonly draftWorkflow: {
    readonly draft: object | undefined
    readonly resumableSave: boolean
    readonly unconfirmedMessage: string | undefined
    readonly notice: string | null
  }
  readonly issuance: { readonly unconfirmedMessage: string | undefined }
  readonly recoveryState: Pick<AuthoringRecoveryDerived, "notice">
  readonly derived: Pick<
    AuthoringDerived,
    "readiness" | "taxReadiness" | "series" | "dueDateIssue" | "supplyDateIssue" | "supplyDateWarning"
  >
  readonly form: Pick<InvoiceAuthoringForm, "notes">
  readonly lines: ReadonlyArray<EditableInvoiceLine>
  /** `invoiceAuthoringStatus(...).pending`: a write in flight speaks for itself. */
  readonly pending: boolean
  /** The failure split by `useSupplyDateRefusal` between the page alert and the supply date field. */
  readonly shown: { readonly error: unknown; readonly supplyDateIssue: string | null }
}

export const invoiceAuthoringFeedback = (feedback: InvoiceAuthoringFeedbackInput) => {
  const { input, draftWorkflow, derived } = feedback
  return {
    mutationError: feedback.shown.error,
    resumableSave: draftWorkflow.resumableSave,
    unconfirmedMessage: draftWorkflow.unconfirmedMessage,
    issueUnconfirmedMessage: feedback.issuance.unconfirmedMessage,
    issuerWarning: issuerIssuanceWarning(input.issuer),
    staleTaxWarning: derived.taxReadiness.warning,
    seriesWarning: derived.series.warning,
    notesIssue: documentNotesIssue(feedback.form.notes, input.notesMaxLength),
    notesMaxLength: input.notesMaxLength,
    dueDateIssue: derived.dueDateIssue,
    supplyDateIssue: feedback.shown.supplyDateIssue,
    supplyDateWarning: derived.supplyDateWarning,
    notice: draftWorkflow.notice,
    issueBlockReasons: issueBlockReasons({
      readiness: derived.readiness, hasDraft: draftWorkflow.draft !== undefined,
      linesStarted: documentLinesStarted(feedback.lines), pending: feedback.pending,
      staleTaxWarning: derived.taxReadiness.warning, dueDateIssue: derived.dueDateIssue,
      supplyDateIssue: derived.supplyDateIssue, seriesWarning: derived.series.warning,
    }),
    // The issuance controller's own confirmed-but-unfollowed result reaches
    // the same card: one place on the screen says what is known to exist.
    recoveryNotice: feedback.recoveryState.notice,
  }
}
