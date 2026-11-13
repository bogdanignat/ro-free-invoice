import assert from "node:assert/strict"
import test from "node:test"

import { Effect } from "effect"

import { createInvoicingService } from "../../application/invoicing.ts"
import { brandingNormalizer, contextProvider, emptyState, fixedClock, identity, memoryStore, sequentialIds } from "../../application/memory-store.test-support.ts"
import { ValidationFailure } from "../../contracts/index.ts"

const address = { countryCode: "RO", city: "Iași", street: "Strada 1", county: "RO-IS" }

void test("pages customers by name with an opaque cursor and validates the page request", async () => {
  const service = createInvoicingService({
    context: contextProvider({ identity, organization: { id: "org-1" } }),
    clock: fixedClock, ids: sequentialIds(), store: memoryStore(emptyState()), branding: brandingNormalizer, cubeIdentity: "invoicing",
  })
  for (const name of ["Delta", "alfa", "Charlie", "Bravo", "Echo"]) {
    await Effect.runPromise(service.createCustomer({ partyType: "individual", name, fiscalIdentifier: "", vatRegistered: false, address }))
  }
  const first = await Effect.runPromise(service.listCustomers({ limit: 2 }))
  assert.deepEqual(first.items.map((customer) => customer.name), ["alfa", "Bravo"])
  assert.notEqual(first.nextCursor, null)
  const second = await Effect.runPromise(service.listCustomers({ limit: 2, cursor: first.nextCursor ?? "" }))
  assert.deepEqual(second.items.map((customer) => customer.name), ["Charlie", "Delta"])
  const third = await Effect.runPromise(service.listCustomers({ limit: 2, cursor: second.nextCursor ?? "" }))
  assert.deepEqual(third.items.map((customer) => customer.name), ["Echo"])
  assert.equal(third.nextCursor, null)
  assert.equal((await Effect.runPromise(service.listCustomers())).items.length, 5)

  for (const request of [{ limit: 0 }, { limit: 201 }, { limit: 1.5 }, { cursor: "nu-e-base64-json" }, { cursor: Buffer.from("[1]").toString("base64url") }]) {
    const failure = await Effect.runPromise(Effect.flip(service.listCustomers(request)))
    assert.equal(failure instanceof ValidationFailure, true, JSON.stringify(request))
  }
})

void test("searches customers by name or fiscal identifier, case-insensitively, inside the cursor and the organization", async () => {
  const state = emptyState()
  const ids = sequentialIds()
  const on = (organization: string) => createInvoicingService({
    context: contextProvider({ identity, organization: { id: organization } }),
    clock: fixedClock, ids, store: memoryStore(state), branding: brandingNormalizer, cubeIdentity: "invoicing",
  })
  const service = on("org-1")
  const company = (name: string, fiscalIdentifier: string) =>
    Effect.runPromise(service.createCustomer({ partyType: "company", name, fiscalIdentifier, vatRegistered: true, address }))
  await company("Ștefan SRL", "12345674")
  await company("100% Bio SRL", "87654329")
  await company("A_B SRL", "87654329")
  const archived = await company("Arhivat SRL", "87654329")
  await Effect.runPromise(service.deleteCustomer(archived.id))
  await Effect.runPromise(on("org-2").createCustomer({ partyType: "individual", name: "Ștefan Străin", fiscalIdentifier: "", vatRegistered: false, address }))

  const names = async (search?: string, request: { limit?: number; cursor?: string } = {}) =>
    (await Effect.runPromise(service.listCustomers(request, search))).items.map((customer) => customer.name)
  assert.deepEqual(await names(), ["100% Bio SRL", "A_B SRL", "Ștefan SRL"])
  assert.deepEqual(await names("  "), ["100% Bio SRL", "A_B SRL", "Ștefan SRL"])
  assert.deepEqual(await names(" ȘTEFAN "), ["Ștefan SRL"])
  assert.deepEqual(await names("12345674"), ["Ștefan SRL"])
  assert.deepEqual(await names("87654329"), ["100% Bio SRL", "A_B SRL"])
  assert.deepEqual(await names("arhivat"), [])
  const first = await Effect.runPromise(service.listCustomers({ limit: 1 }, "87654329"))
  assert.deepEqual(first.items.map((customer) => customer.name), ["100% Bio SRL"])
  assert.deepEqual(await names("87654329", { limit: 1, cursor: first.nextCursor ?? "" }), ["A_B SRL"])

  for (const [search, issue] of [["x".repeat(101), "q must be at most 100 characters"], ["a\nb", "q must not contain control characters"]] as const) {
    const failure = await Effect.runPromise(Effect.flip(service.listCustomers(undefined, search)))
    assert.deepEqual(failure instanceof ValidationFailure && failure.issues, [issue])
  }
})
