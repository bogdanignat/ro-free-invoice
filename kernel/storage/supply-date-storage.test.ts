import assert from "node:assert/strict"
import test from "node:test"

import { Effect } from "effect"

import { customer, dueDate, issueDate, lines, ok, seed, serve, type Served } from "../http/plugins-http.test-support.ts"
import { allPlugins } from "../plugins.ts"
import { withMigrated, type TestFixture } from "./postgres-rig.test-support.ts"
import { createPostgresStore, type ApplicationTransaction } from "./postgres-store.ts"

/**
 * The supply date (data livrarii) of an invoice: a draft keeps it or leaves it
 * NULL, meaning the issue date, and issuance writes it on the invoice for good.
 */
const dayBefore = (date: string): string => new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)

const createDraft = async ({ call }: Served, key: string): Promise<string> =>
  String((await ok(call("POST", "/api/drafts", { customer, series: "QWBE", issueDate, dueDate, lines }, key), "draft")).id)

const issueDraft = async ({ call }: Served, draftId: string): Promise<string> =>
  String((await ok(call("POST", `/api/drafts/${draftId}/issue`, {}, `issue-${draftId}`), "issue")).id)

const run = <Value, Failure>(fixture: TestFixture, body: (transaction: ApplicationTransaction) => Effect.Effect<Value, Failure>) =>
  Effect.runPromise(createPostgresStore(fixture.pool).transaction(body))

void test("a draft keeps an earlier supply date or none, and issuance writes it on the invoice", () =>
  withMigrated("supply_date_storage", async (fixture) => {
    const served = await serve(fixture, allPlugins)
    try {
      await seed(served)
      const plain = await createDraft(served, "draft-plain")
      assert.equal(await fixture.sql.scalar("SELECT supply_date FROM invoice_drafts WHERE id=$1", [plain]), null)
      const stored = await run(fixture, (transaction) => transaction.findDraft("org-1", plain))
      assert.ok(stored !== undefined)
      assert.equal("supplyDate" in stored, false, "NULL reads back as an absent supply date")

      const earlier = dayBefore(issueDate)
      const supplied = await createDraft(served, "draft-supplied")
      await run(fixture, (transaction) => Effect.gen(function*() {
        const draft = yield* transaction.findDraft("org-1", supplied)
        assert.ok(draft !== undefined)
        yield* transaction.saveDraft({ ...draft, supplyDate: earlier })
      }))
      const reread = await run(fixture, (transaction) => transaction.findDraft("org-1", supplied))
      assert.equal(reread?.supplyDate, earlier)

      for (const [draftId, expected] of [[plain, issueDate], [supplied, earlier]] as const) {
        const invoiceId = await issueDraft(served, draftId)
        assert.equal(await fixture.sql.scalar("SELECT supply_date FROM issued_invoices WHERE id=$1", [invoiceId]), expected)
        const invoice = await run(fixture, (transaction) => transaction.findIssuedInvoice("org-1", invoiceId))
        assert.equal(invoice?.supplyDate, expected)
      }
    } finally {
      await served.close()
    }
  }))

void test("the supply date is never after the issue date and never changes once issued", () =>
  withMigrated("supply_date_checks", async (fixture) => {
    const served = await serve(fixture, allPlugins)
    try {
      await seed(served)
      const draftId = await createDraft(served, "draft-late")
      const late = await fixture.sql.rejects("UPDATE invoice_drafts SET supply_date=(issue_date::date+1)::text WHERE id=$1", [draftId])
      assert.deepEqual([late.code, late.constraint], ["23514", "invoice_drafts_supply_date_not_after_issue"])

      const invoiceId = await issueDraft(served, draftId)
      const changed = await fixture.sql.rejects("UPDATE issued_invoices SET supply_date=(issue_date::date-1)::text WHERE id=$1", [invoiceId])
      assert.equal(changed.code, "23514")
      assert.match(changed.message, /issued invoices are immutable except e_factura_status/u)
      // The CHECK holds where the trigger does not: a copy of the invoice, supplied after its issue date.
      const columns = String(await fixture.sql.scalar(`SELECT string_agg(column_name,',' ORDER BY ordinal_position)
        FROM information_schema.columns WHERE table_schema='public' AND table_name='issued_invoices' AND is_generated='NEVER'`))
      const copied = await fixture.sql.rejects(`INSERT INTO issued_invoices(${columns}) SELECT ${columns} FROM jsonb_populate_record(
        NULL::issued_invoices, (SELECT to_jsonb(t) || jsonb_build_object('id','copy','number',t.number+1000,'draft_id',NULL::text,
          'sealed',0,'supply_date',(t.issue_date::date+1)::text) FROM issued_invoices t WHERE id=$1))`, [invoiceId])
      assert.deepEqual([copied.code, copied.constraint], ["23514", "issued_invoices_supply_date_not_after_issue"])
    } finally {
      await served.close()
    }
  }))
