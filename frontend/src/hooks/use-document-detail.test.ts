import assert from "node:assert/strict"
import test from "node:test"

import { documentRead, type QueryRead } from "./use-document-detail.ts"
import { ApiFailure } from "../lib/api-errors.ts"
import type { ReferenceData } from "../lib/authoring-reference-decoders.ts"
import type { DocumentSnapshotView } from "../lib/document-projection.ts"
import { COUNTIES } from "../lib/romanian-counties.test-support.ts"

interface Calls { document: number; reference: number }

const read = <Data>(patch: Partial<QueryRead<Data>>, calls: Calls, key: keyof Calls): QueryRead<Data> => ({
  data: undefined, isPending: false, error: null, refetch: () => { calls[key] += 1 }, ...patch,
})

const reference: ReferenceData = {
  counties: COUNTIES,
  textLimits: { partyName: 200, street: 150, city: 50, postalCode: 20, lineDescription: 100, documentNotes: 300 },
}

// The view only carries the county name it was projected with.
const project = (county: string, counties: ReadonlyArray<{ code: string; name: string }>): DocumentSnapshotView => ({
  heading: counties.find((entry) => entry.code === county)?.name ?? county,
  facts: [], parties: [], lines: [], vatRows: [], totals: [], notes: null, originalInvoice: null,
})

const gateway = () => new ApiFailure({ message: "gateway", status: 502 })

void test("a document read waits for the county names instead of printing a bare code", () => {
  const calls = { document: 0, reference: 0 }
  const waiting = documentRead(read({ data: "RO-B" }, calls, "document"), project, read({ isPending: true }, calls, "reference"))
  assert.equal(waiting.view, undefined)
  assert.equal(waiting.isPending, true)
  const shown = documentRead(read({ data: "RO-B" }, calls, "document"), project, read({ data: reference }, calls, "reference"))
  assert.equal(shown.view?.heading, "București")
  assert.equal(shown.isPending, false)
})

void test("failed county names show their error and retry only what is missing", () => {
  const calls = { document: 0, reference: 0 }
  const failure = gateway()
  const failed = documentRead(read({ data: "RO-B" }, calls, "document"), project, read({ error: failure }, calls, "reference"))
  assert.equal(failed.view, undefined)
  assert.equal(failed.isPending, false)
  assert.equal(failed.error, failure)
  failed.retry?.()
  assert.deepEqual(calls, { document: 0, reference: 1 })
})

void test("the document's own failure wins, and a refused read offers no retry", () => {
  const calls = { document: 0, reference: 0 }
  const failure = gateway()
  const failed = documentRead(read<string>({ error: failure }, calls, "document"), project, read({ data: reference }, calls, "reference"))
  assert.equal(failed.error, failure)
  failed.retry?.()
  assert.deepEqual(calls, { document: 1, reference: 0 })
  const missing = new ApiFailure({ message: "absent", status: 404 })
  assert.equal(documentRead(read<string>({ error: missing }, calls, "document"), project, read({ data: reference }, calls, "reference")).retry, undefined)
})
