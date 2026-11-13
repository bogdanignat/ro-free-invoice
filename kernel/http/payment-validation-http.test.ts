import assert from "node:assert/strict"
import test from "node:test"

import { allPlugins } from "../plugins.ts"
import { withMigrated } from "../storage/postgres-rig.test-support.ts"
import { issueInvoice, ok, payment, seed, serve, type Served } from "./plugins-http.test-support.ts"

/** Invalid payment input answers 400 with the shared validation envelope and writes nothing (T-1974). */
const valid = { amount: "10.00", currency: "RON", paymentDate: payment.paymentDate, method: "bank_transfer" }
type Detail = { readonly code: string; readonly field?: string; readonly params?: Record<string, number> }
const invalidPayments: ReadonlyArray<readonly [Record<string, string>, string, Detail]> = [
  [{ amount: "0.00" }, "amount must be greater than zero", { code: "amount_not_positive", field: "amount" }],
  [{ amount: "-5.00" }, "amount must be a non-negative amount with at most two decimals", { code: "amount_invalid", field: "amount" }],
  [{ amount: "abc" }, "amount must be a non-negative amount with at most two decimals", { code: "amount_invalid", field: "amount" }],
  [{ method: " " }, "method is required", { code: "required", field: "method" }],
  [{ paymentDate: "2026-13-01" }, "paymentDate must be a valid calendar date", { code: "date_invalid", field: "paymentDate" }],
  [{ currency: "ron" }, "currency must be an ISO 4217 code", { code: "currency_invalid", field: "currency" }],
]
const invalidReasons: ReadonlyArray<readonly [string, string, Detail]> = [
  ["   ", "reason must not be empty when provided", { code: "empty_when_provided", field: "reason" }],
  ["x".repeat(501), "reason must be at most 500 characters", { code: "too_long", field: "reason", params: { maximum: 500 } }],
]

const ledgerSize = async (call: Served["call"], invoiceId: string): Promise<number> =>
  ((await ok(call("GET", `/api/invoices/${invoiceId}/payments`), "payments")).payments as ReadonlyArray<unknown>).length

void test("invalid payments and reversals answer 400 ValidationFailure and write nothing", async () => {
  await withMigrated("payment_validation_http", async (fixture) => {
    const served = await serve(fixture, allPlugins)
    const { call } = served
    try {
      await seed(served)
      const invoiceId = String((await issueInvoice(call, "issue-1")).id)
      for (const [index, [change, issue, detail]] of invalidPayments.entries()) {
        const reply = await call("POST", `/api/invoices/${invoiceId}/payments`, { ...valid, ...change }, `pay-invalid-${String(index)}`)
        assert.deepEqual([reply.status, reply.body], [400, { error: "ValidationFailure", issues: [issue], details: [detail] }], JSON.stringify(change))
      }
      assert.equal(await ledgerSize(call, invoiceId), 0)

      // A rejected request leaves no idempotency record: its key still records the valid payment, exactly once.
      const rejected = await call("POST", `/api/invoices/${invoiceId}/payments`, { ...valid, amount: "0.00" }, "pay-1")
      assert.equal(rejected.status, 400)
      const recorded = await ok(call("POST", `/api/invoices/${invoiceId}/payments`, valid, "pay-1"), "payment with the rejected key")
      assert.equal(await ledgerSize(call, invoiceId), 1)
      const paymentId = (recorded.payment as { id: string }).id
      for (const [index, [reason, issue, detail]] of invalidReasons.entries()) {
        const reply = await call("POST", `/api/invoices/${invoiceId}/payments/${paymentId}/reversal`, { reason }, `rev-invalid-${String(index)}`)
        assert.deepEqual([reply.status, reply.body], [400, { error: "ValidationFailure", issues: [issue], details: [detail] }], `reason ${String(reason.length)}`)
      }
      assert.equal(await ledgerSize(call, invoiceId), 1)
    } finally {
      await served.close()
    }
  })
})
