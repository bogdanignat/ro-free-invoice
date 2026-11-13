import { useState } from "react"

import { useInvoiceAuthoringDraft } from "./use-invoice-authoring-draft.ts"
import { useInvoiceIssuance } from "./use-invoice-issuance.ts"
import { createInvoiceAuthoringEditorActions } from "./use-invoice-authoring-editor-actions.ts"
import { useAuthoringRecovery } from "./use-authoring-recovery.ts"
import type { InvoiceAuthoringSession, InvoiceAuthoringSessionInput } from "./invoice-authoring-session-types.ts"
import { ORGANIZATION_TIME_ZONE, todayIn } from "../lib/format.ts"
import { authoringDerived, authoringRecoveryDerived } from "../lib/invoice-authoring-derived.ts"
import { openingAuthoringForm, openingAuthoringLines } from "../lib/invoice-authoring-opening.ts"
import { documentLinesStarted } from "../lib/document-authoring-readiness.ts"
import {
  draftDeletionState, issueBlockReasons, issuerIssuanceWarning,
} from "../lib/invoice-authoring-workflow.ts"
import { documentNotesIssue, documentNotesMaxLength } from "../lib/invoice-notes-validation.ts"
import { countyRequiresSector } from "../lib/romanian-counties.ts"
import { issuerForIssueDate, staleDraftLineIds } from "../lib/vat-snapshots.ts"
import { effectiveSupplyDate } from "../lib/supply-date.ts"
import type { DraftInvoice } from "../lib/draft-models.ts"

/**
 * The composition behind one authoring screen: the form and lines as local
 * state, the draft workflow and issuance as controllers wired by their hooks,
 * and every derived answer — readiness, stale tax, the due-date requirement —
 * computed here so the components underneath only render.
 */
