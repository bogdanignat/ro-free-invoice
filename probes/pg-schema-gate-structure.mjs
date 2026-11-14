/** G1 (migrations apply identically), the object inventory, scope ownership and dependencies, and the fault cases. */
import assert from "node:assert/strict"

import { migrationScopes } from "../kernel/storage/postgres-migration-plans.ts"
import {
  applyMigrations, assertCollationC, databaseReady, planMigrations,
} from "../kernel/storage/postgres-migrations.ts"
import {
  acquireSharedMaintenanceLock, releaseSharedMaintenanceLock,
} from "../kernel/storage/postgres-maintenance-lock.ts"

import { bounded, check, countOf, createDatabase, failed, inventory } from "./pg-schema-gate-support.mjs"

export const checkStructure = async (admin, pools) => {
  // ---------------------------------------------------------------- G1
  const first = await createDatabase(admin, "gate_g1_a")
  pools.push(first)
  const scanned = migrationScopes.reduce((total, scope) => total + scope.migrations.length, 0)

  const firstRun = await bounded("G1 apply #1", 120000, applyMigrations(first))
  check("G1 first apply changes every migration", () => {
    assert.deepEqual({ ...firstRun, pending: [...firstRun.pending] },
      { scanned, changed: scanned, skipped: 0, failed: 0, pending: [] })
  })

  // Captured BEFORE the reapply: comparing two post-reapply captures would
  // only prove that `inventory()` is deterministic.
  const inventoryAfterFirstApply = await inventory(first)

  const reapply = await bounded("G1 reapply", 60000, applyMigrations(first))
  const afterPlan = await planMigrations(first)
  check("G1 reapply on the same database changes nothing", () => {
    assert.equal(reapply.changed, 0)
    assert.deepEqual([...afterPlan.pending], [])
    assert.equal(afterPlan.skipped, scanned)
  })
  const ready = await databaseReady(first)
  check("databaseReady answers true once applied", () => { assert.equal(ready, true) })

  const inventoryA = await inventory(first)
  check("reapply leaves the schema byte-identical with the first apply", () => {
    assert.deepEqual(inventoryA, inventoryAfterFirstApply)
    assert.ok(inventoryAfterFirstApply.length > 0, "inventory is not empty")
  })

  const second = await createDatabase(admin, "gate_g1_b")
  pools.push(second)
  const secondRun = await bounded("G1 apply #2", 120000, applyMigrations(second))
  const inventoryB = await inventory(second)
  check("G1 second fresh database applies identically", () => {
    assert.equal(secondRun.changed, scanned)
    assert.deepEqual(inventoryB, inventoryA)
  })

  // ------------------------------------------------------- inventory
  // Each schema migration that adds an object bumps its count here.
  check("42 domain tables, 41 explicit indexes, 76 triggers, 225 named checks, 12 functions", () => {
    assert.equal(countOf(inventoryA, "table"), 42)
    assert.equal(countOf(inventoryA, "index"), 41)
    assert.equal(countOf(inventoryA, "trigger"), 76)
    assert.equal(countOf(inventoryA, "check"), 225)
    assert.equal(countOf(inventoryA, "function"), 12)
  })
  check("every check constraint is named and within 63 characters", () => {
    const names = inventoryA.filter((entry) => entry.startsWith("check "))
      .map((entry) => entry.split(" ")[1])
    for (const name of names) {
      assert.ok(name.length <= 63, name)
      assert.doesNotMatch(name, /_check\d*$/u, `${name} looks auto-generated`)
    }
    assert.equal(new Set(names).size, names.length, "check names are unique")
  })
  check("the deferrable lineage foreign key kept its deferrability", () => {
    const entry = inventoryA.find((row) => row.startsWith("foreign-key issued_invoices_lineage_fkey"))
    assert.ok(entry, "lineage foreign key present")
    assert.match(entry, /DEFERRABLE INITIALLY DEFERRED/u)
    assert.match(entry, /\(organization_id, direct_source_proforma_id, id\)/u)
  })
  const { rows: collation } = await first.query(
    "SELECT datcollate, datctype, pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname=current_database()")
  check("database collation is C/C/UTF8", () => {
    assert.deepEqual(collation[0], { datcollate: "C", datctype: "C", encoding: "UTF8" })
  })

  // ----------------------------------------------- ownership, per scope
  const ownership = await createDatabase(admin, "gate_ownership")
  pools.push(ownership)
  const ownershipClient = await ownership.connect()
  const observed = []
  try {
    for (const scope of migrationScopes) {
      const before = await ownershipClient.query(
        "SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'")
      for (const migration of scope.migrations) {
        for (const statement of migration.statements) await ownershipClient.query(statement)
      }
      const after = await ownershipClient.query(
        "SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'")
      const names = new Set(before.rows.map(({ relname }) => relname))
      observed.push({
        scope: scope.scope,
        created: after.rows.map(({ relname }) => relname).filter((name) => !names.has(name)).sort(),
        declared: [...scope.tables].sort(),
      })
    }
  } finally {
    ownershipClient.release()
  }
  check("each scope creates exactly the tables it declares", () => {
    for (const { scope, created, declared } of observed) assert.deepEqual(created, declared, scope)
  })
  check("the ownership comparison fails on a wrong owner", () => {
    const [a, b] = observed.filter(({ declared }) => declared.length > 0)
    assert.throws(() => assert.deepEqual(a.created, b.declared))
  })
  check("the ownership comparison fails on an extra table", () => {
    const scope = observed.find(({ created }) => created.length > 0)
    assert.throws(() => assert.deepEqual([...scope.created, "zz_extra"], scope.declared))
  })

  // ------------------------------------- bare DDL, scope dependencies
  const dependencies = []
  for (const scope of migrationScopes.filter(({ scope: name }) => name !== "foundation")) {
    const bare = await createDatabase(admin, `gate_bare_${scope.scope.replace(/[^a-z]/gu, "")}`)
    pools.push(bare)
    const client = await bare.connect()
    try {
      let outcome = { ok: true }
      for (const migration of scope.migrations) {
        for (const statement of migration.statements) {
          try { await client.query(statement) } catch (error) { outcome = { ok: false, ...failed(error) }; break }
        }
        if (!outcome.ok) break
      }
      dependencies.push({ scope: scope.scope, ...outcome })
    } finally {
      client.release()
    }
  }
  check("a scope applied without its dependencies fails loudly", () => {
    const byScope = Object.fromEntries(dependencies.map((entry) => [entry.scope, entry]))
    // Observed dependency map, asserted rather than assumed.
    assert.equal(byScope.customers.ok, true, "customers stands alone")
    assert.equal(byScope.catalog.ok, true, "catalog stands alone")
    assert.equal(byScope.issuer.ok, true, "issuer stands alone")
    assert.equal(byScope.kernel.ok, true, "kernel sessions stand alone")
    assert.equal(byScope["company-lookup"].ok, true, "company-lookup settings stand alone")
    assert.equal(byScope.invoicing.ok, false, "invoicing needs issuers, customers and the foundation")
    assert.equal(byScope.payments.ok, false, "payments needs issued_invoices and the foundation")
    assert.equal(byScope.documents.ok, false, "documents needs the foundation function")
    assert.equal(byScope.documents.code, "42883", "missing qwbe_abort")
    assert.equal(byScope.connection.ok, true, "the e-Factura connection stands alone")
    assert.equal(byScope.submissions.ok, false, "e-Factura submissions need the foundation function")
    assert.equal(byScope.submissions.code, "42883", "missing qwbe_abort")
  })

  // ------------------------------------------------------ fault cases
  // The collation precondition is asserted on the TARGET before any write.
  // musl maps LC_COLLATE 'C.UTF-8' back to 'C' but keeps LC_CTYPE, so this
  // database is genuinely not the target shape.
  const nonC = await createDatabase(admin, "gate_non_c", { collate: "C.UTF-8", ctype: "C.UTF-8" })
  pools.push(nonC)
  const { rows: nonCLocale } = await nonC.query(
    "SELECT datcollate, datctype FROM pg_database WHERE datname = current_database()")
  let collationRefusal
  try { await applyMigrations(nonC) } catch (error) { collationRefusal = error.message }
  const nonCTables = await nonC.query(
    "SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'")
  check("the target locale really differs from C", () => {
    assert.notDeepEqual(nonCLocale[0], { datcollate: "C", datctype: "C" })
  })
  check("migration refuses a non-C database before writing anything", () => {
    assert.match(String(collationRefusal), /must be LC_COLLATE 'C' LC_CTYPE 'C'/u)
    assert.deepEqual(nonCTables.rows, [], "nothing was created")
  })
  const guardOnC = await assertCollationC(first).then(() => "ok", (error) => error.message)
  check("the same guard passes on a C database", () => { assert.equal(guardOnC, "ok") })

  // A held barrier refuses within a bound instead of hanging: the shape a
  // `migrate` needs while the application holds the barrier SHARED.
  const holder = await first.connect()
  let barrierRefusal
  let barrierMillis
  try {
    await acquireSharedMaintenanceLock(holder)
    const begunAt = Date.now()
    try { await applyMigrations(first, { attempts: 3, delayMillis: 50 }) } catch (error) {
      barrierRefusal = error.message
    }
    barrierMillis = Date.now() - begunAt
  } finally {
    await releaseSharedMaintenanceLock(holder)
    holder.release()
  }
  check("a held barrier refuses the migration within its bound", () => {
    assert.match(String(barrierRefusal), /the application is running/u)
    assert.ok(barrierMillis < 5000, `took ${barrierMillis}ms`)
  })
  const afterBarrier = await bounded("post-barrier apply", 60000, applyMigrations(first))
  check("the barrier is free again once the holder releases", () => {
    assert.equal(afterBarrier.changed, 0)
  })
}
