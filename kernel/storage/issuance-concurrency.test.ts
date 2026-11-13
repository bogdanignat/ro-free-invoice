import assert from "node:assert/strict"
import test from "node:test"

import { Effect } from "effect"

import { ValidationFailure } from "../../cubes/invoicing/index.ts"
import { numberingService, once, run } from "./numbering.test-support.ts"
import { withMigrated, type RawSql } from "./postgres-rig.test-support.ts"

/**
 * Issuance under concurrency, on real PostgreSQL: every transaction takes the
 * exclusive business advisory lock, so parallel issuances (invoices and stornos,
 * which share the invoice counter) must come out as distinct, gap-free numbers.
 * The assertions are invariants, because the order in which the lock is won is
 * not deterministic.
 */

const COUNT = 20
const today = "2026-12-31"
const day = (index: number) => `2026-12-${String(index + 1).padStart(2, "0")}`

const settle = <Value, Failure>(effect: Effect.Effect<Value, Failure>) => Effect.runPromise(Effect.either(effect))

const issued = async (sql: RawSql) => (await sql.query(
  `SELECT number,issue_date FROM issued_invoices WHERE series = 'FCT'
   UNION ALL SELECT number,issue_date FROM correction_documents WHERE series = 'FCT' ORDER BY number`)).map((row) => ({ number: Number(row.number), issue_date: String(row.issue_date) }))

const assertContinuous = (rows: ReadonlyArray<{ readonly number: number }>) => {
  assert.deepEqual(rows.map(({ number }) => number), rows.map((_, index) => index + 1))
}

void test("parallel issuance from drafts numbers 1..N without gaps", async () => {
  await withMigrated("concurrency_invoices", async ({ pool, sql }) => {
    const org = await numberingService(pool)
    org.on(today)
    const drafts = []
    for (let index = 0; index < COUNT; index++) drafts.push(await run(org.service.createDraft(once(org.invoiceRequest(today)))))
    const results = await Promise.all(drafts.map(({ id }) => run(org.service.issueInvoice(once({ draftId: id })))))
    assert.deepEqual(results.map(({ number }) => number).sort((left, right) => left - right), drafts.map((_, index) => index + 1))
    const rows = await issued(sql)
    assertContinuous(rows)
    assert.equal(rows.length, COUNT)
    assert.deepEqual(await sql.query("SELECT last_number FROM invoice_sequences WHERE series = 'FCT' AND document_type = 'invoice'"), [{ last_number: COUNT }])
  })
})

void test("parallel issuance with out-of-order dates refuses with a domain error and keeps the chronology", async () => {
  await withMigrated("concurrency_chronology", async ({ pool, sql }) => {
    const org = await numberingService(pool)
    org.on(today)
    const drafts = []
    for (let index = 0; index < COUNT; index++) drafts.push(await run(org.service.createDraft(once(org.invoiceRequest(day(index))))))
    // Shuffled start order: the lock winner decides which dates are already too old.
    const shuffled = drafts.map((draft, index) => ({ draft, order: (index * 7) % COUNT })).sort((a, b) => a.order - b.order)
    const results = await Promise.all(shuffled.map(({ draft }) => settle(org.service.issueInvoice(once({ draftId: draft.id })))))
    for (const result of results) {
      if (result._tag === "Left") assert.ok(result.left instanceof ValidationFailure, String(result.left))
    }
    const rows = await issued(sql)
    const succeeded = results.filter((result) => result._tag === "Right").length
    assert.ok(succeeded >= 1)
    assert.equal(rows.length, succeeded)
    assertContinuous(rows)
    // Number order is date order: the series chronology holds.
    assert.deepEqual(rows.map(({ issue_date }) => issue_date), rows.map(({ issue_date }) => issue_date).sort())
  })
})

void test("parallel invoices and stornos share one counter without gaps", async () => {
  await withMigrated("concurrency_storno", async ({ pool, sql }) => {
    const org = await numberingService(pool)
    const originals = []
    for (let index = 0; index < COUNT / 2; index++) originals.push(await run(org.invoice(today)))
    org.on(today)
    const work = [
      ...originals.map(({ id }) => run(org.service.createCorrection(once({ originalInvoiceId: id, reason: "Storno", issueDate: today })))),
      ...originals.map(() => run(org.service.issueInvoice(once(org.invoiceRequest(today))))),
    ]
    const results = await Promise.all(work)
    const numbers = [...originals, ...results].map(({ number }) => number).sort((left, right) => left - right)
    assert.deepEqual(numbers, numbers.map((_, index) => index + 1))
    assert.equal(numbers.length, COUNT + COUNT / 2)
    const rows = await issued(sql)
    assertContinuous(rows)
    assert.equal(rows.length, COUNT + COUNT / 2)
    assert.deepEqual(await sql.query("SELECT last_number FROM invoice_sequences WHERE series = 'FCT' AND document_type = 'invoice'"), [{ last_number: COUNT + COUNT / 2 }])
  })
})
