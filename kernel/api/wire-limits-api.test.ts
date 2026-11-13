import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { createRequestAuthenticator } from "../auth/auth.ts"
import { anafRegistry } from "../company-lookup/vat-registry.test-support.ts"
import { allPlugins } from "../plugins.ts"
import { migratedFixture } from "../storage/postgres-rig.test-support.ts"
import { handleApiRequest } from "./api.test-support.ts"

// T-2672: the wire ceilings sit on input only and well above the domain limits, so every text the
// domain accepts goes in and every stored value reads back; only an oversized request is refused.
const address = { countryCode: "RO", city: "Iași", street: "Strada Mică 2", county: "RO-IS" }
const customerNamed = (name: string) => ({ partyType: "company", name, fiscalIdentifier: "87654329", vatRegistered: true, address })
const line = { description: "Servicii", quantity: "1", unitPrice: "10", unitOfMeasure: { code: "C62", name: "unitate" }, vatRateCode: "RO_STANDARD" }
// 190 astral codepoints and 9 double spaces: 199 characters for CIUS-RO, 398 UTF-16 units, 778 UTF-8 bytes.
const spacedName = Array.from({ length: 10 }, () => "𝔸".repeat(19)).join("  ")
const sourceId = "s".repeat(255)

const fixture = async (label: string) => {
  const rig = await migratedFixture(`wire_${label}`)
  const token = "w".repeat(64)
  const tokenFile = join(rig.dataDirectory, "api-token")
  writeFileSync(tokenFile, token, { mode: 0o600 })
  const runtime = {
    authenticate: createRequestAuthenticator(rig.config({ authTokenFile: tokenFile })), pool: rig.pool,
    dataDirectory: rig.dataDirectory, plugins: allPlugins, transport: anafRegistry(), now: () => new Date("2026-09-05T10:00:00.000Z"),
  }
  const call = (method: string, url: string, body?: unknown, idempotencyKey?: string) =>
    handleApiRequest({ method, url, authorization: `Bearer ${token}`, body, ...(idempotencyKey === undefined ? {} : { idempotencyKey }) }, runtime)
  assert.equal((await call("PUT", "/api/issuer", {
    name: "Exemplu SRL", fiscalIdentifier: "12345674", address: { ...address, city: "Botoșani", county: "RO-BT" },
    legalForm: "srl", tradeRegistryNumber: "J22/123/2020", iban: "RO49AAAA1B31007593840000", bankName: "Banca Română",
    socialCapital: "1000.00", defaultCurrency: "RON", defaultPaymentTermDays: 15,
    vatChange: { registered: true, effectiveFrom: "2025-08-01" }, branding: null,
  })).status, 200)
  assert.equal((await call("POST", "/api/document-series", { documentType: "invoice", series: "QWBE" })).status, 200)
  return { call, close: () => rig.close() }
}

void test("texts at the domain limit go in and read back, and the name cursor pages past them", async () => {
  const value = await fixture("domain")
  try {
    const name = `${spacedName}A`
    const names = [name, `${spacedName}B`]
    for (const name of names) assert.equal((await value.call("POST", "/api/customers", customerNamed(name))).status, 200, name)
    const first = await value.call("GET", "/api/customers?limit=1")
    const cursor = (first.body as { nextCursor: string }).nextCursor
    assert.ok(cursor.length > 1000, String(cursor.length))
    const second = await value.call("GET", `/api/customers?limit=1&cursor=${cursor}`)
    assert.equal(second.status, 200)
    const read = [first, second].map((page) => (page.body as { items: ReadonlyArray<{ name: string }> }).items[0]?.name)
    assert.deepEqual(read.toSorted(), names)

    const source = { app: "crm", kind: "contract", id: sourceId }
    const draft = await value.call("POST", "/api/drafts", { customer: customerNamed(name), source, series: "QWBE", issueDate: "2026-09-05" }, "source-255")
    assert.equal(draft.status, 200)
    const found = await value.call("GET", `/api/drafts?sourceApp=crm&sourceKind=contract&sourceId=${sourceId}`)
    assert.deepEqual((found.body as { items: ReadonlyArray<{ source: unknown }> }).items.map((item) => item.source), [source])
  } finally { await value.close() }
})

void test("a draft grown past 500 lines one at a time still reads back, as does the invoice issued from it", async () => {
  const value = await fixture("lines")
  try {
    const created = await value.call("POST", "/api/drafts", {
      customer: customerNamed("Client SRL"), series: "QWBE", issueDate: "2026-09-05", dueDate: "2026-09-20", lines: Array.from({ length: 500 }, () => line),
    }, "five-hundred")
    assert.equal(created.status, 200)
    const id = (created.body as { id: string }).id
    assert.equal((await value.call("POST", `/api/drafts/${id}/lines`, line)).status, 200)
    const draft = await value.call("GET", `/api/drafts/${id}`)
    assert.equal(draft.status, 200)
    assert.equal((draft.body as { lines: ReadonlyArray<unknown> }).lines.length, 501)
    const issued = await value.call("POST", `/api/drafts/${id}/issue`, {}, "issue-501")
    assert.equal(issued.status, 200)
    const invoice = await value.call("GET", `/api/invoices/${(issued.body as { id: string }).id}`)
    assert.equal((invoice.body as { lines: ReadonlyArray<unknown> }).lines.length, 501)
  } finally { await value.close() }
})

void test("a request past a wire ceiling is a 400 that never quotes the refused value", async () => {
  const value = await fixture("refused")
  try {
    const draft = { customer: customerNamed("Client SRL"), series: "QWBE", issueDate: "2026-09-05" }
    const refusals = [
      [{ ...draft, customer: customerNamed("Ion Popescu ".repeat(84)) }, "must be at most 1000 characters"],
      [{ ...draft, lines: Array.from({ length: 501 }, () => line) }, "must have at most 500 lines"],
    ] as const
    for (const [body, message] of refusals) {
      const refused = await value.call("POST", "/api/drafts", body, "too-big")
      assert.equal(refused.status, 400)
      const answer = JSON.stringify(refused.body)
      assert.match(answer, /"error":"ValidationFailure"/u)
      assert.ok(answer.includes(message), answer.slice(0, 300))
      assert.ok(!answer.includes("Popescu"))
    }
  } finally { await value.close() }
})
