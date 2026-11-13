import { Schema } from "effect"

import { DraftInvoice, DraftLine, DraftLineInput, VatBreakdown } from "./schema-drafts.ts"
import { EFacturaStatus } from "./schema-invoice-register.ts"
import { IssuerCompanySnapshot, IssuerParty } from "./schema-issuer.ts"
import {
  bodyObject, Buyer, BuyerSelection, DocumentNotes, DocumentSource, DocumentSourceInput, InputNote, InputText, linesOf,
  nullableString, optional, optionalInput, optionalNullableInput, optionalNullableNotes, optionalString, pageOf, requireBuyer,
} from "./schema-primitives.ts"

export const IssuedInvoice = Schema.Struct({
  actorId: Schema.String, id: Schema.String, draftId: nullableString, sourceProformaId: nullableString,
  organizationId: Schema.String, source: optional(DocumentSource), series: Schema.String, number: Schema.Int,
  issueDate: Schema.String, dueDate: nullableString, issuedAt: Schema.String, currency: Schema.String,
  notes: DocumentNotes, issuer: IssuerParty, customer: Buyer, lines: Schema.Array(DraftLine),
  vatBreakdown: Schema.Array(VatBreakdown), totalExcludingVat: Schema.String,
  vatTotal: Schema.String, totalIncludingVat: Schema.String,
  eFacturaStatus: Schema.NullOr(EFacturaStatus).annotations({
    description: "null when the e-Factura plugin is off in this installation.",
  }),
})
export const IssuedInvoiceSummary = Schema.Struct({ ...IssuedInvoice.fields, issuer: IssuerCompanySnapshot })
export const IssuedInvoicePage = pageOf(IssuedInvoiceSummary)
const AuthoringFields = {
  ...BuyerSelection.fields, source: optional(DocumentSourceInput), issueDate: InputText,
  dueDate: optionalNullableInput, currency: Schema.Literal("RON"), notes: optionalNullableNotes,
  lines: linesOf(DraftLineInput),
}
export const AuthoringDocumentInput = Schema.Struct({ ...AuthoringFields, series: InputText }).annotations(bodyObject).pipe(requireBuyer)
export const AuthoringProformaInput = Schema.Struct({ ...AuthoringFields, proformaSeries: InputText }).annotations(bodyObject).pipe(requireBuyer)
export const ConvertProformaInput = Schema.Struct({ invoiceSeries: InputText }).annotations(bodyObject)
export const CorrectionInput = Schema.Struct({
  reason: InputNote, issueDate: optionalInput, source: optional(DocumentSourceInput),
}).annotations(bodyObject)
export const Correction = Schema.Struct({
  actorId: Schema.String, id: Schema.String, organizationId: Schema.String, originalInvoiceId: Schema.String,
  source: optional(DocumentSource), fiscalYear: Schema.Int, series: Schema.String, number: Schema.Int,
  issueDate: Schema.String, issuedAt: Schema.String, reason: Schema.String, currency: Schema.String,
  issuer: IssuerCompanySnapshot, customer: Buyer, lines: Schema.Array(DraftLine),
  vatBreakdown: Schema.Array(VatBreakdown), totalExcludingVat: Schema.String,
  vatTotal: Schema.String, totalIncludingVat: Schema.String,
})
export const Proforma = Schema.Struct({
  actorId: Schema.String, id: Schema.String, sourceDraftId: nullableString, convertedDraftId: nullableString,
  convertedInvoiceId: nullableString, organizationId: Schema.String, customerId: optionalString, source: optional(DocumentSource),
  series: Schema.String, number: Schema.Int, issueDate: Schema.String, dueDate: nullableString,
  issuedAt: Schema.String, currency: Schema.String, notes: DocumentNotes, issuer: IssuerParty,
  customer: Buyer, lines: Schema.Array(DraftLine), vatBreakdown: Schema.Array(VatBreakdown),
  totalExcludingVat: Schema.String, vatTotal: Schema.String, totalIncludingVat: Schema.String,
})
export const ProformaSummary = Schema.Struct({ ...Proforma.fields, issuer: IssuerCompanySnapshot })
export const ProformaPage = pageOf(ProformaSummary)
export const IssueProformaInput = Schema.Struct({ series: InputText }).annotations(bodyObject)
export { DraftInvoice }
