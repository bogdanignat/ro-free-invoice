import assert from "node:assert/strict"
import test from "node:test"

import {
  invoiceAuthoringFeedback, invoiceAuthoringMutationError, invoiceAuthoringStatus,
  type InvoiceAuthoringFeedbackInput, type InvoiceAuthoringStatusInput,
} from "./invoice-authoring-feedback.ts"
import { issueBlockReasons } from "./invoice-authoring-workflow.ts"

const draftError = new Error("draft")
const issuanceError = new Error("issuance")
const recoveryError = new Error("recovery")

const errorsOf = (draft: unknown, issuance: unknown, recovery: unknown, suppressIssuanceError = false) => ({
  draftWorkflow: { error: draft },
  issuance: { error: issuance },
  recovery: { error: recovery },
  recoveryState: { suppressIssuanceError },
})

void test("the draft's failure goes before the issuance's, which goes before the journal's", () => {
  assert.equal(invoiceAuthoringMutationError(errorsOf(draftError, issuanceError, recoveryError)), draftError)
  assert.equal(invoiceAuthoringMutationError(errorsOf(null, issuanceError, recoveryError)), issuanceError)
  assert.equal(invoiceAuthoringMutationError(errorsOf(null, null, recoveryError)), recoveryError)
})

void test("an issuance failure the known-result notice explains is not shown again; the journal's still is", () => {
  assert.equal(invoiceAuthoringMutationError(errorsOf(null, issuanceError, recoveryError, true)), recoveryError)
  assert.equal(invoiceAuthoringMutationError(errorsOf(draftError, issuanceError, null, true)), draftError)
})

const statusInput = (patch: Partial<InvoiceAuthoringStatusInput> = {}): InvoiceAuthoringStatusInput => ({
  draftWorkflow: { pending: false, savePending: false },
  issuance: { pending: false, canIssue: true, unconfirmedMessage: undefined },
  recovery: { pending: false },
  recoveryState: { blocked: false },
  derived: { canSave: true, dueDateRequired: false },
  ...patch,
})

void test("an issuance with an unknown outcome holds the screen as pending", () => {
  assert.equal(invoiceAuthoringStatus(statusInput()).pending, false)
  const status = invoiceAuthoringStatus(statusInput({
    issuance: { pending: false, canIssue: false, unconfirmedMessage: "Emiterea nu este confirmată." },
  }))
  assert.equal(status.pending, true)
  assert.equal(status.invoicePending, false)
})

void test("a draft write, an issuance or a journal replay in flight each hold the screen as pending", () => {
  const draftWriting = statusInput({ draftWorkflow: { pending: true, savePending: false } })
  const issuing = statusInput({ issuance: { pending: true, canIssue: false, unconfirmedMessage: undefined } })
  const replaying = statusInput({ recovery: { pending: true } })
  assert.equal(invoiceAuthoringStatus(draftWriting).pending, true)
  assert.equal(invoiceAuthoringStatus(issuing).pending, true)
  assert.equal(invoiceAuthoringStatus(replaying).pending, true)
})

void test("each status flag is read from its own source", () => {
  assert.deepEqual(invoiceAuthoringStatus({
    draftWorkflow: { pending: false, savePending: true },
    issuance: { pending: false, canIssue: true, unconfirmedMessage: undefined },
    recovery: { pending: false },
    recoveryState: { blocked: true },
    derived: { canSave: false, dueDateRequired: true },
  }), {
    pending: false, savePending: true, canSave: false, invoicePending: false,
    canIssueInvoice: true, dueDateRequired: true, recoveryBlocked: true, recoveryPending: false,
  })
})

const feedbackInput = (pending: boolean): InvoiceAuthoringFeedbackInput => ({
  input: {
    issuer: { legalForm: "srl", tradeRegistryNumber: "J12/1/2020", socialCapital: "200" },
    notesMaxLength: 100,
  },
  draftWorkflow: { draft: { id: "draft-1" }, resumableSave: false, unconfirmedMessage: undefined, notice: null },
  issuance: { unconfirmedMessage: undefined },
  recoveryState: { notice: undefined },
  derived: {
    readiness: { editable: true, synchronized: false, hasLines: false, canIssue: false },
    taxReadiness: { canIssue: false, synchronized: false, warning: "TVA învechit" },
    series: { choices: [], warning: "Seria e arhivată" },
    dueDateIssue: "Scadența lipsește",
    supplyDateIssue: "Livrarea e după emitere",
    supplyDateWarning: null,
  },
  form: { notes: "" },
  lines: [],
  pending,
  shown: { error: null, supplyDateIssue: "Câmpul livrării" },
})

void test("the issue block reasons are asked with the session's own values", () => {
  const input = feedbackInput(false)
  const expected = issueBlockReasons({
    readiness: input.derived.readiness, hasDraft: true, linesStarted: false, pending: false,
    staleTaxWarning: "TVA învechit", dueDateIssue: "Scadența lipsește",
    supplyDateIssue: "Livrarea e după emitere", seriesWarning: "Seria e arhivată",
  })
  assert.equal(expected.length, 6)
  const feedback = invoiceAuthoringFeedback(input)
  assert.deepEqual(feedback.issueBlockReasons, expected)
  assert.equal(feedback.supplyDateIssue, "Câmpul livrării")
  assert.deepEqual(invoiceAuthoringFeedback(feedbackInput(true)).issueBlockReasons, [])
})
