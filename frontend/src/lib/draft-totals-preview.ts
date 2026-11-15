import { decodeVatBreakdown } from "./draft-decoders.ts"
import type { DraftInvoice, DraftLineInput } from "./draft-models.ts"
import { array, object, text, type Decoder } from "./model-decoder.ts"

/** `POST /api/drafts/totals-preview`: only these fields decide the totals; a full line may be sent, the rest is ignored. */
export interface TotalsPreviewInput {
  readonly issueDate: string
  readonly supplyDate?: string | null
  readonly lines: ReadonlyArray<Pick<DraftLineInput, "quantity" | "unitPrice" | "vatRateCode">>
}

export interface LineTotals {
  readonly totalExcludingVat: string
  readonly vatAmount: string
  readonly totalIncludingVat: string
}

/** The server's totals for unsaved lines, in the order sent; the UI shows them and computes nothing. */
export type TotalsPreview = Pick<DraftInvoice, "vatBreakdown" | "totalExcludingVat" | "vatTotal" | "totalIncludingVat"> & {
  readonly lines: ReadonlyArray<LineTotals>
}

const decodeLineTotals: Decoder<LineTotals> = (input) => {
  const value = object(input)
  return {
    totalExcludingVat: text(value.totalExcludingVat, "totalExcludingVat"),
    vatAmount: text(value.vatAmount, "vatAmount"),
    totalIncludingVat: text(value.totalIncludingVat, "totalIncludingVat"),
  }
}

export const decodeTotalsPreview: Decoder<TotalsPreview> = (input) => {
  const value = object(input)
  return {
    lines: array(value.lines, decodeLineTotals, "lines"),
    vatBreakdown: array(value.vatBreakdown, decodeVatBreakdown, "vatBreakdown"),
    totalExcludingVat: text(value.totalExcludingVat, "totalExcludingVat"),
    vatTotal: text(value.vatTotal, "vatTotal"),
    totalIncludingVat: text(value.totalIncludingVat, "totalIncludingVat"),
  }
}
