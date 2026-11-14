import { ValidationFailure, validationFailure } from "../../contracts/failures.ts"
import * as issue from "../../issues/index.ts"
import type { VatConfiguration } from "../../domain/invoice.ts"
import type { IssuerProfile } from "./issuer.ts"
import { maximumPaymentTermDays, validateDate, validateVatTreatment } from "../../domain/validation.ts"
import { normalizeIssuerDetails } from "./issuer-details.ts"
import { isValidRomanianCui, validateParty } from "../../parties/index.ts"

export const resolveVatConfiguration = (
  issuer: IssuerProfile,
  code: string,
  issueDate: string,
): VatConfiguration => {
  const matches = issuer.vatConfigurations.filter((configuration) =>
    configuration.code === code
    && configuration.effectiveFrom <= issueDate
    && (configuration.effectiveTo === undefined || issueDate <= configuration.effectiveTo))
  if (matches.length !== 1) {
    throw validationFailure([issue.vatConfigurationUnresolved(code, issueDate)])
  }
  return matches[0] as VatConfiguration
}

export const normalizeBrandingText = (value: string | null): string | null => {
  if (value === null) return null
  const text = value.trim()
  if (text.length === 0) return null
  if (Array.from(text).length > 80) throw validationFailure([issue.tooLong("branding.text", 80)])
  if (/\p{C}/u.test(text)) throw validationFailure([issue.containsControlCharacters("branding.text")])
  return text
}

type Issues = Array<issue.IssueDetail>

const dateIssues = (configuration: VatConfiguration): Issues => {
  const issues: Issues = []
  try {
    validateDate(configuration.effectiveFrom, `vatConfigurations.${configuration.code}.effectiveFrom`)
    if (configuration.effectiveTo !== undefined) {
      validateDate(configuration.effectiveTo, `vatConfigurations.${configuration.code}.effectiveTo`)
      if (configuration.effectiveTo < configuration.effectiveFrom) issues.push(issue.vatConfigurationRangeInvalid(configuration.code))
    }
  } catch (error) {
    if (error instanceof ValidationFailure) issues.push(...error.details)
  }
  return issues
}

const validateVatConfigurations = (configurations: ReadonlyArray<VatConfiguration>): void => {
  const issues: Issues = []
  if (configurations.length === 0) issues.push(issue.vatConfigurationsEmpty())
  for (const configuration of configurations) {
    if (!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(configuration.code)) issues.push(issue.vatConfigurationCodeInvalid())
    if (!/^(?:\d|[1-9]\d|100)(?:\.\d{1,2})?$/.test(configuration.rate)) issues.push(issue.vatConfigurationRateInvalid(configuration.code))
    try { validateVatTreatment(configuration.code, configuration.rate, configuration.vatCategoryCode, configuration.vatExemptionReason) }
    catch (error) { if (error instanceof ValidationFailure) issues.push(...error.details); else throw error }
    issues.push(...dateIssues(configuration))
  }
  const ordered = [...configurations].sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
  ordered.forEach((value, index) => {
    if (ordered.slice(0, index).some((previous) => (
      previous.code === value.code || previous.code === "RO_NON_VAT" || value.code === "RO_NON_VAT"
    ) && (previous.effectiveTo === undefined || value.effectiveFrom <= previous.effectiveTo))) {
      issues.push(issue.vatConfigurationsOverlap())
    }
  })
  if (issues.length > 0) throw validationFailure(issues)
}

export const validateIssuerProfile = (issuer: Omit<IssuerProfile, "vatConfigurations">): void => {
  validateParty(issuer)
  normalizeIssuerDetails(issuer)
  const issues: Issues = []
  if (!isValidRomanianCui(issuer.fiscalIdentifier)) issues.push(issue.cuiInvalid())
  if (issuer.defaultCurrency !== "RON") issues.push(issue.currencyNotRon("defaultCurrency"))
  if (!Number.isInteger(issuer.defaultPaymentTermDays) || issuer.defaultPaymentTermDays < 0
    || issuer.defaultPaymentTermDays > maximumPaymentTermDays) {
    issues.push(issue.integerOutOfRange("defaultPaymentTermDays", 0, maximumPaymentTermDays))
  }
  if (issues.length > 0) throw validationFailure(issues)
}

export const validateIssuer = (issuer: IssuerProfile): void => {
  validateIssuerProfile(issuer)
  validateVatConfigurations(issuer.vatConfigurations)
}
