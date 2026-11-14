import assert from "node:assert/strict"
import test from "node:test"

import { QueryClient } from "@tanstack/react-query"

import { chosenCustomerLabel } from "./use-customer-picker.ts"
import { registrySearchKey, searchHint, searchOptions, searchText } from "./use-registry-search.ts"
import { createAuthoringReferenceClient } from "../lib/authoring-reference-client.ts"
import { createBrowserTransport } from "../lib/browser-transport.ts"
import type { Customer } from "../lib/draft-models.ts"

const address = { countryCode: "RO", city: "B", street: "s", county: "RO-B", sector: 1 } as const
const customer = (id: string, name: string): Customer => ({
  id, organizationId: "org", partyType: "company", name, fiscalIdentifier: "123", vatRegistered: false, address,
})
const loaded = [customer("c1", "Alfa")]

void test("the q sent is trimmed, free of control characters and capped at the server's 100", () => {
  assert.equal(searchText(undefined), "")
  assert.equal(searchText("   "), "")
  assert.equal(searchText(" Beta\tSRL "), "Beta SRL")
  assert.equal(searchText("x".repeat(150)).length, 100)
})

void test("closed shows nothing, open untyped or blank shows the loaded pages, a text shows only what the server found", () => {
  const found = [customer("c51", "Zeta")]
  assert.deepEqual(searchOptions(false, "zet", loaded, found), [])
  assert.deepEqual(searchOptions(true, undefined, loaded, found), loaded)
  assert.deepEqual(searchOptions(true, " ", loaded, found), loaded)
  assert.deepEqual(searchOptions(true, "zet", loaded, found), found)
  assert.deepEqual(searchOptions(true, "zet", loaded, undefined), [])
})

void test("the hint speaks only for the text typed now: failed, nothing found, or a cut first page", () => {
  const answer = { failed: false, fresh: true, count: 0, more: false }
  assert.equal(searchHint("zet", "zet", answer), "noMatch")
  assert.equal(searchHint("zet", "zet", { ...answer, failed: true, fresh: false }), "failed")
  assert.equal(searchHint("zet", "zet", { ...answer, count: 3, more: true }), "more")
  assert.equal(searchHint("zet", "zet", { ...answer, count: 3 }), undefined)
  // Mid-debounce, an empty answer kept from the previous text, a blank or closed field: nothing to say yet.
  assert.equal(searchHint("zeta", "zet", answer), undefined)
  assert.equal(searchHint("zet", "zet", { ...answer, fresh: false }), undefined)
  assert.equal(searchHint(" ", "", answer), undefined)
  assert.equal(searchHint(undefined, "zet", { ...answer, failed: true }), undefined)
})

void test("search keys sit under the registry prefix its writes invalidate, apart from the infinite list", async () => {
  const client = new QueryClient()
  client.setQueryData(["customers"], { pages: [], pageParams: [] })
  client.setQueryData(registrySearchKey("customers", "zet"), { items: [], nextCursor: null })
  assert.equal(client.getQueryCache().findAll({ queryKey: ["customers"], exact: true }).length, 1)
  await client.invalidateQueries({ queryKey: ["customers"] })
  assert.equal(client.getQueryState(registrySearchKey("customers", "zet"))?.isInvalidated, true)
  assert.notDeepEqual(registrySearchKey("product-presets", "zet"), registrySearchKey("customers", "zet"))
})

void test("the search asks the server with q encoded", async () => {
  const requested: Array<string> = []
  const reference = createAuthoringReferenceClient(createBrowserTransport({
    fetch: (input) => {
      requested.push(typeof input === "string" ? input : "not-a-path")
      return Promise.resolve(Response.json({ items: [], nextCursor: null }))
    },
    onUnauthorized: () => undefined,
  }))
  await reference.searchCustomers("Ana & Co", new AbortController().signal)
  await reference.searchProductPresets("50%", new AbortController().signal)
  assert.deepEqual(requested, ["/api/customers?q=Ana+%26+Co", "/api/product-presets?q=50%25"])
})

void test("the client field shows the picked customer, else the draft's snapshot, else nothing", () => {
  const form = { buyerMode: "saved", customerId: "c51" } as const
  const snapshot = { customerId: "c51", customer: { ...customer("c51", "Zeta"), fiscalIdentifier: "" } }
  assert.equal(chosenCustomerLabel(form, [customer("c51", "Zeta"), ...loaded], snapshot), "Zeta — CUI / CIF 123")
  assert.equal(chosenCustomerLabel(form, loaded, snapshot), "Zeta (clientul din acest draft)")
  assert.equal(chosenCustomerLabel(form, loaded, undefined), "")
  assert.equal(chosenCustomerLabel({ ...form, customerId: "c1" }, loaded, snapshot), "Alfa — CUI / CIF 123")
})
