import { formatRate } from "./money.ts"
import type { Issuer, VatCategoryCode } from "./draft-models.ts"
import { periodOn, sameVatRate } from "./vat-defaults.ts"

interface DraftTaxLine {
  readonly vatRateCode: string
  readonly vatRate: string
}
interface SavedDraftTaxLine extends DraftTaxLine {
  readonly id: string
}

export const hasStaleDraftTax = (
  issueDate: string,
  lines: ReadonlyArray<DraftTaxLine>,
  issuer: Issuer,
): boolean => {
  const rates = periodOn(issuer.vatPeriods, issueDate)?.rates ?? []
  return lines.some((line) => !rates.some(({ code, rate }) =>
    code === line.vatRateCode && sameVatRate(rate, line.vatRate)))
}

export const staleDraftLineIds = (
  issueDate: string,
  lines: ReadonlyArray<SavedDraftTaxLine>,
  issuer: Issuer,
): ReadonlyArray<string> => {
  const rates = periodOn(issuer.vatPeriods, issueDate)?.rates ?? []
  return lines
    .filter((line) => !rates.some(({ code, rate }) =>
      code === line.vatRateCode && sameVatRate(rate, line.vatRate)))
    .map(({ id }) => id)
}

export const issuerForIssueDate = (
  issuer: Issuer,
  date: string,
): Issuer & { readonly vatRegistered: boolean } => ({
  ...issuer,
  vatRegistered: periodOn(issuer.vatPeriods, date)?.registered === true,
})

/**
 * How a VAT treatment is named on a document, category first.
 *
 * `RO_NON_VAT` is stored with `rate: "0.00"` because the model requires a rate
 * and the tax due really is nothing (cubes/invoicing/issuer/domain/vat-catalogue.ts),
 * but `0.00%` is not what the line means and not what may be printed: an
 * article 310 issuer owes the *mention of the exemption*, and the e-Factura
 * mapper drops the rate entirely for category `O`. So the category decides the
 * label and a percentage is shown only where one exists. The only categories
 * the contract admits are `S` and `O` (cubes/invoicing/domain/invoice.ts:150).
 * A draft line carries the percentage as `vatRate`, a snapshot or the catalogue as `rate`.
 */
export const vatTreatmentLabel = (treatment: {
  readonly vatCategoryCode: VatCategoryCode
  readonly rate?: string
  readonly vatRate?: string
}): string => treatment.vatCategoryCode === "O"
  ? "Scutit TVA — art. 310"
  : `TVA ${formatRate(treatment.rate ?? treatment.vatRate ?? "")}%`
