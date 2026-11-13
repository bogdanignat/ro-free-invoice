import { validationFailure } from "../../contracts/failures.ts"
import type { VatConfiguration } from "../../domain/invoice.ts"
import { validateDate } from "../../domain/validation.ts"
import { supplyDateAfterIssue, vatRegistrationMissing } from "../../issues/index.ts"
import { currentVatRegistration, resolveVatConfiguration, type IssuerProfile } from "../../issuer/index.ts"

type SuppliedDocument = { readonly issueDate: string; readonly supplyDate?: string }

/** The date the VAT follows (art. 280 alin. (4), art. 291 alin. (4) Cod fiscal): the supply, or the issue when none is set. */
export const effectiveSupplyDate = (document: SuppliedDocument): string => document.supplyDate ?? document.issueDate

/** Art. 319 alin. (20) lit. c): the supply date is written when earlier; no invoice is issued ahead of its supply. */
export const validateSupplyDate = (supplyDate: string, issueDate: string): void => {
  validateDate(supplyDate, "supplyDate")
  if (supplyDate > issueDate) throw validationFailure([supplyDateAfterIssue()])
}

/** A line's VAT on the document's supply date; a regime that does not cover that date is named as such. */
export const lineVat = (issuer: IssuerProfile, vatRateCode: string, document: SuppliedDocument): VatConfiguration => {
  const date = effectiveSupplyDate(document)
  if (currentVatRegistration(issuer.vatConfigurations, date) === undefined) throw validationFailure([vatRegistrationMissing(date)])
  return resolveVatConfiguration(issuer, vatRateCode, date)
}
