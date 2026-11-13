import { validationFailure } from "../contracts/failures.ts"
import { parseDecimal } from "../money/index.ts"
import * as issue from "../issues/index.ts"
import type { DocumentSeries, DocumentSource } from "./invoice.ts"

type Issues = Array<issue.IssueDetail>

export const maximumPaymentTermDays = 3650
export const article310VatExemptionReason = "Regim special de scutire conform art. 310 din Codul fiscal"

/** A rate in hundredths of a percent, from 0 to 100 with at most two decimals, written without padding. */
const ratePercent = (rate: string): bigint | undefined => {
  const parsed = /^(?:0|[1-9]\d?|100)(?:\.\d{1,2})?$/.test(rate) ? parseDecimal(rate, 2) : undefined
  return parsed?.ok === true ? parsed.units : undefined
}

export const validateVatTreatment = (code: string, rate: string, category: string, reason: string | null): void => {
  const percent = ratePercent(rate)
  const knownTaxable = ["RO_STANDARD", "RO_REDUCED", "RO_REDUCED_5"].includes(code)
  const valid = code === "RO_NON_VAT"
    ? percent === 0n && category === "O" && reason === article310VatExemptionReason
    : knownTaxable && percent !== undefined && percent > 0n && percent <= 10_000n && category === "S" && reason === null
  if (!valid) throw validationFailure([issue.invalidVatTuple()])
}

export const organizationTimeZone = "Europe/Bucharest"
export const calendarDate = (instant: Date, timeZone: string = organizationTimeZone): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant)

export const validateDate = (value: string, field: string): void => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) throw validationFailure([issue.dateFormat(field)])
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw validationFailure([issue.dateInvalid(field)])
  }
}

export const validateDocumentSeries = (documentSeries: Pick<DocumentSeries, "documentType" | "series">): void => {
  const issues: Issues = []
  const documentType: unknown = documentSeries.documentType
  if (documentType !== "invoice" && documentType !== "proforma") issues.push(issue.documentTypeInvalid())
  if (!/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(documentSeries.series)) issues.push(issue.seriesInvalid())
  if (issues.length > 0) throw validationFailure(issues)
}

/** e-Factura counts a text the way the CIUS-RO Schematron does: XPath normalize-space
 * (only space, tab, CR and LF collapse or trim; a no-break space is a character) and
 * characters rather than UTF-16 units. Same expression as `normalizeSpace` and
 * `characterCount` in cubes/invoicing/efactura/decimals.ts, which this cube may not import. */
export const ciusTextLength = (value: string): number =>
  Array.from(value.replace(/[\t\n\r ]+/gu, " ").replace(/^ | $/gu, "")).length

/** BR-RO-L200 (party name), L150 (street), L050 (city), L020 (postal code), L100 (item name). */
export const CIUS_TEXT_LIMITS = { partyName: 200, street: 150, city: 50, postalCode: 20, lineDescription: 100 } as const

/** The one rule for every text a person types: no C0/C1 control, lone surrogate (`pg` would store it
 * as U+FFFD), line or paragraph separator, nor the non-characters U+FFFE/U+FFFF. XML 1.0 cannot carry
 * them (an issued invoice would never reach ANAF), PostgreSQL refuses U+0000, and a layout cannot place
 * them; LF stays only in a multi-line field. */
export const hasControlCharacters = (value: string, newlines = false): boolean =>
  (newlines ? /(?!\n)[\p{Cc}\p{Cs}\p{Zl}\p{Zp}\uFFFE\uFFFF]/u : /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}\uFFFE\uFFFF]/u).test(value)

export const controlCharacterIssues = (field: string, value: string | undefined, issues: Issues, newlines = false): void => {
  if (value !== undefined && hasControlCharacters(value, newlines)) issues.push(issue.containsControlCharacters(field))
}

/** A text that reaches e-Factura: the CIUS-RO length and the control-character rule. */
export const ciusTextIssues = (field: string, value: string | undefined, maximum: number, issues: Issues): void => {
  if (value !== undefined && ciusTextLength(value) > maximum) issues.push(issue.tooLong(field, maximum))
  controlCharacterIssues(field, value, issues)
}

/** Only where a line description is entered: totals are recomputed on read and on storno,
 * and a description stored before the limit must stay readable and correctable. */
export const validateLineDescription = (description: string): void => {
  const issues: Issues = []
  ciusTextIssues("description", description.trim(), CIUS_TEXT_LIMITS.lineDescription, issues)
  if (issues.length > 0) throw validationFailure(issues)
}

const freeText = (field: string, value: string, maximum: number, issues: Issues, newlines = false): void => {
  if (value.trim().length === 0) issues.push(issue.required(field))
  if (value !== value.trim()) issues.push(issue.surroundingWhitespace(field))
  if (value.length > maximum) issues.push(issue.tooLong(field, maximum))
  controlCharacterIssues(field, value, issues, newlines)
}

export const validateDocumentSource = (source: DocumentSource): void => {
  const issues: Issues = []
  freeText("source.app", source.app, 100, issues)
  freeText("source.kind", source.kind, 100, issues)
  freeText("source.id", source.id, 255, issues)
  if (issues.length > 0) throw validationFailure(issues)
}

export const validateDocumentNotes = (notes: string | null | undefined): void => {
  if (notes === null || notes === undefined) return
  const issues: Issues = []
  freeText("notes", notes, 300, issues, true)
  if (issues.length > 0) throw validationFailure(issues)
}
