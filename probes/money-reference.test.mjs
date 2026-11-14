import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import { Effect } from "effect"

import { calculateLine, calculateTotals } from "../cubes/invoicing/domain/calculation.ts"
import { negateDecimal } from "../cubes/invoicing/corrections/index.ts"
import { renderEFacturaXml } from "../cubes/invoicing/efactura/index.ts"
import { syntheticFixtures } from "../cubes/invoicing/efactura/fixtures.test-support.ts"
import { mapCorrection, mapIssuedInvoice } from "../kernel/efactura/efactura-mapper.ts"
import { createPdfRenderer } from "../kernel/documents/pdf-renderer.ts"

// T-1905: the money arithmetic moved into one module. These digests were taken
// from the code *before* that refactor, so the shared module has to reproduce
// every amount, XML byte and PDF byte exactly. Change an expectation here only
// together with a deliberate, reviewed change of output. The one so far: T-1908
// prints amounts as `6,600.00` (invoice-v10, storno-v2), so the four PDF digests
// changed and nothing else; the PDF text differs only in its separators. T-1985
// prints a county only when the city does not name it (invoice-v11, storno-v3):
// the issuer's `Botoșani, Botoșani` reads `Botoșani`, so the PDF digests changed.
// T-2074 prints a line's article code and EAN under its name (invoice-v12,
// storno-v4). These lines have neither, so their pages are drawn as before: the
// PDF digests changed only through the version in the producer string, checked by
// rendering them once more under invoice-v11/storno-v3 against the old digests.

const sha256 = (value) => createHash("sha256").update(value).digest("hex")
const article310 = "Regim special de scutire conform art. 310 din Codul fiscal"
const vat = (code, rate) => ({ code, rate, vatCategoryCode: "S", vatExemptionReason: null, effectiveFrom: "2025-08-01" })
const nonVat = { code: "RO_NON_VAT", rate: "0.00", vatCategoryCode: "O", vatExemptionReason: article310, effectiveFrom: "2025-01-01" }
const unit = { code: "H87", name: "bucată" }
const line = (id, quantity, unitPrice, vatConfiguration) =>
  calculateLine({ id, description: `Linia ${id}`, quantity, unitPrice, unitOfMeasure: unit, vat: vatConfiguration })

// Half-up on either side of the half cent, VAT on a group's base rather than the
// sum of its lines' VAT, untrimmed and unpadded input, and amounts past 2^53.
const taxedLines = [
  line("1", "3.3333", "0.15", vat("RO_STANDARD", "21.00")),
  line("2", "1", "0.07", vat("RO_STANDARD", "21")),
  line("3", "1.0000", "0.07", vat("RO_STANDARD", "21.00")),
  line("4", "001", "0.07", vat("RO_STANDARD", "21.0")),
  line("5", " 2.5 ", "19.99", vat("RO_REDUCED", "11.00")),
  line("6", "0.5", "0.01", vat("RO_REDUCED", "11")),
  line("7", "0.4999", "0.01", vat("RO_REDUCED", "11.00")),
  line("8", "12.3456", "7.89", vat("RO_REDUCED", "11.00")),
]
const exemptLines = [line("1", "2", "0.05", nonVat), line("2", "1.2345", "1000.01", nonVat)]
const largeLines = [
  line("1", "123456789.1234", "98765432.10", vat("RO_STANDARD", "21.00")),
  line("2", "9007199254740993", "1.01", vat("RO_REDUCED", "11.00")),
]

const party = { name: "Client Exemplu SRL", fiscalIdentifier: "87654329",
  address: { countryCode: "RO", city: "Iași", street: "Strada Exemplului 2", county: "RO-IS" } }
