import type { VatPeriod, VatRate } from "./draft-models.ts"

/** One stretch of the issuer's VAT timeline as `GET /api/issuer` answers it; the default is the standard rate, else the first. */
export const vatPeriod = (
  effectiveFrom: string,
  effectiveTo: string | undefined,
  registered: boolean | null,
  rates: ReadonlyArray<VatRate> = [],
): VatPeriod => ({
  effectiveFrom, ...(effectiveTo === undefined ? {} : { effectiveTo }), registered, rates,
  defaultCode: (rates.find(({ kind }) => kind === "standard") ?? rates[0])?.code ?? null,
})
