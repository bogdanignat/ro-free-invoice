import { ValidationFailure, validationFailure } from "../../contracts/failures.ts"
import { compareDecimal } from "../../money/index.ts"
import type { DraftLine, VatConfiguration } from "../../domain/invoice.ts"
import type { IssuerProfile, VatChange } from "./issuer.ts"
import { validateVatTreatment } from "../../domain/validation.ts"
import {
  nonVatBasisInvalid, nonVatBasisNotAllowed, vatCatalogueNotCovered, vatConfigurationInconsistent,
  vatPairNeedsNonVat, vatPairNeedsVat, vatPairUnsupported, vatRegistrationMissing,
} from "../../issues/index.ts"
import { activeOn, romanianVatRates, vatRatesOn, type VatRate } from "./vat-catalogue.ts"

type VatRegistrationPeriod = {
  readonly effectiveFrom: string
  readonly effectiveTo?: string
}
export type VatRegistration = VatRegistrationPeriod & (
  | { readonly registered: true; readonly nonVatBasis?: never }
  | { readonly registered: false; readonly nonVatBasis: "article_310" }
)

type VatPair = Pick<VatConfiguration, "code" | "rate" | "vatCategoryCode" | "vatExemptionReason">
const samePair = (left: VatPair, right: VatPair): boolean => left.code === right.code
  && compareDecimal(left.rate, right.rate) === 0 && left.vatCategoryCode === right.vatCategoryCode
  && left.vatExemptionReason === right.vatExemptionReason
const fitsRegime = (kind: VatRate["kind"], registered: boolean): boolean => (kind === "non_vat") !== registered

/** The one rule for whether the configurations active on a date make the issuer VAT-registered; throws when they form no regime. */
const registeredOn = (active: ReadonlyArray<VatConfiguration>, date: string): boolean => {
  active.forEach(({ code, rate, vatCategoryCode, vatExemptionReason }) => {
    validateVatTreatment(code, rate, vatCategoryCode, vatExemptionReason)
  })
  const nonVat = active.every((configuration) => configuration.code === "RO_NON_VAT")
  if (!nonVat && active.some((configuration) => configuration.code === "RO_NON_VAT")) {
    throw validationFailure([vatConfigurationInconsistent(date)])
  }
  return !nonVat
}

const vatRegistrationOn = (
  configurations: ReadonlyArray<VatConfiguration>, date: string,
): VatRegistration | undefined => {
  const active = configurations.filter((configuration) => activeOn(configuration, date))
  if (active.length === 0) return undefined
  const registered = registeredOn(active, date)
  const selected = active[0] as VatConfiguration
  const period = { effectiveFrom: selected.effectiveFrom, ...(selected.effectiveTo === undefined ? {} : { effectiveTo: selected.effectiveTo }) }
  return registered ? { registered: true, ...period } : { registered: false, nonVatBasis: "article_310", ...period }
}

export const currentVatRegistration = vatRegistrationOn

const addDays = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

const validateVatChange = (change: VatChange): void => {
  const runtime = change as { readonly registered: unknown; readonly nonVatBasis?: unknown }
  const hasBasis = Object.prototype.hasOwnProperty.call(change, "nonVatBasis")
  if ((runtime.registered !== true && runtime.registered !== false)
    || (runtime.registered ? hasBasis : !hasBasis || runtime.nonVatBasis !== "article_310")) {
    throw validationFailure([runtime.registered === true ? nonVatBasisNotAllowed() : nonVatBasisInvalid()])
  }
}

const configurationsFor = (change: VatChange): ReadonlyArray<VatConfiguration> => {
  const rates = vatRatesOn(change.effectiveFrom)
  if (rates.length === 0) throw validationFailure([vatCatalogueNotCovered(change.effectiveFrom)])
  return romanianVatRates
    .filter(({ kind }) => fitsRegime(kind, change.registered))
    .filter(({ effectiveTo }) => effectiveTo === undefined || effectiveTo >= change.effectiveFrom)
    .map(({ code, rate, vatCategoryCode, vatExemptionReason, effectiveFrom, effectiveTo }) => ({
      code, rate, vatCategoryCode, vatExemptionReason,
      effectiveFrom: effectiveFrom > change.effectiveFrom ? effectiveFrom : change.effectiveFrom,
      ...(effectiveTo === undefined ? {} : { effectiveTo }),
    }))
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
}

/** A change moves the regime only when the day it starts is not already in it; it then rewrites every day from it on. */
export const changesVatRegistration = (configurations: ReadonlyArray<VatConfiguration>, change: VatChange): boolean =>
  vatRegistrationOn(configurations, change.effectiveFrom)?.registered !== change.registered

