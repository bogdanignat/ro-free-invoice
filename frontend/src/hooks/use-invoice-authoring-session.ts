import { useState } from "react"

import { useInvoiceAuthoringDraft } from "./use-invoice-authoring-draft.ts"
import { useInvoiceIssuance } from "./use-invoice-issuance.ts"
import { useInvoiceAuthoringEditorActions } from "./use-invoice-authoring-editor-actions.ts"
import { useAuthoringRecovery } from "./use-authoring-recovery.ts"
import { useSupplyDateRefusal } from "./use-supply-date-refusal.ts"
import type { InvoiceAuthoringSession, InvoiceAuthoringSessionInput } from "./invoice-authoring-session-types.ts"
import { ORGANIZATION_TIME_ZONE, todayIn } from "../lib/format.ts"
import { authoringDerived, authoringRecoveryDerived, savedDraftStaleLineIds } from "../lib/invoice-authoring-derived.ts"
import { openingAuthoringForm, openingAuthoringLines } from "../lib/invoice-authoring-opening.ts"
import {
  invoiceAuthoringFeedback, invoiceAuthoringMutationError, invoiceAuthoringStatus,
} from "../lib/invoice-authoring-feedback.ts"
import { draftDeletionState } from "../lib/invoice-authoring-workflow.ts"
import { countyRequiresSector } from "../lib/romanian-counties.ts"
import { issuerForIssueDate } from "../lib/vat-snapshots.ts"
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
  const forcedUpdateLineIds = (currentDraft: DraftInvoice) => savedDraftStaleLineIds(currentDraft, input.issuer)
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
    issuer: input.issuer, staleLineIds: forcedUpdateLineIds, invoiceSeries: input.invoiceSeries,
  })
  const { payload, vatRates, series, vatDate } = derived
  // A save whose create outcome is unknown blocks every other write — most
  // importantly issuance, which could seal an unidentified document and later
  // orphan the draft into a second fiscal invoice.
  const issuanceBlock = draftWorkflow.unconfirmedMessage
  const invoiceIssuance = useInvoiceIssuance({
    draftId: draft?.id, payload,
    canIssue: derived.issuable && issuanceBlock === undefined && !recovery.blocked,
    workflowPending, blockedMessage: issuanceBlock, recovery: recovery.port,
  })
  // The journal and the issuance controller both know about writes this screen
  // could not follow; the buttons need one answer, so the two are combined here
  // and the journal keeps precedence (its intent may still need a replay).
  const recoveryState = authoringRecoveryDerived({
    journalNotice: recovery.notice, journalBlocked: recovery.blocked,
    issuanceKnownResult: invoiceIssuance.knownResult,
  })
  const editor = useInvoiceAuthoringEditorActions({
    issuer: input.issuer, unitOfMeasures: input.unitOfMeasures,
    customers: input.customers,
    vatDate, deriveDueDate: draft === undefined || draft.dueDate === null, setForm, setLines,
  })
  const status = invoiceAuthoringStatus({ draftWorkflow, issuance: invoiceIssuance, recovery, recoveryState, derived })
  const shown = useSupplyDateRefusal(invoiceAuthoringMutationError({
    draftWorkflow, issuance: invoiceIssuance, recovery, recoveryState,
  }), derived.supplyDateIssue, form)
  return {
    document: {
      draft, issuer: issuerForIssueDate(input.issuer, vatDate),
      customers: input.customers, chosenCustomer: editor.chosenCustomer, customersHasMore: input.customersHasMore,
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
      ...invoiceAuthoringFeedback({
        input, draftWorkflow, issuance: invoiceIssuance, recoveryState, derived, form, lines,
        pending: status.pending, shown,
      }),
    },
    status,
    draftDeletion: draftDeletionState(draft),
    actions: {
      ...editor.actions,
      deleteLine: draftWorkflow.deleteLine,
      save: () => { if (derived.canSave) draftWorkflow.save() },
      issueInvoice: invoiceIssuance.issue,
      deleteDraft: draftWorkflow.deleteDraft,
      replayRecovery: recovery.replay,
      // Dismissing acknowledges the notice that is actually on screen: the
      // issuance result it could not follow, or the journal entry and its replay.
      dismissRecovery: recoveryState.acknowledges === "issuance" ? invoiceIssuance.reset : recovery.dismiss,
    },
  }
}
