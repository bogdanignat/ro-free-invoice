import { issue, type IssueDetail } from "./issue-detail.ts"

/** A request the schema could not decode, or one no rule names: the field when known, a generic message. */
export const invalidInput = (field?: string): IssueDetail => issue("invalid_input", field === "" ? undefined : field)
export const paginationRepeated = (): IssueDetail => issue("pagination_repeated")
export const sourceFilterIncomplete = (): IssueDetail => issue("source_filter_incomplete")
export const requestNotFingerprintable = (): IssueDetail => issue("request_not_fingerprintable")
export const uploadIndexInvalid = (): IssueDetail => issue("upload_index_invalid", "uploadIndex")
export const confirmationRequired = (): IssueDetail => issue("confirmation_required", "confirmed")
export const spvFilterUnavailable = (): IssueDetail => issue("spv_filter_unavailable", "spv")

/** An e-Factura refusal is coded by the rule it names (`(BR-RO-120)`), else as a generic contract refusal; its text stays. */
export const efacturaIssue = (text: string): IssueDetail => {
  // The mapping names its rule at the end, "... (BR-RO-110)"; the template puts it back, so `issues` keeps the exact text.
  const [, reason, rule] = /^(.+) \((BR-[A-Z0-9.-]+)\)$/su.exec(text) ?? []
  return reason === undefined || rule === undefined
    ? issue("efactura_contract", undefined, { text }) : issue("efactura_rule", undefined, { rule, text: reason })
}
