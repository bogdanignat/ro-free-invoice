import { issue, type IssueDetail } from "./issue-detail.ts"

export const productKindInvalid = (): IssueDetail => issue("product_kind_invalid", "kind")
export const preferredVatRateInvalid = (date: string): IssueDetail => issue("preferred_vat_rate_invalid", "preferredVatRateCode", { date })
export const itemCodeInvalid = (field: string): IssueDetail => issue("item_code_invalid", field)
export const barcodeInvalid = (field: string): IssueDetail => issue("barcode_invalid", field)
export const unitInvalid = (): IssueDetail => issue("unit_invalid", "unitOfMeasure.code")
export const cuiDigitsOnly = (): IssueDetail => issue("cui_digits_only", "cui")
export const cuiTooShort = (minimum: number): IssueDetail => issue("cui_too_short", "cui", { minimum })
export const queryTooFewLetters = (minimum: number): IssueDetail => issue("query_too_few_letters", "q", { minimum })
export const providerInvalid = (providers: string): IssueDetail => issue("provider_invalid", "provider", { providers })
export const openapiKeyConflict = (): IssueDetail => issue("openapi_key_conflict", "openapiKey")
export const openapiKeyInvalid = (): IssueDetail => issue("openapi_key_invalid", "openapiKey")
export const openapiKeyRequired = (): IssueDetail => issue("openapi_key_required", "openapiKey")
