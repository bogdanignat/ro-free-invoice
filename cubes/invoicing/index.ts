const identity = "invoicing"

export const cube = {
  manifest: {
    name: identity,
    summary: "Romanian invoicing with immutable issued-document snapshots",
    required: true,
    tables: `document_series invoice_drafts draft_lines invoice_sequences
      issued_invoices issued_lines issued_tax_breakdown proformas proforma_lines proforma_tax_breakdown proforma_conversions
       proforma_invoice_conversions correction_documents correction_lines correction_tax_breakdown idempotency_records audit_events`.split(/\s+/),
  },
}

export * from "./contracts/index.ts"
export { calculateTotals, validateFiscalDocument } from "./domain/calculation.ts"
export { CIUS_TEXT_LIMITS, DOCUMENT_NOTES_MAX_LENGTH, hasControlCharacters, validateVatTreatment } from "./domain/validation.ts"
export { maximumSearchLength } from "./domain/search.ts"
export { unitOfMeasures } from "./items/index.ts"
export type { IssueCode, IssueDetail } from "./issues/index.ts"
export {
  efacturaIssue, idempotencyKeyInvalid, invalidInput, paginationRepeated, requestNotFingerprintable, sourceFilterIncomplete,
  spvFilterUnavailable,
} from "./issues/index.ts"
export { ROMANIAN_COUNTIES, addressCountyName, isRomanianCountyCode, isValidRomanianCnp, romanianCountyName } from "./parties/index.ts"
export type { RomanianCounty } from "./parties/index.ts"
export { createInvoicingService } from "./application/invoicing.ts"
export { defaultPageSize, maximumPageSize } from "./application/support.ts"
export type { Page, PageRequest } from "./application/support.ts"
export type { DocumentCursor, DraftCursor, NameCursor, PageQuery } from "./application/ports.ts"
export type { InvoicingDependencies, InvoicingService, InvoicingTransaction } from "./application/invoicing.ts"
export type * from "./domain/invoice.ts"
export { E_FACTURA_STATUSES } from "./domain/invoice.ts"
export type * from "./domain/inputs.ts"
export type { BrandingNormalizer, IssuerProfile, ConfigureIssuerInput, RawIssuerBrandingImage, RawIssuerBranding, VatChange } from "./issuer/index.ts"
export type { Proforma, ProformaSummary, ProformaConversion, ProformaInvoiceConversion,
  IssueProformaInput, ConvertProformaInput, AuthoringProformaInput } from "./issuance/index.ts"
export type {
  CorrectionDocument, CreateCorrectionInput, InvoiceRegisterCursor, InvoiceRegisterFilter, InvoiceRegisterKind, InvoiceRegisterRow,
} from "./corrections/index.ts"
export { SPV_UNRESOLVED_STATUSES, maximumRegisterSearchLength } from "./corrections/index.ts"
export type { UnitOfMeasure } from "./items/index.ts"
