import assert from "node:assert/strict"
import test from "node:test"

import { excludedLinesNote, lineTotalsByKey, totalsCard, totalsPreviewModel, totalsPreviewRequest } from "./use-totals-preview.ts"
import { ApiFailure } from "../lib/api-errors.ts"
import type { TotalsPreview } from "../lib/draft-totals-preview.ts"

const line = (key: string, quantity: string, unitPrice: string, vatRateCode: string) => ({ key, quantity, unitPrice, vatRateCode })
const lineTotals = (total: string) => ({ totalExcludingVat: total, vatAmount: "0.00", totalIncludingVat: total })
const preview = (...totals: ReadonlyArray<string>): TotalsPreview => ({
  lines: totals.map(lineTotals), vatBreakdown: [], totalExcludingVat: "1.00", vatTotal: "0.00", totalIncludingVat: "1.00",
})

void test("only complete lines are sent, in order, and the incomplete ones are counted", () => {
  const lines = [line("a", "2", "10", "RO_STANDARD"), line("b", "1", " ", "RO_STANDARD"), line("c", "", "5", ""), line("d", "1", "5", "RO_REDUCED")]
  assert.deepEqual(totalsPreviewRequest("2026-11-14", "", lines), {
    input: { issueDate: "2026-11-14", lines: [
      { quantity: "2", unitPrice: "10", vatRateCode: "RO_STANDARD" }, { quantity: "1", unitPrice: "5", vatRateCode: "RO_REDUCED" },
    ] },
    lineKeys: ["a", "d"],
    excluded: 2,
  })
})

void test("the supply date is sent only when filled in", () => {
  const lines = [line("a", "1", "1", "RO_STANDARD")]
  assert.equal("supplyDate" in (totalsPreviewRequest("2026-11-14", "", lines).input ?? {}), false)
  assert.equal(totalsPreviewRequest("2026-11-14", "2026-11-01", lines).input?.supplyDate, "2026-11-01")
})

void test("without a complete line there is nothing to ask", () => {
  assert.deepEqual(totalsPreviewRequest("2026-11-14", "", [line("a", "1", "", "RO_STANDARD")]), { input: undefined, lineKeys: [], excluded: 1 })
  assert.deepEqual(totalsPreviewRequest("2026-11-14", "", []), { input: undefined, lineKeys: [], excluded: 0 })
})

void test("line totals land on the keys the answer was asked for, only for lines that still count", () => {
  const answer = { lineKeys: ["a", "b"], preview: preview("10.00", "20.00") }
  assert.deepEqual([...lineTotalsByKey(answer, ["a", "b"])], [["a", lineTotals("10.00")], ["b", lineTotals("20.00")]])
  // Line "a" was deleted or emptied since: "b" keeps its own total, never "a"'s.
  assert.deepEqual([...lineTotalsByKey(answer, ["b", "c"])], [["b", lineTotals("20.00")]])
  assert.equal(lineTotalsByKey(undefined, ["a"]).size, 0)
  assert.equal(lineTotalsByKey({ lineKeys: ["a", "b"], preview: preview("10.00") }, ["a", "b"]).size, 1)
})

void test("the card: no lines, loading, a refusal in Romanian, a retryable failure, the totals", () => {
  const input = { issueDate: "2026-11-14", lines: [{ quantity: "1", unitPrice: "1", vatRateCode: "RO_STANDARD" }] }
  const answer = { lineKeys: ["a"], preview: preview("1.00") }
  assert.deepEqual(totalsCard(undefined, answer, null), { kind: "empty" })
  assert.deepEqual(totalsCard(input, undefined, null), { kind: "loading" })
  const refusal = new ApiFailure({ message: "Cota TVA nu există la data documentului.", status: 400 })
  assert.deepEqual(totalsCard(input, undefined, refusal), { kind: "refused", message: "Cota TVA nu există la data documentului." })
  assert.deepEqual(totalsCard(input, answer, new ApiFailure({ message: "offline" })), { kind: "unavailable" })
  assert.deepEqual(totalsCard(input, undefined, new ApiFailure({ message: "down", status: 503 })), { kind: "unavailable" })
  assert.deepEqual(totalsCard(input, undefined, new Error("decode")), { kind: "unavailable" })
  assert.deepEqual(totalsCard(input, answer, null), { kind: "totals", totals: answer.preview })
})

void test("the left-out lines are counted in Romanian", () => {
  assert.equal(excludedLinesNote(0), null)
  assert.equal(excludedLinesNote(1), "O linie incompletă nu este inclusă în totaluri.")
  assert.equal(excludedLinesNote(3), "3 linii incomplete nu sunt incluse în totaluri.")
  assert.equal(excludedLinesNote(20), "20 de linii incomplete nu sunt incluse în totaluri.")
})

void test("a value mid-typing keeps its line out until it is a number the server reads", () => {
  for (const quantity of ["12.", "1,5", ".5", "-1", "1e3"]) {
    assert.equal(totalsPreviewRequest("2026-11-14", "", [line("a", quantity, "10", "RO_STANDARD")]).excluded, 1, quantity)
  }
  assert.equal(totalsPreviewRequest("2026-11-14", "", [line("a", " 12.5 ", "10.00", "RO_STANDARD")]).excluded, 0)
})

void test("the model: busy through the debounce and the fetch, never on an empty card", () => {
  const typed = totalsPreviewRequest("2026-11-14", "", [line("a", "2", "1000", "RO_STANDARD")])
  const sent = totalsPreviewRequest("2026-11-14", "", [line("a", "2", "100", "RO_STANDARD")])
  const answered = { data: { lineKeys: ["a"], preview: preview("200.00") }, error: null, isFetching: false }
  const debouncing = totalsPreviewModel(typed, sent, answered)
  assert.deepEqual([debouncing.card.kind, debouncing.busy], ["totals", true])
  assert.equal(totalsPreviewModel(typed, typed, { ...answered, isFetching: true }).busy, true)
  // A new object with the same lines (a description edited) asks nothing new.
  assert.equal(totalsPreviewModel(typed, totalsPreviewRequest("2026-11-14", "", [line("a", "2", "1000", "RO_STANDARD")]), answered).busy, false)
  const empty = totalsPreviewRequest("2026-11-14", "", [])
  assert.deepEqual(totalsPreviewModel(empty, sent, answered), { card: { kind: "empty" }, excludedNote: null, busy: false, lineTotals: new Map() })
})

void test("the model never shows a kept answer about lines that are all gone", () => {
  // Every line deleted, then a new one: the query keeps the old answer as placeholder, even under skipToken.
  const fresh = totalsPreviewRequest("2026-11-14", "", [line("n", "1", "5", "RO_STANDARD")])
  const old = { data: { lineKeys: ["a", "b"], preview: preview("10.00", "20.00") }, error: null, isFetching: false }
  const model = totalsPreviewModel(fresh, totalsPreviewRequest("2026-11-14", "", []), old)
  assert.deepEqual([model.card.kind, model.busy, model.lineTotals.size], ["loading", true, 0])
  // An answer that still covers a line stays, marked busy, while the next one loads.
  const kept = totalsPreviewModel(totalsPreviewRequest("2026-11-14", "", [line("b", "1", "5", "RO_STANDARD")]), fresh, old)
  assert.deepEqual([kept.card.kind, kept.busy, [...kept.lineTotals.keys()]], ["totals", true, ["b"]])
})