export const scheduleVatRegistration = (
  configurations: ReadonlyArray<VatConfiguration>, change: VatChange,
): ReadonlyArray<VatConfiguration> => {
  validateVatChange(change)
  configurations.forEach(({ code, rate, vatCategoryCode, vatExemptionReason }) => {
    validateVatTreatment(code, rate, vatCategoryCode, vatExemptionReason)
  })
  if (!changesVatRegistration(configurations, change)) return configurations
  const next = configurationsFor(change)
  const kept = configurations.filter(({ effectiveFrom }) => effectiveFrom < change.effectiveFrom)
  const closed = kept.map((configuration) => activeOn(configuration, change.effectiveFrom)
    ? { ...configuration, effectiveTo: addDays(change.effectiveFrom, -1) }
    : configuration)
  return [...closed, ...next]
}

export const validateVatForIssuance = (
  issuer: IssuerProfile, issueDate: string,
  lines: ReadonlyArray<Pick<DraftLine, "vatRateCode" | "vatRate" | "vatCategoryCode" | "vatExemptionReason">>,
): void => {
  const registration = vatRegistrationOn(issuer.vatConfigurations, issueDate)
  const legal = vatRatesOn(issueDate)
  if (registration === undefined) throw validationFailure([vatRegistrationMissing(issueDate)])
  for (const line of lines) {
    validateVatTreatment(line.vatRateCode, line.vatRate, line.vatCategoryCode, line.vatExemptionReason)
    const pair = legal.find((rate) => samePair(rate, { ...line, code: line.vatRateCode, rate: line.vatRate }))
    const pairIssue = pair === undefined ? vatPairUnsupported
      : fitsRegime(pair.kind, registration.registered) ? undefined
      : registration.registered ? vatPairNeedsNonVat : vatPairNeedsVat
    if (pairIssue !== undefined) throw validationFailure([pairIssue(line.vatRateCode, line.vatRate, issueDate)])
  }
}

/** One stretch of the issuer's VAT timeline; `registered: null` when the configurations active in it form no regime. */
export interface VatPeriod {
  readonly effectiveFrom: string
  readonly effectiveTo?: string
  readonly registered: boolean | null
  readonly rates: ReadonlyArray<VatRate>
  readonly defaultCode: string | null
}

const startsOf = (values: ReadonlyArray<{ readonly effectiveFrom: string; readonly effectiveTo?: string }>): ReadonlyArray<string> =>
  values.flatMap(({ effectiveFrom, effectiveTo }) => effectiveTo === undefined ? [effectiveFrom] : [effectiveFrom, addDays(effectiveTo, 1)])

// A served profile must not fail on a broken regime: the period says so instead.
const registeredOrNull = (active: ReadonlyArray<VatConfiguration>, date: string): boolean | null => {
  try {
    return registeredOn(active, date)
  } catch (error) {
    if (error instanceof ValidationFailure) return null
    throw error
  }
}

// A rate is offered when issuance accepts its pair and saving resolves its code to exactly that pair.
const ratesOn = (active: ReadonlyArray<VatConfiguration>, date: string, registered: boolean): ReadonlyArray<VatRate> =>
  vatRatesOn(date).filter((rate) => {
    const [resolved, ...others] = active.filter(({ code }) => code === rate.code)
    return fitsRegime(rate.kind, registered) && others.length === 0 && resolved !== undefined && samePair(rate, resolved)
  }).map((rate) => ({ ...rate }))

/**
 * The issuer's VAT timeline: a period starts at every boundary of its configurations and of the legal catalogue, so each of its days answers the same.
 * The configuration dates are assumed valid ISO days: saving checks them (`validateVatConfigurations`), and only rows written outside the app could break that.
 */
export const vatPeriods = (configurations: ReadonlyArray<VatConfiguration>): ReadonlyArray<VatPeriod> => {
  const starts = [...new Set(startsOf([...configurations, ...romanianVatRates]))].sort()
  return starts.flatMap((start, index) => {
    const active = configurations.filter((configuration) => activeOn(configuration, start))
    if (active.length === 0) return []
    const next = starts[index + 1]
    const registered = registeredOrNull(active, start)
    const rates = registered === null ? [] : ratesOn(active, start, registered)
    const defaultCode = (rates.find(({ kind }) => kind === "standard") ?? rates[0])?.code ?? null
    return [{ effectiveFrom: start, ...(next === undefined ? {} : { effectiveTo: addDays(next, -1) }), registered, rates, defaultCode }]
  })
}