export const useInvoiceAuthoringSession = (input: InvoiceAuthoringSessionInput): InvoiceAuthoringSession => {
  // One reading of the day, on mount, so the form and the lines open on the same date.
  const [openedOn] = useState(() => todayIn(ORGANIZATION_TIME_ZONE))
  const [form, setForm] = useState(() => openingAuthoringForm(input, openedOn))
  const [lines, setLines] = useState(() => openingAuthoringLines(input, openedOn, crypto.randomUUID()))
  const forcedUpdateLineIds = (currentDraft: DraftInvoice): ReadonlyArray<string> =>
    staleDraftLineIds(effectiveSupplyDate(currentDraft), currentDraft.lines, input.vatCatalogue, input.issuer)
  // An unresolved write from this tab blocks both saving and issuing until it
  // is replayed or the user states they checked the registry.
  const recovery = useAuthoringRecovery()
  const draftWorkflow = useInvoiceAuthoringDraft({
    initialDraft: input.initialDraft, form, lines, setLines, forcedUpdateLineIds,
    recovery: recovery.port,
  })
  const { draft } = draftWorkflow
  const workflowPending = draftWorkflow.pending
  const derived = authoringDerived({
    form, lines, draft, workflowPending,
    issuer: input.issuer, vatCatalogue: input.vatCatalogue, staleLineIds: forcedUpdateLineIds, invoiceSeries: input.invoiceSeries,
  })
  const { payload, taxReadiness, dueDateRequired, vatRates, series, vatDate, dueDateIssue, supplyDateIssue } = derived
  // A save whose create outcome is unknown blocks every other write — most
  // importantly issuance, which could seal an unidentified document and later
  // orphan the draft into a second fiscal invoice.
  const issuanceBlock = draftWorkflow.unconfirmedMessage
  const invoiceIssuance = useInvoiceIssuance({
    draftId: draft?.id, payload,
    canIssue: derived.issuable && issuanceBlock === undefined && !recovery.blocked,
    workflowPending, blockedMessage: issuanceBlock, recovery: recovery.port,
  })
  // An issuance whose outcome is unknown freezes the document instead: only
  // an explicit retry of the exact same payload (the controller refuses an
  // edited one locally) may be sent, so editing and saving are held back.
  const issueUnconfirmed = invoiceIssuance.unconfirmedMessage
  // The journal and the issuance controller both know about writes this screen
  // could not follow; the buttons need one answer, so the two are combined here
  // and the journal keeps precedence (its intent may still need a replay).
  const recoveryState = authoringRecoveryDerived({
    journalNotice: recovery.notice, journalBlocked: recovery.blocked,
    issuanceKnownResult: invoiceIssuance.knownResult,
  })
  const editorActions = createInvoiceAuthoringEditorActions({
    issuer: input.issuer, vatCatalogue: input.vatCatalogue, unitOfMeasures: input.unitOfMeasures,
    productPresets: input.productPresets, customers: input.customers,
    issueDate: vatDate, deriveDueDate: draft === undefined || draft.dueDate === null, setForm, setLines,
  })
  const pending = workflowPending || invoiceIssuance.pending || issueUnconfirmed !== undefined || recovery.pending
  return {
    document: {
      draft, issuer: issuerForIssueDate(input.issuer, vatDate),
      customers: input.customers, customersHasMore: input.customersHasMore,
      customersLoadingMore: input.customersLoadingMore, customersLoadMore: input.customersLoadMore,
      seriesChoices: series.choices, unitOfMeasures: input.unitOfMeasures, form, lines,
      savedBuyer: draft?.customerId !== undefined
        ? { customerId: draft.customerId, customer: draft.customer }
        : undefined,
      buyerSectorRequired: countyRequiresSector(form.county), productPresets: input.productPresets,
      presetsHasMore: input.presetsHasMore, presetsLoadingMore: input.presetsLoadingMore,
      presetsLoadMore: input.presetsLoadMore, vatRates,
    },
    feedback: {
      backgroundErrors: input.backgroundErrors,
      // The known-result notice already says what happened; the same effects
      // failure as a second, bare error message only adds noise.
      mutationError: draftWorkflow.error
        ?? (recoveryState.suppressIssuanceError ? null : invoiceIssuance.error)
        ?? recovery.error,
      resumableSave: draftWorkflow.resumableSave,
      unconfirmedMessage: draftWorkflow.unconfirmedMessage,
      issueUnconfirmedMessage: issueUnconfirmed,
      issuerWarning: issuerIssuanceWarning(input.issuer), staleTaxWarning: taxReadiness.warning, seriesWarning: series.warning,
      notesIssue: documentNotesIssue(form.notes), notesMaxLength: documentNotesMaxLength,
      dueDateIssue, supplyDateIssue, supplyDateWarning: derived.supplyDateWarning, notice: draftWorkflow.notice,
      issueBlockReasons: issueBlockReasons({
        readiness: derived.readiness, hasDraft: draft !== undefined, linesStarted: documentLinesStarted(lines), pending,
        staleTaxWarning: taxReadiness.warning, dueDateIssue, supplyDate: form.supplyDate, supplyDateIssue, seriesWarning: series.warning,
      }),
      // The issuance controller's own confirmed-but-unfollowed result reaches
      // the same card: one place on the screen says what is known to exist.
      recoveryNotice: recoveryState.notice,
    },
    status: {
      pending, savePending: draftWorkflow.savePending, invoicePending: invoiceIssuance.pending,
      canIssueInvoice: invoiceIssuance.canIssue, dueDateRequired,
      recoveryBlocked: recoveryState.blocked, recoveryPending: recovery.pending,
    },
    draftDeletion: draftDeletionState(draft),
    actions: {
      ...editorActions,
      deleteLine: draftWorkflow.deleteLine,
      save: draftWorkflow.save,
      issueInvoice: invoiceIssuance.issue,
      deleteDraft: draftWorkflow.deleteDraft,
      replayRecovery: recovery.replay,
      // Dismissing acknowledges the notice that is actually on screen: the
      // issuance result it could not follow, or the journal entry and its replay.
      dismissRecovery: recoveryState.acknowledges === "issuance" ? invoiceIssuance.reset : recovery.dismiss,
    },
  }
}
