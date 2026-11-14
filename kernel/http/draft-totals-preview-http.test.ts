import assert from "node:assert/strict"
import test from "node:test"

import { allPlugins } from "../plugins.ts"
import { withMigrated } from "../storage/postgres-rig.test-support.ts"
import { customer, dueDate, issueDate, ok, seed, serve } from "./plugins-http.test-support.ts"

/** T-2677 over HTTP: `POST /api/drafts/totals-preview` answers the saved draft's totals and writes nothing. */

const path = "/api/drafts/totals-preview"
const unit = { code: "HUR", name: "oră" }
const lines = [
  { description: "Ore", quantity: "1.333", unitPrice: "33.33", unitOfMeasure: unit, vatRateCode: "RO_STANDARD" },
  { description: "Carte", quantity: "3", unitPrice: "19.99", unitOfMeasure: unit, vatRateCode: "RO_REDUCED" },
]
const totals = ["lines", "totalExcludingVat", "vatTotal", "totalIncludingVat", "vatBreakdown"] as const
const draftCount = async (call: Awaited<ReturnType<typeof serve>>["call"]) =>
  ((await ok(call("GET", "/api/drafts"), "list drafts")).items as ReadonlyArray<unknown>).length

void test("the preview answers the totals the saved draft gets, without a key and without writing", async () => {
  await withMigrated("draft_totals_preview_http", async (fixture) => {
    const served = await serve(fixture, allPlugins)
    const { call } = served
    try {
      await seed(served)
      const preview = await ok(call("POST", path, { issueDate, lines }), "preview")
      assert.equal(await draftCount(call), 0)
      const draft = await ok(call("POST", "/api/drafts", { customer, series: "QWBE", issueDate, dueDate, lines }, "preview-draft"), "draft")
      const savedLines = (draft.lines as ReadonlyArray<Record<string, unknown>>)
        .map(({ totalExcludingVat, vatAmount, totalIncludingVat }) => ({ totalExcludingVat, vatAmount, totalIncludingVat }))
      assert.deepEqual(totals.map((key) => preview[key]), totals.map((key) => key === "lines" ? savedLines : draft[key]))
      assert.equal(await draftCount(call), 1)

      const refused = async (body: unknown) => {
        const { status, body: answer } = await call("POST", path, body)
        assert.equal(status, 400, JSON.stringify(answer))
        return (answer as { readonly details: ReadonlyArray<{ readonly code: string; readonly field?: string }> }).details
          .map(({ code, field }) => [code, field])
      }
      const line = { quantity: "1", unitPrice: "100", vatRateCode: "RO_STANDARD" }
      assert.deepEqual(await refused({ issueDate, lines: [{ ...line, quantity: "abc" }] }), [["decimal_syntax", "quantity"]])
      assert.deepEqual(await refused({ issueDate, lines: [{ ...line, vatRateCode: "NOPE" }] }), [["vat_configuration_unresolved", "vatRateCode"]])
      assert.deepEqual(await refused({ issueDate: "2026-02-30", lines: [line] }), [["date_invalid", "issueDate"]])
      assert.equal((await call("POST", path, { issueDate, lines: Array.from({ length: 501 }, () => line) })).status, 400)
      assert.equal(await draftCount(call), 1)

      // The static segment wins over `/drafts/:id` for every method: GET is this path's 405, not a draft lookup.
      const wrongMethod = await call("GET", path)
      assert.deepEqual([wrongMethod.status, wrongMethod.body], [405, { error: "method_not_allowed" }])

      const headers = { origin: served.origin, "content-type": "application/json" }
      const body = JSON.stringify({ issueDate, lines })
      const withoutCsrf = await fetch(`${served.origin}${path}`, { method: "POST", headers: { ...headers, cookie: served.cookie }, body })
      assert.equal(withoutCsrf.status, 403)
      assert.equal(((await withoutCsrf.json()) as { readonly error: string }).error, "csrf_validation_failed")
      const anonymous = await fetch(`${served.origin}${path}`, { method: "POST", headers: { ...headers, "x-csrf-token": served.csrfToken }, body })
      assert.equal(anonymous.status, 401)
    } finally {
      await served.close()
    }
  })
})
