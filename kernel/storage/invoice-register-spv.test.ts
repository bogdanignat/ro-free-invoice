import assert from "node:assert/strict"
import test from "node:test"

import { Effect } from "effect"

import { createInvoicingService, invoicingPermissions } from "../../cubes/invoicing/index.ts"
import { withMigrated } from "./postgres-rig.test-support.ts"
import { createPostgresStore } from "./postgres-store.ts"

const each = { code: "C62", name: "unitate" } as const
const statuses = ["not_sent", "queued", "processing", "accepted", "rejected", "refused", "unknown"] as const

void test("the register filter `spv: unresolved` keeps only not_sent, rejected, refused and unknown invoices and corrections", async () => {
  await withMigrated("register_spv", async ({ pool }) => {
    const permissions = invoicingPermissions("invoicing")
    let id = 0
    const service = createInvoicingService({
      context: { current: Effect.succeed({ identity: { id: "u", username: "u", roles: ["admin"], permissions: Object.values(permissions) }, organization: { id: "org-1" } }) },
      clock: { now: Effect.succeed(new Date("2026-10-05T10:00:00.000Z")) }, ids: { next: Effect.sync(() => `id-${String(++id).padStart(3, "0")}`) },
      store: createPostgresStore(pool), branding: { normalize: () => Effect.die("not expected") }, cubeIdentity: "invoicing",
    })
    await Effect.runPromise(service.configureIssuer({ name: "Exemplu SRL", fiscalIdentifier: "12345674",
      address: { countryCode: "RO", city: "Botoșani", street: "Strada 1", county: "RO-BT" }, legalForm: "srl",
      tradeRegistryNumber: "J22/123/2020", iban: "RO49AAAA1B31007593840000", bankName: "Banca", socialCapital: "1000.00",
      defaultCurrency: "RON", defaultPaymentTermDays: 15, vatChange: { registered: true, effectiveFrom: "2025-08-01" }, branding: null }))
    await Effect.runPromise(service.addDocumentSeries({ documentType: "invoice", series: "FCT" }))
    const labels = new Map<string, string>()
    const issued: Array<string> = []
    for (const [index, status] of statuses.entries()) {
      const invoice = await Effect.runPromise(service.issueInvoice({ request: {
        customer: { partyType: "company" as const, name: "Client SRL", fiscalIdentifier: "87654329", vatRegistered: true,
          address: { countryCode: "RO", city: "Iași", street: "Strada 2", county: "RO-IS" } },
        series: "FCT", issueDate: `2026-09-0${String(index + 1)}`, dueDate: "2026-10-31", currency: "RON" as const,
        lines: [{ description: "Servicii", quantity: "1", unitPrice: "10", unitOfMeasure: each, vatRateCode: "RO_STANDARD" }] },
      idempotency: { key: `spv-${status}`, fingerprint: `sha256:${"0".repeat(64)}` } }))
      issued.push(invoice.id)
      // The column is what the submission transaction projects; set it as that transaction would.
      await pool.query("UPDATE issued_invoices SET e_factura_status=$1 WHERE id=$2", [status, invoice.id])
      labels.set(invoice.id, `invoice:${status}`)
    }
    // One storno per half of the UNION: a resolved one (accepted) and an unresolved one (unknown).
    for (const [index, status] of (["accepted", "unknown"] as const).entries()) {
      const correction = await Effect.runPromise(service.createCorrection({
        request: { originalInvoiceId: issued[index] ?? "", reason: "Storno", issueDate: `2026-09-1${String(index)}` },
        idempotency: { key: `spv-storno-${status}`, fingerprint: `sha256:${"0".repeat(64)}` } }))
      await pool.query("UPDATE correction_documents SET e_factura_status=$1 WHERE id=$2", [status, correction.id])
      labels.set(correction.id, `correction:${status}`)
    }
    const page = (filter: { readonly spv?: "unresolved" }, limit: number, cursor?: string) =>
      Effect.runPromise(service.listInvoiceRegister(undefined, { limit, ...(cursor === undefined ? {} : { cursor }) }, filter))
    const listed = async (filter: { readonly spv?: "unresolved" }) => (await page(filter, 100)).items.map((row) => labels.get(row.id))
    assert.equal((await listed({})).length, statuses.length + 2)
    const unresolved = await listed({ spv: "unresolved" })
    assert.deepEqual(unresolved, ["correction:unknown", "invoice:unknown", "invoice:refused", "invoice:rejected", "invoice:not_sent"])
    // Small pages under the filter: the cursor walks on to the next page, nothing lost and nothing twice.
    const walked: Array<string | undefined> = []
    let cursor: string | undefined
    do {
      const next = await page({ spv: "unresolved" }, 2, cursor)
      walked.push(...next.items.map((row) => labels.get(row.id)))
      cursor = next.nextCursor ?? undefined
    } while (cursor !== undefined)
    assert.deepEqual(walked, unresolved)
  })
})
