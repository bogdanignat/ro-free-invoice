import type { NonVatBasis, VatPeriod } from "./draft-models.ts"
import { parseUnsignedDecimal } from "./money.ts"

export const romanianCuiPattern = "[1-9][0-9]{1,9}"
/** Trimmed, upper-cased, without the `RO` VAT prefix and the space after it: `" ro 14399840"` is `"14399840"`. */
export const normalizeRomanianCui = (value: string): string =>
  value.trim().toUpperCase().replace(/^RO\s*/u, "").trim()

export const activeOn = (
  value: { readonly effectiveFrom: string; readonly effectiveTo?: string },
  date: string,
): boolean => value.effectiveFrom <= date
  && (value.effectiveTo === undefined || date <= value.effectiveTo)

/** A rate in hundredths of a percent: trimmed, at most three integer digits and two decimals. */
const scaledVatRate = (rate: string): bigint | undefined => {
  const text = rate.trim()
  const parsed = /^\d{1,3}(?:\.|$)/u.test(text) ? parseUnsignedDecimal(text, 2) : undefined
  return parsed?.ok === true ? parsed.units : undefined
}

export const sameVatRate = (left: string, right: string): boolean =>
  scaledVatRate(left) !== undefined && scaledVatRate(left) === scaledVatRate(right)

/** The period of the issuer's VAT timeline that covers `date`, if any. */
export const periodOn = (periods: ReadonlyArray<VatPeriod>, date: string): VatPeriod | undefined =>
  periods.find((period) => activeOn(period, date))

// The code a line gets when a product is chosen: the product's preferred rate
// when the period offers it, otherwise the period's default. An Article 310
// period offers no taxable rate, so the exemption wins over the preference.
export const presetVatCode = (preferred: string | undefined, period: VatPeriod | undefined): string =>
  preferred !== undefined && period?.rates.some(({ code, kind }) => code === preferred && kind !== "non_vat") === true
    ? preferred
    : period?.defaultCode ?? ""

export type { NonVatBasis }
