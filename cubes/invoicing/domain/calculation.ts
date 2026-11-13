import { validationFailure } from "../contracts/failures.ts"
import { divideHalfUp, formatDecimal, parseUnsignedDecimal } from "../money/index.ts"
import type { DraftInvoice, DraftLine, ItemIdentifiers, VatBreakdown, VatConfiguration } from "./invoice.ts"
import * as issue from "../issues/index.ts"
import { itemIdentifiers, normalizeUnitOfMeasure, type UnitOfMeasure } from "../items/index.ts"
import { validateVatTreatment } from "./validation.ts"

const parseScaled = (value: string, scale: number, field: string): bigint => {
  const parsed = parseUnsignedDecimal(value.trim(), scale)
  if (parsed.ok) return parsed.units
  throw validationFailure([parsed.reason === "syntax" ? issue.decimalSyntax(field) : issue.decimalPlaces(field, scale)])
}

export const normalizeMoney = (value: string, field = "money"): string =>
  formatDecimal(parseScaled(value, 2, field), 2)

export const calculateLine = (input: ItemIdentifiers & {
  readonly id: string
  readonly description: string
  readonly quantity: string
  readonly unitPrice: string
  readonly unitOfMeasure: UnitOfMeasure
  readonly vat: VatConfiguration
}): DraftLine => {
  validateVatTreatment(input.vat.code, input.vat.rate, input.vat.vatCategoryCode, input.vat.vatExemptionReason)
  if (input.description.trim().length === 0) throw validationFailure([issue.required("description")])
  const quantity = parseScaled(input.quantity, 4, "quantity")
  const unitPrice = parseScaled(input.unitPrice, 2, "unitPrice")
  const vatRate = parseScaled(input.vat.rate, 2, "vatRate")
  if (quantity === 0n) throw validationFailure([issue.quantityZero()])
  const net = divideHalfUp(quantity * unitPrice, 10_000n)
  const vat = divideHalfUp(net * vatRate, 10_000n)
  return {
    id: input.id,
    description: input.description.trim(),
    quantity: formatDecimal(quantity, 4),
    unitPrice: formatDecimal(unitPrice, 2),
    unitOfMeasure: normalizeUnitOfMeasure(input.unitOfMeasure),
    vatRateCode: input.vat.code,
    vatRate: formatDecimal(vatRate, 2),
    vatCategoryCode: input.vat.vatCategoryCode,
    vatExemptionReason: input.vat.vatExemptionReason,
    totalExcludingVat: formatDecimal(net, 2),
    vatAmount: formatDecimal(vat, 2),
    totalIncludingVat: formatDecimal(net + vat, 2),
    ...itemIdentifiers(input),
  }
}

const moneyToMinor = (value: string): bigint => parseScaled(value, 2, "money")
const mismatch = (detail: issue.IssueDetail): never => { throw validationFailure([detail]) }
const lineValue = (line: DraftLine): string => `${line.totalExcludingVat}|${line.vatAmount}|${line.totalIncludingVat}`

export const calculateTotals = (lines: ReadonlyArray<DraftLine>) => {
  const groups = new Map<string, { line: DraftLine; base: bigint }>()
  let totalExcludingVat = 0n
  for (const line of lines) {
    const checked = calculateLine({ ...line, vat: { code: line.vatRateCode, rate: line.vatRate,
      vatCategoryCode: line.vatCategoryCode, vatExemptionReason: line.vatExemptionReason, effectiveFrom: "0000-01-01" } })
    if (lineValue(line) !== lineValue(checked)) mismatch(issue.lineTotalsInconsistent())
    const base = moneyToMinor(line.totalExcludingVat)
    totalExcludingVat += base
    // The zero beside O is a placeholder, so all O lines share one group.
    const key = line.vatCategoryCode === "O" ? "O" : `${line.vatCategoryCode}:${formatDecimal(parseScaled(line.vatRate, 2, "vatRate"), 2)}`
    const current = groups.get(key)
    if (current !== undefined && (current.line.vatRateCode !== line.vatRateCode
      || current.line.vatExemptionReason !== line.vatExemptionReason)) {
      mismatch(issue.vatGroupInconsistent(key))
    }
    groups.set(key, { line, base: (current?.base ?? 0n) + base })
  }
  let vatTotal = 0n
  const vatBreakdown: ReadonlyArray<VatBreakdown> = [...groups.values()].map(({ line, base }) => {
    const vat = divideHalfUp(base * parseScaled(line.vatRate, 2, "vatRate"), 10_000n)
    vatTotal += vat
    return {
      code: line.vatRateCode,
      rate: line.vatRate,
      vatCategoryCode: line.vatCategoryCode,
      vatExemptionReason: line.vatExemptionReason,
      vatBaseAmount: formatDecimal(base, 2),
      vatAmount: formatDecimal(vat, 2),
    }
  })
  return {
    totalExcludingVat: formatDecimal(totalExcludingVat, 2),
    vatTotal: formatDecimal(vatTotal, 2),
    totalIncludingVat: formatDecimal(totalExcludingVat + vatTotal, 2),
    vatBreakdown,
  }
}

type FiscalDocument = Pick<DraftInvoice, "lines" | "vatBreakdown" | "totalExcludingVat" | "vatTotal" | "totalIncludingVat">
const breakdownValue = ({ code, rate, vatCategoryCode, vatExemptionReason, vatBaseAmount, vatAmount }: VatBreakdown): string =>
  JSON.stringify([code, rate, vatCategoryCode, vatExemptionReason, vatBaseAmount, vatAmount])

export const validateFiscalDocument = (document: FiscalDocument): void => {
  if (document.lines.length === 0) mismatch(issue.documentWithoutLines())
  const expected = calculateTotals(document.lines)
  const value = (document: Omit<FiscalDocument, "lines">): string => JSON.stringify([document.totalExcludingVat,
    document.vatTotal, document.totalIncludingVat, document.vatBreakdown.map(breakdownValue).sort()])
  if (value(document) !== value(expected)) mismatch(issue.documentTotalsInconsistent())
}
