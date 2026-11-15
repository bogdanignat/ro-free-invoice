import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { useAuth } from "./auth-context.ts"
import { useDebouncedValue } from "./use-debounced-value.ts"
import { draftsQueryKey } from "./use-drafts.ts"
import { useInvoicingClients } from "./use-invoicing-clients.ts"
import { ApiFailure, isTransientFailure } from "../lib/api-errors.ts"
import type { LineTotals, TotalsPreview, TotalsPreviewInput } from "../lib/draft-totals-preview.ts"
import type { EditableInvoiceLine } from "../lib/invoice-authoring-model.ts"
import { requireCsrf } from "../lib/require-csrf.ts"

const PREVIEW_DELAY_MS = 400

export interface TotalsPreviewRequest {
  /** Absent while no line has a quantity, a price and a VAT code: there is nothing to ask. */
  readonly input: TotalsPreviewInput | undefined
  /** The keys of the lines sent, in the order the server answers them. */
  readonly lineKeys: ReadonlyArray<string>
  /** Lines left out because they are not complete yet. */
  readonly excluded: number
}

/** The server's answer together with the lines it was asked about. */
export interface AnsweredPreview {
  readonly lineKeys: ReadonlyArray<string>
  readonly preview: TotalsPreview
}

export type TotalsCard =
  | { readonly kind: "empty" }
  | { readonly kind: "loading" }
  | { readonly kind: "refused"; readonly message: string }
  | { readonly kind: "unavailable" }
  | { readonly kind: "totals"; readonly totals: TotalsPreview }

export interface TotalsPreviewModel {
  readonly card: TotalsCard
  /** How many lines the totals leave out, said in words; `null` when none. */
  readonly excludedNote: string | null
  readonly busy: boolean
  readonly lineTotals: ReadonlyMap<string, LineTotals>
  readonly retry: () => void
}

type TotalsLine = Pick<EditableInvoiceLine, "key" | "quantity" | "unitPrice" | "vatRateCode">

// Only the server's own number syntax (`12`, `12.5`): a value mid-typing (`12.`, `1,5`) waits instead of being refused at each pause.
const decimal = (value: string): boolean => /^\d+(\.\d+)?$/u.test(value.trim())

const countsForTotals = (line: TotalsLine): boolean =>
  decimal(line.quantity) && decimal(line.unitPrice) && line.vatRateCode.trim() !== ""

export const totalsPreviewRequest = (issueDate: string, supplyDate: string, lines: ReadonlyArray<TotalsLine>): TotalsPreviewRequest => {
  const complete = lines.filter(countsForTotals)
  return {
    input: complete.length === 0 ? undefined : {
      issueDate,
      ...(supplyDate === "" ? {} : { supplyDate }),
      lines: complete.map(({ quantity, unitPrice, vatRateCode }) => ({ quantity, unitPrice, vatRateCode })),
    },
    lineKeys: complete.map(({ key }) => key),
    excluded: lines.length - complete.length,
  }
}

/**
 * Each line's totals under its key, aligned on the request that produced the
 * answer (an answer kept while the next loads may predate a deleted line), and
 * only for lines that still count now.
 */
export const lineTotalsByKey = (answer: AnsweredPreview | undefined, currentKeys: ReadonlyArray<string>): ReadonlyMap<string, LineTotals> => {
  const totals = new Map<string, LineTotals>()
  answer?.lineKeys.forEach((key, index) => {
    const line = answer.preview.lines[index]
    if (line !== undefined && currentKeys.includes(key)) totals.set(key, line)
  })
  return totals
}

export const excludedLinesNote = (count: number): string | null => {
  if (count === 0) return null
  if (count === 1) return "O linie incompletă nu este inclusă în totaluri."
  const of = count % 100 === 0 || count % 100 >= 20 ? "de " : ""
  return `${String(count)} ${of}linii incomplete nu sunt incluse în totaluri.`
}

/** A settled refusal (`400`) speaks in its own words; anything a retry could fix gets the short message. */
export const totalsCard = (input: TotalsPreviewInput | undefined, answer: AnsweredPreview | undefined, error: unknown): TotalsCard => {
  if (input === undefined) return { kind: "empty" }
  if (error instanceof ApiFailure && !isTransientFailure(error)) return { kind: "refused", message: error.message }
  if (error !== null && error !== undefined) return { kind: "unavailable" }
  return answer === undefined ? { kind: "loading" } : { kind: "totals", totals: answer.preview }
}

export interface PreviewQueryState {
  readonly data: AnsweredPreview | undefined
  readonly error: unknown
  readonly isFetching: boolean
}

const sameAsk = (left: TotalsPreviewRequest, right: TotalsPreviewRequest): boolean =>
  JSON.stringify([left.input, left.lineKeys]) === JSON.stringify([right.input, right.lineKeys])

/**
 * The card from what is typed now (`request`), what was last sent (`asked`,
 * debounced) and the query's answer. An answer kept while the next loads is
 * shown only if it covers a line still there: after every line is deleted and
 * a new one added, the deleted lines' totals never reappear. Busy covers the
 * debounce too, so totals older than the lines are never shown as current.
 */
export const totalsPreviewModel = (request: TotalsPreviewRequest, asked: TotalsPreviewRequest, query: PreviewQueryState):
Omit<TotalsPreviewModel, "retry"> => {
  const answer = query.data?.lineKeys.some((key) => request.lineKeys.includes(key)) === true ? query.data : undefined
  const card = totalsCard(request.input, answer, query.error)
  return {
    card,
    excludedNote: card.kind === "empty" ? null : excludedLinesNote(request.excluded),
    busy: card.kind !== "empty" && (!sameAsk(request, asked) || query.isFetching || card.kind === "loading"),
    lineTotals: lineTotalsByKey(answer, request.lineKeys),
  }
}

/**
 * The server's totals for the lines as typed, asked once the editing pauses.
 * Nothing is computed here: the preview is the backend's own calculation.
 */
export const useTotalsPreview = (issueDate: string, supplyDate: string, lines: ReadonlyArray<EditableInvoiceLine>): TotalsPreviewModel => {
  const auth = useAuth()
  const clients = useInvoicingClients()
  // Memoised so the debounce settles on a stable value instead of a new object every render.
  const request = useMemo(() => totalsPreviewRequest(issueDate, supplyDate, lines), [issueDate, supplyDate, lines])
  const asked = useDebouncedValue(request, PREVIEW_DELAY_MS)
  const { input, lineKeys } = asked
  const query = useQuery({
    queryKey: [...draftsQueryKey, "totals-preview", input, lineKeys],
    enabled: auth.status === "authenticated",
    placeholderData: keepPreviousData,
    // A refusal is settled and a network failure has its own retry button.
    retry: false,
    queryFn: input === undefined ? skipToken : async ({ signal }): Promise<AnsweredPreview> => ({
      lineKeys, preview: await clients.drafts.previewDraftTotals(requireCsrf(auth.csrfToken()), input, signal),
    }),
  })
  return { ...totalsPreviewModel(request, asked, query), retry: () => { void query.refetch() } }
}