const issuer = (vatRegistered) => ({
  branding: null, vatRegistered, legalForm: "srl", tradeRegistryNumber: "J22/123/2020",
  iban: "RO49AAAA1B31007593840000", bankName: "Banca Exemplu", socialCapital: "200.00",
  name: "Exemplu Software SRL", fiscalIdentifier: "12345674",
  address: { countryCode: "RO", city: "Botoșani", street: "Strada Exemplului 1", county: "RO-BT" },
})
const invoiceOf = (lines, vatRegistered) => ({
  id: "invoice-1", organizationId: "org-1", draftId: null, sourceProformaId: null, eFacturaStatus: "not_sent",
  series: "RFI", number: 7, issueDate: "2026-09-01", dueDate: "2026-09-16", issuedAt: "2026-09-01T10:00:00.000Z",
  actorId: "user-1", currency: "RON", notes: null, issuer: issuer(vatRegistered),
  customer: { partyType: "company", vatRegistered: true, ...party }, lines, ...calculateTotals(lines),
})
const correctionOf = (invoice) => ({
  id: "correction-1", organizationId: "org-1", originalInvoiceId: invoice.id, fiscalYear: 2026, series: "RFI",
  number: 8, issueDate: "2026-09-20", dueDate: null, notes: null, issuedAt: "2026-09-20T10:00:00.000Z",
  reason: "Stornare integrală", actorId: "user-1", currency: "RON", issuer: invoice.issuer, customer: invoice.customer,
  original: { series: invoice.series, number: invoice.number, issueDate: invoice.issueDate },
  lines: invoice.lines.map((item) => ({ ...item, quantity: negateDecimal(item.quantity),
    totalExcludingVat: negateDecimal(item.totalExcludingVat), vatAmount: negateDecimal(item.vatAmount),
    totalIncludingVat: negateDecimal(item.totalIncludingVat) })),
  vatBreakdown: invoice.vatBreakdown.map((group) => ({ ...group, vatBaseAmount: negateDecimal(group.vatBaseAmount),
    vatAmount: negateDecimal(group.vatAmount) })),
  totalExcludingVat: negateDecimal(invoice.totalExcludingVat), vatTotal: negateDecimal(invoice.vatTotal),
  totalIncludingVat: negateDecimal(invoice.totalIncludingVat),
})

const documentDigests = async (name, invoice) => {
  const correction = correctionOf(invoice)
  const renderer = createPdfRenderer()
  const pdf = async (rendering) => sha256((await Effect.runPromise(rendering)).bytes)
  return {
    [`${name}.snapshot`]: sha256(JSON.stringify([invoice.lines, invoice.vatBreakdown, invoice.totalExcludingVat,
      invoice.vatTotal, invoice.totalIncludingVat, correction.lines, correction.vatBreakdown,
      correction.totalExcludingVat, correction.vatTotal, correction.totalIncludingVat])),
    [`${name}.invoice.xml`]: sha256(renderEFacturaXml(mapIssuedInvoice(invoice))),
    [`${name}.credit-note.xml`]: sha256(renderEFacturaXml(mapCorrection(correction, invoice))),
    [`${name}.invoice.pdf`]: await pdf(renderer.render(invoice)),
    [`${name}.storno.pdf`]: await pdf(renderer.renderCorrection(correction)),
  }
}

