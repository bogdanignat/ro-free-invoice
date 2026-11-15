import { validationFailure } from "../../contracts/failures.ts"
import * as issue from "../../issues/index.ts"
import { formatDecimal, parseUnsignedDecimal } from "../../money/index.ts"
import type { IssuerCompanySnapshot } from "../../domain/invoice.ts"

type CompanyDetails = Pick<IssuerCompanySnapshot, "legalForm" | "tradeRegistryNumber" | "iban" | "bankName" | "socialCapital">
const fail = (detail: issue.IssueDetail): never => { throw validationFailure([detail]) }

const text = (value: unknown, field: string): string => typeof value === "string" ? value : fail(issue.invalidInput(field))

export const normalizeIssuerDetails = (input: CompanyDetails): CompanyDetails => {
  const legalForm: unknown = input.legalForm
  if (legalForm !== "srl" && legalForm !== "pfa") return fail(issue.legalFormInvalid())
  const tradeRegistryNumber = text(input.tradeRegistryNumber, "tradeRegistryNumber").trim().toUpperCase()
  if (tradeRegistryNumber !== "" && (tradeRegistryNumber.length > 32
    || !/^(?:[JF]\d{1,2}\/\d+\/\d{4}|[JF]\d{13})$/.test(tradeRegistryNumber))) {
    return fail(issue.tradeRegistryInvalid())
  }
  const bankName = text(input.bankName, "bankName").trim()
  if (Array.from(bankName).length > 120 || /[\p{C}\p{Zl}\p{Zp}]/u.test(bankName)) {
    return fail(issue.bankNameInvalid())
  }
  const rawCapital = text(input.socialCapital, "socialCapital").trim()
  let socialCapital = ""
  if (rawCapital !== "") {
    const parsed = parseUnsignedDecimal(rawCapital, 2)
    if (!parsed.ok || (rawCapital.split(".")[0] ?? "").length > 16) {
      return fail(issue.socialCapitalInvalid())
    }
    socialCapital = formatDecimal(parsed.units, 2)
  }
  const iban = text(input.iban, "iban").replace(/\s/gu, "").toUpperCase()
  if (iban !== "") {
    if (iban.length < 15 || iban.length > 34 || !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)
      || (iban.startsWith("RO") && iban.length !== 24)) return fail(issue.ibanInvalid())
    let remainder = 0
    for (const character of `${iban.slice(4)}${iban.slice(0, 4)}`) {
      const digits = character >= "A" && character <= "Z" ? String(character.charCodeAt(0) - 55) : character
      for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
    }
    if (remainder !== 1) return fail(issue.ibanChecksum())
  }
  return { legalForm, tradeRegistryNumber, iban, bankName, socialCapital }
}

// Validate the stored snapshot itself; never substitute today's issuer when
// converting a proforma or correcting a previously issued invoice.
export const validateIssuerForIssuance = (issuer: CompanyDetails): void => {
  const normalized = normalizeIssuerDetails(issuer)
  const issues: Array<issue.IssueDetail> = []
  for (const field of Object.keys(normalized) as (keyof CompanyDetails)[]) {
    if (issuer[field] !== normalized[field]) issues.push(issue.notCanonical(field))
  }
  if (normalized.tradeRegistryNumber === "") issues.push(issue.requiredForIssuance("tradeRegistryNumber"))
  if (normalized.legalForm === "srl" && normalized.socialCapital === "") issues.push(issue.socialCapitalRequired())
  if (issues.length > 0) throw validationFailure(issues)
}
