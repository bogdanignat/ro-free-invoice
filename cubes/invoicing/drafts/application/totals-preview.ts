import { Effect } from "effect"

import { checked } from "../../application/support.ts"
import type { InvoicingFailure } from "../../contracts/failures.ts"
import { calculateLine, calculateTotals } from "../../domain/calculation.ts"
import type { DraftInvoice, DraftLine } from "../../domain/invoice.ts"
import type { IssuerProfile } from "../../issuer/index.ts"
import { unitOfMeasures } from "../../items/index.ts"
import { dates } from "./authoring.ts"
import { lineVat } from "./supply-date.ts"

export interface TotalsPreviewInput {
  readonly issueDate: string
  readonly supplyDate?: string | null
  readonly lines: ReadonlyArray<{ readonly quantity: string; readonly unitPrice: string; readonly vatRateCode: string }>
}

export type LineTotals = Pick<DraftLine, "totalExcludingVat" | "vatAmount" | "totalIncludingVat">
export type TotalsPreview = Pick<DraftInvoice, "vatBreakdown" | "totalExcludingVat" | "vatTotal" | "totalIncludingVat"> & {
  readonly lines: ReadonlyArray<LineTotals>
}

// calculateLine also checks description and unit, which never enter the totals: the preview passes a placeholder text and the
// catalogue's first unit (an empty catalogue fails closed as unit_invalid).
const standIn = (index: number) => ({ id: String(index), description: `line ${String(index + 1)}`, unitOfMeasure: unitOfMeasures[0] ?? { code: "", name: "" } })

/** The totals a draft with these lines would get: VAT resolved from the issuer and rounded as on save; nothing is read or written. */
export const previewTotals = (issuer: IssuerProfile, input: TotalsPreviewInput): Effect.Effect<TotalsPreview, InvoicingFailure> =>
  Effect.gen(function*() {
    const header = yield* dates(input.issueDate, undefined, input.supplyDate)
    return yield* checked(() => {
      const lines = input.lines.map((line, index) => calculateLine({
        ...standIn(index), quantity: line.quantity, unitPrice: line.unitPrice, vat: lineVat(issuer, line.vatRateCode, header),
      }))
      return {
        lines: lines.map(({ totalExcludingVat, vatAmount, totalIncludingVat }) => ({ totalExcludingVat, vatAmount, totalIncludingVat })),
        ...calculateTotals(lines),
      }
    })
  })
