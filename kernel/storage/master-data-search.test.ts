import assert from "node:assert/strict"
import test from "node:test"

import { Effect } from "effect"

import { createInvoicingService, invoicingPermissions, type InvoicingService, type Page } from "../../cubes/invoicing/index.ts"
import { withMigrated } from "./postgres-rig.test-support.ts"
import { createPostgresStore } from "./postgres-store.ts"

const each = { code: "C62", name: "unitate" } as const
const address = { countryCode: "RO", city: "Iași", street: "Strada 2", county: "RO-IS" }

const serviceOn = (pool: Parameters<typeof createPostgresStore>[0], organization: string): InvoicingService => {
  const permissions = invoicingPermissions("invoicing")
  let id = 0
  return createInvoicingService({
    context: { current: Effect.succeed({ identity: { id: "u", username: "u", roles: ["admin"], permissions: Object.values(permissions) }, organization: { id: organization } }) },
    clock: { now: Effect.succeed(new Date("2026-10-05T10:00:00.000Z")) }, ids: { next: Effect.sync(() => `${organization}-${String(++id).padStart(3, "0")}`) },
    store: createPostgresStore(pool), branding: { normalize: () => Effect.die("not expected") }, cubeIdentity: "invoicing",
  })
}

/** Every page of the search, following the cursor, as the names the pages hold. */
const walk = async <Item>(list: (cursor: string | undefined) => Effect.Effect<Page<Item>, unknown>, name: (item: Item) => string) => {
  const seen: Array<string> = []
  let cursor: string | undefined
  do {
    const page = await Effect.runPromise(list(cursor))
    seen.push(...page.items.map(name))
    cursor = page.nextCursor ?? undefined
  } while (cursor !== undefined)
  return seen
}

const refusedIssues = async (effect: Effect.Effect<unknown, unknown>): Promise<ReadonlyArray<string>> => {
  const failure = await Effect.runPromise(Effect.flip(effect)) as { readonly _tag: string; readonly issues?: ReadonlyArray<string> }
  assert.equal(failure._tag, "ValidationFailure")
  return failure.issues ?? []
}

void test("customers search on PostgreSQL: name and fiscal identifier, ICU case, literal wildcards, cursor inside the filter", async () => {
  await withMigrated("customer_search", async ({ pool }) => {
    const service = serviceOn(pool, "org-1")
    const customer = (name: string, fiscalIdentifier = "87654329") =>
      Effect.runPromise(service.createCustomer({ partyType: "company", name, fiscalIdentifier, vatRegistered: true, address }))
    await customer("Ștefan SRL", "12345674")
    await customer("100% Bio SRL")
    await customer("A_B SRL")
    await customer("A\\B SRL")
    await customer("Delta")
    const archived = await customer("Arhivat SRL")
    await Effect.runPromise(service.deleteCustomer(archived.id))
    await Effect.runPromise(serviceOn(pool, "org-2").createCustomer({
      partyType: "company", name: "Ștefan Străin SRL", fiscalIdentifier: "12345674", vatRegistered: true, address }))

    const search = (q?: string, limit = 100) =>
      walk((cursor) => service.listCustomers({ limit, ...(cursor === undefined ? {} : { cursor }) }, q), (item) => item.name)
    const everything = ["100% Bio SRL", "A\\B SRL", "A_B SRL", "Delta", "Ștefan SRL"]
    assert.deepEqual(await search(), everything)
    assert.deepEqual(await search("   "), everything)
    assert.deepEqual(await search(""), everything)
    for (const q of ["ștefan", "ȘTEFAN", " Ștefan "]) assert.deepEqual(await search(q), ["Ștefan SRL"], q)
    assert.deepEqual(await search("12345674"), ["Ștefan SRL"])
    assert.deepEqual(await search("%"), ["100% Bio SRL"])
    assert.deepEqual(await search("_"), ["A_B SRL"])
    assert.deepEqual(await search("a_b"), ["A_B SRL"])
    assert.deepEqual(await search("\\"), ["A\\B SRL"])
    assert.deepEqual(await search("arhivat"), [])
    assert.deepEqual(await search("nimeni"), [])
    for (const limit of [1, 2]) assert.deepEqual(await search("srl", limit), ["100% Bio SRL", "A\\B SRL", "A_B SRL", "Ștefan SRL"], String(limit))

    assert.deepEqual(await refusedIssues(service.listCustomers(undefined, "x".repeat(101))), ["q must be at most 100 characters"])
    assert.deepEqual(await refusedIssues(service.listCustomers(undefined, "a\u0000b")), ["q must not contain control characters"])
    assert.deepEqual((await Effect.runPromise(service.listCustomers(undefined, "x".repeat(100)))).items, [])
  })
})

void test("product presets search on PostgreSQL: code, description and barcode, ICU case, literal wildcards, cursor inside the filter", async () => {
  await withMigrated("preset_search", async ({ pool }) => {
    const service = serviceOn(pool, "org-1")
    const preset = (code: string, description: string, barcode?: string) => Effect.runPromise(service.createProductPreset({
      code, kind: "goods", description, unitPrice: "10", unitOfMeasure: each, ...(barcode === undefined ? {} : { barcode }) }))
    await preset("ART-1", "Șurub", "5941234567899")
    await preset("ART-2", "100% Bio")
    await preset("ART-3", "Piuliță_M8")
    await preset("ZZZ-9", "Fără cod de bare")
    await preset("ART-4", "A\\B")
    await Effect.runPromise(serviceOn(pool, "org-2").createProductPreset({
      code: "ART-1", kind: "goods", description: "Șurub străin", unitPrice: "10", unitOfMeasure: each }))

    const search = (q?: string, limit = 100) =>
      walk((cursor) => service.listProductPresets({ limit, ...(cursor === undefined ? {} : { cursor }) }, q), (item) => item.description)
    const everything = ["100% Bio", "A\\B", "Fără cod de bare", "Piuliță_M8", "Șurub"]
    assert.deepEqual(await search(), everything)
    assert.deepEqual(await search("  "), everything)
    assert.deepEqual(await search("art-3"), ["Piuliță_M8"])
    for (const q of ["șurub", "ȘURUB"]) assert.deepEqual(await search(q), ["Șurub"], q)
    assert.deepEqual(await search("PIULIȚĂ_m8"), ["Piuliță_M8"])
    assert.deepEqual(await search("594123"), ["Șurub"])
    assert.deepEqual(await search("%"), ["100% Bio"])
    assert.deepEqual(await search("_"), ["Piuliță_M8"])
    assert.deepEqual(await search("\\"), ["A\\B"])
    assert.deepEqual(await search("nimeni"), [])
    for (const limit of [1, 2]) assert.deepEqual(await search("art-", limit), ["100% Bio", "A\\B", "Piuliță_M8", "Șurub"], String(limit))

    assert.deepEqual(await refusedIssues(service.listProductPresets(undefined, "x".repeat(101))), ["q must be at most 100 characters"])
    assert.deepEqual(await refusedIssues(service.listProductPresets(undefined, "a\nb")), ["q must not contain control characters"])
  })
})
