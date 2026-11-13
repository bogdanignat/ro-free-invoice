import { validationFailure } from "../../contracts/failures.ts"
import type { BuyerSnapshot, PartySnapshot } from "../../domain/invoice.ts"
import { CIUS_TEXT_LIMITS, ciusTextIssues } from "../../domain/validation.ts"
import type { IssueDetail } from "../../issues/index.ts"
import { isRomanianCountyCode } from "./romanian-counties.ts"

// A string is a party issue not coded yet (T-2692); the CIUS-RO texts carry their code.
type Issues = Array<IssueDetail | string>

const required = (value: string | undefined, field: string, issues: Issues) => {
  if (value === undefined || value.trim().length === 0) issues.push(`${field} is required`)
}

export const isValidRomanianCui = (value: string): boolean => {
  const match = /^([1-9]\d{1,9})$/.exec(value)
  if (match === null) return false
  const cui = match[1] as string
  const body = cui.slice(0, -1)
  const key = "753217532"
  const offset = key.length - body.length
  let sum = 0
  for (let index = 0; index < body.length; index += 1) {
    sum += Number(body[index]) * Number(key[offset + index])
  }
  const remainder = (sum * 10) % 11
  return Number(cui.at(-1)) === (remainder === 10 ? 0 : remainder)
}

const partyIssues = (party: PartySnapshot): Issues => {
  const issues: Issues = []
  const county = party.address.county as string | undefined
  required(party.name, "name", issues)
  required(party.address.countryCode, "address.countryCode", issues)
  required(party.address.city, "address.city", issues)
  required(party.address.street, "address.street", issues)
  required(county, "address.county", issues)
  const cius: Array<IssueDetail> = []
  ciusTextIssues("name", party.name, CIUS_TEXT_LIMITS.partyName, cius)
  ciusTextIssues("address.street", party.address.street, CIUS_TEXT_LIMITS.street, cius)
  ciusTextIssues("address.city", party.address.city, CIUS_TEXT_LIMITS.city, cius)
  ciusTextIssues("address.postalCode", party.address.postalCode, CIUS_TEXT_LIMITS.postalCode, cius)
  issues.push(...cius)
  if (party.fiscalIdentifier.trim() !== "" && !isValidRomanianCui(party.fiscalIdentifier)) issues.push("fiscalIdentifier must be a valid Romanian CUI")
  if (party.address.countryCode !== "RO") issues.push("address.countryCode must be RO")
  if (county !== undefined && county !== "" && !isRomanianCountyCode(county)) {
    issues.push("address.county must be a Romanian ISO 3166-2 county code")
  }
  if (party.address.county === "RO-B") {
    if (!Number.isInteger(party.address.sector) || (party.address.sector ?? 0) < 1 || (party.address.sector ?? 0) > 6) {
      issues.push("address.sector must be an integer between 1 and 6 for RO-B")
    }
  } else if (party.address.sector !== undefined) issues.push("address.sector is only allowed for RO-B")
  return issues
}

export const validateParty = (party: PartySnapshot): void => {
  const issues = partyIssues(party)
  if (issues.length > 0) throw validationFailure(issues)
}

export const isValidRomanianCnp = (value: string): boolean => {
  if (!/^\d{13}$/.test(value)) return false
  const key = "279146358279"
  let sum = 0
  for (let index = 0; index < key.length; index += 1) sum += Number(value[index]) * Number(key[index])
  const remainder = sum % 11
  return Number(value.at(-1)) === (remainder === 10 ? 1 : remainder)
}

export const validateBuyer = (buyer: BuyerSnapshot): void => {
  const issues: Issues = []
  const partyType: unknown = buyer.partyType
  if (partyType !== "company" && partyType !== "individual") issues.push("partyType must be company or individual")
  issues.push(...partyIssues({ ...buyer, fiscalIdentifier: buyer.partyType === "individual" ? "" : buyer.fiscalIdentifier }))
  if (buyer.partyType === "company" && buyer.fiscalIdentifier.trim() === "") issues.push("fiscalIdentifier is required for company")
  if (buyer.partyType === "individual" && buyer.fiscalIdentifier !== "" && !isValidRomanianCnp(buyer.fiscalIdentifier)) {
    issues.push("fiscalIdentifier must be a valid Romanian CNP")
  }
  if (buyer.partyType === "individual" && buyer.vatRegistered) issues.push("vatRegistered must be false for individual")
  if (typeof buyer.vatRegistered !== "boolean") issues.push("vatRegistered must be boolean")
  if (issues.length > 0) throw validationFailure(issues)
}
