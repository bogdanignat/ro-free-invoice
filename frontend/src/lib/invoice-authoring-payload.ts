import type {
  AuthoringDocumentInput, CreateDraftInput, DraftLineInput, DraftInvoice, UpdateDraftInput,
} from "./draft-models.ts"
import type { BuyerSnapshot } from "./document-snapshot.ts"
import { normalizeRomanianCui } from "./vat-defaults.ts"
import type { EditableInvoiceLine, InvoiceAuthoringForm } from "./invoice-authoring-model.ts"
import { selectedTaxIdentifier } from "./document-authoring-transitions.ts"
import { presentIdentifiers } from "./item-identifiers.ts"
import { lineInputMatches } from "./document-authoring-options.ts"

const buyerPayload = (
  form: InvoiceAuthoringForm,
): { readonly customerId: string } | { readonly customer: BuyerSnapshot } =>
  form.buyerMode === "saved"
    ? { customerId: form.customerId }
    : {
      customer: {
        partyType: form.partyType,
        name: form.name,
        fiscalIdentifier: form.partyType === "company"
          ? normalizeRomanianCui(selectedTaxIdentifier(form))
          : selectedTaxIdentifier(form),
        vatRegistered: form.partyType === "company" && form.vatRegistered,
        address: {
          countryCode: form.countryCode,
          city: form.city,
          street: form.street,
          county: form.county,
          ...(form.sector === undefined ? {} : { sector: form.sector }),
          ...(form.postalCode === "" ? {} : { postalCode: form.postalCode }),
        },
      },
    }

const supplyDatePayload = (form: InvoiceAuthoringForm): string | null => form.supplyDate === "" ? null : form.supplyDate

const documentHeader = (form: InvoiceAuthoringForm) => ({
  ...buyerPayload(form),
  series: form.series,
  issueDate: form.issueDate,
  currency: "RON" as const,
  dueDate: form.dueDate === "" ? null : form.dueDate,
  notes: form.notes.trim() === "" ? null : form.notes.trim(),
})

export const createDraftPayload = (form: InvoiceAuthoringForm): CreateDraftInput => ({
  ...documentHeader(form),
  supplyDate: supplyDatePayload(form),
})

// The series is always sent: the server moves the draft only when it differs,
// and then only to an active invoice series, so keeping an archived one is no move.
export const updateDraftPayload = (form: InvoiceAuthoringForm): UpdateDraftInput => ({
  ...buyerPayload(form),
  series: form.series,
  issueDate: form.issueDate,
  dueDate: form.dueDate === "" ? null : form.dueDate,
  supplyDate: supplyDatePayload(form),
  notes: form.notes.trim() === "" ? null : form.notes.trim(),
})

export const draftLinePayload = (line: EditableInvoiceLine): DraftLineInput => ({
  description: line.description,
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  unitOfMeasure: line.unitOfMeasure,
  vatRateCode: line.vatRateCode,
  ...presentIdentifiers(line),
})

// `POST /invoices` and `POST /proformas` take no supply date: a dated invoice is
// issued from its saved draft (`authoringReadiness`), and the date stays here
// only for the guard that compares this intent with that draft.
export const authoringDocumentPayload = (
  form: InvoiceAuthoringForm,
  lines: ReadonlyArray<EditableInvoiceLine>,
): AuthoringDocumentInput => ({
  ...documentHeader(form),
  ...(form.supplyDate === "" ? {} : { supplyDate: form.supplyDate }),
  lines: lines.map(draftLinePayload),
})

const sameBuyerSnapshot = (left: BuyerSnapshot, right: BuyerSnapshot): boolean =>
  (["partyType", "name", "fiscalIdentifier", "vatRegistered"] as const)
    .every((key) => left[key] === right[key])
  && (["countryCode", "city", "street", "county", "sector", "postalCode"] as const)
    .every((key) => left.address[key] === right.address[key])

/**
 * Whether the server's draft is exactly the document this session intends.
 *
 * Asked before an issuance from a saved draft, this is the guard against the
 * same draft being changed elsewhere: issuing would seal somebody else's edit.
 */
export const authoringPayloadMatchesDraft = (
  payload: AuthoringDocumentInput,
  draft: DraftInvoice,
): boolean => {
  const sameBuyer = "customerId" in payload
    ? draft.customerId === payload.customerId
    : draft.customerId === undefined && sameBuyerSnapshot(draft.customer, payload.customer)
  return sameBuyer
    && draft.series === payload.series
    && draft.issueDate === payload.issueDate
    && draft.dueDate === (payload.dueDate ?? null)
    && (draft.supplyDate ?? null) === (payload.supplyDate ?? null)
    && draft.currency === payload.currency
    && draft.notes === (payload.notes ?? null)
    && draft.lines.length === payload.lines.length
    && draft.lines.every((line, index) => {
      const expected = payload.lines[index]
      return expected !== undefined && lineInputMatches(expected, line)
    })
}
