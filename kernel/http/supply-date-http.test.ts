import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { Schema } from "effect"

import { handleApiRequest } from "../api/api.test-support.ts"
import { createRequestAuthenticator } from "../auth/auth.ts"
import { migratedFixture } from "../storage/postgres-rig.test-support.ts"
import * as S from "../api/http-schemas.ts"
import { allPlugins } from "../plugins.ts"
import { anafRegistry, registeredIssuer } from "../company-lookup/vat-registry.test-support.ts"

const address = { countryCode: "RO", city: "Iași", street: "Strada Test 1", county: "RO-IS" }
const issuer = {
  name: "Firma Test SRL", fiscalIdentifier: "12345674", legalForm: "srl", address,
  tradeRegistryNumber: "J22/123/2020", iban: "RO49AAAA1B31007593840000", bankName: "Banca Test",
  socialCapital: "1000", defaultCurrency: "RON", defaultPaymentTermDays: 15, branding: null,
  vatChange: { registered: true, effectiveFrom: "2025-01-01" },
}
const input = {
  customer: { name: "Client Test", partyType: "individual", fiscalIdentifier: "", vatRegistered: false, address },
  series: "INV", issueDate: "2025-08-05", dueDate: "2025-08-20", currency: "RON",
  lines: [{ description: "Serviciu test", quantity: "1", unitPrice: "100", unitOfMeasure: { code: "HUR", name: "oră" }, vatRateCode: "RO_STANDARD" }],
}

const fixture = async (label: string) => {
  const rig = await migratedFixture(`sdh_${label}`)
  const token = "s".repeat(64)
  const tokenFile = join(rig.dataDirectory, "api-token")
  writeFileSync(tokenFile, token, { mode: 0o600 })
  const runtime = {
    pool: rig.pool, dataDirectory: rig.dataDirectory, now: () => new Date("2025-08-10T10:00:00.000Z"),
    plugins: allPlugins, transport: anafRegistry(registeredIssuer),
    authenticate: createRequestAuthenticator(rig.config({ authTokenFile: tokenFile })),
  }
  const call = (method: string, url: string, body?: unknown, idempotencyKey?: string) => handleApiRequest({
    method, url, authorization: `Bearer ${token}`, body, ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  }, runtime)
  assert.equal((await call("PUT", "/api/issuer", issuer)).status, 200)
  assert.equal((await call("POST", "/api/document-series", { documentType: "invoice", series: "INV" })).status, 200)
  return { call, issued: () => rig.sql.query("SELECT id FROM issued_invoices"), close: () => rig.close() }
}

void test("direct issuance takes the VAT on an earlier supply date and keeps that date", async () => {
  const value = await fixture("earlier")
  try {
    const reply = await value.call("POST", "/api/invoices", { ...input, supplyDate: "2025-07-20" }, "supply-earlier")
    assert.equal(reply.status, 200, JSON.stringify(reply.body))
    const invoice = Schema.decodeUnknownSync(S.IssuedInvoice)(reply.body)
    assert.equal(invoice.issueDate, "2025-08-05")
    assert.equal(invoice.supplyDate, "2025-07-20")
    assert.equal(invoice.lines[0]?.vatRate, "19.00")
    const plain = await value.call("POST", "/api/invoices", { ...input, supplyDate: null }, "supply-none")
    assert.equal(plain.status, 200, JSON.stringify(plain.body))
    const second = Schema.decodeUnknownSync(S.IssuedInvoice)(plain.body)
    assert.equal(second.supplyDate, "2025-08-05")
    assert.equal(second.lines[0]?.vatRate, "21.00")
  } finally { await value.close() }
})

void test("direct issuance refuses a supply after the issue date without issuing", async () => {
  const value = await fixture("late")
  try {
    const reply = await value.call("POST", "/api/invoices", { ...input, supplyDate: "2025-08-06" }, "supply-late")
    assert.deepEqual([reply.status, reply.body], [400, { error: "ValidationFailure",
      issues: ["supplyDate cannot be after issueDate"], details: [{ code: "supply_date_after_issue", field: "supplyDate" }] }])
    assert.deepEqual(await value.issued(), [])
  } finally { await value.close() }
})