void test("the synthetic e-Factura fixtures render to the bytes they had before T-1905", () => {
  const digests = Object.fromEntries(syntheticFixtures.map(({ name, document }) => [name, sha256(renderEFacturaXml(document))]))
  assert.deepEqual(digests, {
    "01-standard-b2b": "0677ef81955b18ce6ef14ab8faa079f35f5708795ef33b421abec8a3ddfef19c", // T-2711: seria -> RFI
    "02-consumer-placeholder-id": "e82235ecb68a59e1f12ed8db81e07f0f605ae57d086c23b6993873bfb9cf95fe", // T-2711: seria -> RFI
    "03-bucharest-buyer": "5b52a4b963d7cf9bd6856bab43c7976d33545430c84523b77b0d50fedf9043d4", // T-2711: seria -> RFI
    "04-article310-exempt-E": "08e7bdfc6da868050f2a79afd642f3243f27f78ab96d7d10cb52b26304ff84f2", // T-2711: seria -> RFI
    "05-article310-not-subject-O": "cd8db3bd7180ca300dbc7c0eb9e05b336d6d8269bfc27631c4353d06b920fa85", // T-2711: seria -> RFI
    "06-credit-note": "3375c80b4239135d5b15996ba354fb781bac5dff81152cf73d3fc3b842dd7879", // T-2711: seria -> RFI
    "07-consumer-cnp": "06b48c75daab4b744ac584abb7abce45bb97ff8d2b6818d23ea575582080fe60", // T-2711: seria -> RFI
    "08-buyer-without-vat-registration": "3dc2a224ef9cc11b0596f5e61b91e16b7ff24a3bc606e997d45ea36a7dc6ab05", // T-2711: seria -> RFI
    "09-article310-credit-note": "b99f4a58b663fe33f0bee2696200421973a7e377b425e0cdf9074b98686b19cd", // T-2711: seria -> RFI
    "10-article310-with-remarks": "2309b3a6310b4e6b566f77c4b91294aa1369fb64c755afa1bbe3bbddee8015b7", // T-2711: seria -> RFI
  })
})

void test("calculated snapshots, their XML and their PDFs are the ones from before T-1905", async () => {
  const digests = {
    ...await documentDigests("taxed", invoiceOf(taxedLines, true)),
    ...await documentDigests("article310", invoiceOf(exemptLines, false)),
  }
  assert.deepEqual(digests, {
    "taxed.snapshot": "9854fd4902bbaaf5c3068ac8d76ec75040a7c59af528bace2794d923dba50c4a",
    "taxed.invoice.xml": "1ab246e82868d6e6cb776bfc961dc0308b300619dbb039a3443ac0c16601a571", // T-2711: seria -> RFI
    "taxed.credit-note.xml": "6920b403ad03666ce0435073739017cb67d9c330f2537ed3bff6b10e4b5a1d4a", // T-2711: seria -> RFI
    "taxed.invoice.pdf": "df42eed7c48072669a9034b236aec40d8dcd7e0849c0d60bba1a8ec792ea0f55", // T-2711: seria -> RFI
    "taxed.storno.pdf": "30ea00fa9eacdc37071ffbe2e09c2df4aca62894638c3a6ce635c7362b0f2d36", // T-2711: seria -> RFI
    "article310.snapshot": "3a0af2fe5dd56bbe49cf15ca0e758de63b81e0ed997fb1e7c69283ae3105b3c2",
    "article310.invoice.xml": "17a0db649383ea4d12e24054178ecb1357a9e6610a7ae315c2d05285e654b228", // T-2711: seria -> RFI
    "article310.credit-note.xml": "85af27a747a1981df3611ea9f923213179710384a0ae7239d94a15cdaa26d770", // T-2711: seria -> RFI
    "article310.invoice.pdf": "bd2b71cc1b321bc0fd713fa58c8243098655392385444e58537a28398532a7fd", // T-2711: seria -> RFI
    "article310.storno.pdf": "d14ad8a91417346751566b07eca0ad990facf5bb655f520eaadc941c8f0bbb8c", // T-2711: seria -> RFI
  })
})

void test("amounts past 2^53 calculate to the values they had before T-1905", () => {
  const invoice = invoiceOf(largeLines, true)
  assert.deepEqual(invoice.lines.map((item) => [item.quantity, item.totalExcludingVat, item.vatAmount, item.totalIncludingVat]), [
    ["123456789.1234", "12193263123451181.22", "2560585255924748.06", "14753848379375929.28"],
    ["9007199254740993.0000", "9097271247288402.93", "1000699837201724.32", "10097971084490127.25"],
  ])
  assert.deepEqual([invoice.totalExcludingVat, invoice.vatTotal, invoice.totalIncludingVat, correctionOf(invoice).totalIncludingVat],
    ["21290534370739584.15", "3561285093126472.38", "24851819463866056.53", "-24851819463866056.53"])
})
