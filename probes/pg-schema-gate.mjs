/**
 * Gate G1 and the PostgreSQL schema behaviour matrix.
 *
 * Runs only against a throwaway PostgreSQL 16 cluster (compose.pg-schema-gate.yaml);
 * it is not part of `pnpm verify`, so it is run by hand after a schema change. Every database
 * it uses it creates itself, from `template0` with the C collation, and drops in a
 * `finally`. No existing database, volume or port is touched.
 */
import assert from "node:assert/strict"
import { clearTimeout, setTimeout } from "node:timers"

import pg from "pg"


import { migrationScopes } from "../kernel/storage/postgres-migration-plans.ts"
import {
  applyMigrations, applyMigrationsOnClient, assertCollationC, databaseReady, planMigrations,
} from "../kernel/storage/postgres-migrations.ts"
import {
  acquireSharedMaintenanceLock, releaseSharedMaintenanceLock,
} from "../kernel/storage/postgres-maintenance-lock.ts"

const { Client, Pool } = pg

const connection = {
  host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER, database: process.env.PGDATABASE,
  connectionTimeoutMillis: 5000, statement_timeout: 30000,
}

const started = Date.now()
const results = []
const check = (name, body) => {
  try {
    body()
    results.push({ name, ok: true })
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) })
  }
}

const bounded = async (label, millis, work) => {
  let timer
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: exceeded ${millis}ms bound`)), millis)
  })
  try { return await Promise.race([work, guard]) } finally { clearTimeout(timer) }
}

const databases = []
const createDatabase = async (admin, name, locale = { collate: "C", ctype: "C" }) => {
  assert.match(name, /^gate_[a-z0-9_]+$/u, "database name")
  assert.match(`${locale.collate}${locale.ctype}`, /^[A-Za-z0-9._-]+$/u, "locale")
  await admin.query(`CREATE DATABASE ${name} TEMPLATE template0 `
    + `LC_COLLATE '${locale.collate}' LC_CTYPE '${locale.ctype}' ENCODING 'UTF8'`)
  databases.push(name)
  return new Pool({ ...connection, database: name, max: 2 })
}

const INVENTORY = `
  SELECT 'table' AS kind, c.relname AS name, '' AS definition
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'schema_migrations'
  UNION ALL
  SELECT 'index', c.relname, pg_get_indexdef(c.oid)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_index i ON i.indexrelid = c.oid
    -- Only indexes that BACK a constraint are implicit. A foreign key's
    -- conindid points at the parent's unique index, which stays explicit.
    LEFT JOIN pg_constraint k ON k.conindid = c.oid AND k.contype IN ('p', 'u', 'x')
    WHERE n.nspname = 'public' AND c.relkind = 'i' AND k.oid IS NULL
      AND c.relname NOT LIKE 'schema_migrations%'
  UNION ALL
  SELECT 'check', co.conname, pg_get_constraintdef(co.oid)
    FROM pg_constraint co JOIN pg_namespace n ON n.oid = co.connamespace
    WHERE n.nspname = 'public' AND co.contype = 'c'
  UNION ALL
  SELECT 'foreign-key', co.conname, pg_get_constraintdef(co.oid)
    FROM pg_constraint co JOIN pg_namespace n ON n.oid = co.connamespace
    WHERE n.nspname = 'public' AND co.contype = 'f'
  UNION ALL
  SELECT 'trigger', t.tgname, pg_get_triggerdef(t.oid)
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
  UNION ALL
  SELECT 'function', p.proname, pg_get_functiondef(p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
  ORDER BY 1, 2, 3`

const UPDATE_OF_ROWS = `
  SELECT t.tgname AS name, c.relname AS table,
         COALESCE((SELECT array_agg(a.attname) FROM unnest(t.tgattr) AS k(num)
                     JOIN pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = k.num)::text[],
                  ARRAY[]::text[]) AS columns
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT t.tgisinternal`

const TABLE_COLUMNS = `
  SELECT table_name AS table, column_name AS column
    FROM information_schema.columns WHERE table_schema = 'public'`

const inventory = async (pool) => {
  const { rows } = await pool.query(INVENTORY)
  return rows.map(({ kind, name, definition }) => `${kind} ${name} ${definition}`)
}

const countOf = (objects, kind) => objects.filter((entry) => entry.startsWith(`${kind} `)).length

const failed = (error) => ({ code: error?.code, message: error?.message ?? String(error) })

/** Runs one statement in its own savepoint and reports how it ended. */
const attempt = async (client, sql, values = []) => {
  await client.query("SAVEPOINT probe")
  try {
    await client.query(sql, values)
    await client.query("ROLLBACK TO SAVEPOINT probe")
    return { ok: true }
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT probe")
    return { ok: false, ...failed(error) }
  }
}

const main = async () => {
  const admin = new Client(connection)
  await bounded("admin connect", 10000, admin.connect())
  const pools = []
  try {
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

    // ---------------------------------------------------------- behaviour
    const { seedStatements } = await import("./pg-schema-seed-lib.mjs")
    const { acceptedWrites, constraintCases, triggerRejections, updateOfDifferences } =
      await import("./pg-schema-behaviour-lib.mjs")
    const behaviour = await createDatabase(admin, "gate_behaviour")
    pools.push(behaviour)
    const behaviourClient = await behaviour.connect()
    try {
      await applyMigrationsOnClient(behaviourClient)
      await behaviourClient.query("BEGIN")
      // The deferrable cycle: the invoice and its conversion row land together.
      await behaviourClient.query("SET CONSTRAINTS ALL DEFERRED")
      for (const statement of seedStatements) {
        try {
          await behaviourClient.query(statement)
        } catch (error) {
          throw new Error(`seed failed on ${statement.slice(0, 70)}…: ${error.message}`, { cause: error })
        }
      }
      await behaviourClient.query("COMMIT")
      results.push({ name: "the seed is accepted in full (accept half of the matrix)", ok: true })

      await behaviourClient.query("BEGIN")
      const triggerNames = new Set((await behaviourClient.query(
        "SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal",
      )).rows.map(({ tgname }) => tgname))
      check("every trigger in the database has a rejection case", () => {
        const covered = new Set(triggerRejections.map(([name]) => name))
        assert.deepEqual([...triggerNames].filter((name) => !covered.has(name)), [], "uncovered triggers")
        assert.deepEqual([...covered].filter((name) => !triggerNames.has(name)), [], "cases without a trigger")
        assert.equal(covered.size, 76)
      })

      const updateOfRows = (await behaviourClient.query(UPDATE_OF_ROWS)).rows
      const columnsOf = {}
      for (const { table, column } of (await behaviourClient.query(TABLE_COLUMNS)).rows) {
        columnsOf[table] = [...(columnsOf[table] ?? []), column]
      }
      check("every UPDATE OF column list is the declared one", () => {
        assert.deepEqual(updateOfDifferences(updateOfRows, columnsOf), [])
      })
      check("the UPDATE OF comparison reports a dropped column and a new unguarded one", () => {
        const dropped = updateOfRows.map((row) => row.name === "issued_invoices_no_update"
          ? { ...row, columns: row.columns.filter((column) => column !== "total_including_tax") } : row)
        assert.notDeepEqual(updateOfDifferences(dropped, columnsOf), [], "dropped column")
        const widened = { ...columnsOf, correction_documents: [...columnsOf.correction_documents, "new_column"] }
        assert.notDeepEqual(updateOfDifferences(updateOfRows, widened), [], "new column")
        const missing = updateOfRows.filter(({ name }) => name !== "proformas_seal_only")
        assert.notDeepEqual(updateOfDifferences(missing, columnsOf), [], "missing trigger")
      })

      for (const [trigger, sql, message] of triggerRejections) {
        const outcome = await attempt(behaviourClient, sql)
        check(`trigger ${trigger} refuses the write`, () => {
          assert.equal(outcome.ok, false, "statement was accepted")
          assert.equal(outcome.code, "23514", outcome.message)
          assert.ok(outcome.message.includes(message), `message was ${JSON.stringify(outcome.message)}`)
        })
      }
      for (const [label, sql, values] of acceptedWrites) {
        const outcome = await attempt(behaviourClient, sql, values)
        check(`accepted: ${label}`, () => { assert.equal(outcome.ok, true, outcome.message) })
      }
      for (const [label, codes, sql, values] of constraintCases) {
        const outcome = await attempt(behaviourClient, sql, values)
        check(`constraint: ${label}`, () => {
          assert.equal(outcome.ok, false, "statement was accepted")
          assert.ok(codes.split("|").includes(outcome.code), `${outcome.code} ${outcome.message}`)
        })
      }

      // STRICT is gone, and the delta is recorded rather than patched over.
      // A raw SQL numeric literal is assignment-cast into an integer column and
      // rounds; a BOUND parameter is sent as text and is rejected. Every adapter
      // is parameterized, so the rounding path is not reachable from the API.
      const rawLiteral = await attempt(behaviourClient,
        "INSERT INTO invoice_sequences VALUES('org-1','invoice','R2030',7.5)")
      await behaviourClient.query("SAVEPOINT num")
      await behaviourClient.query("INSERT INTO invoice_sequences VALUES('org-1','invoice','R2030',7.5)")
      const rounded = await behaviourClient.query(
        "SELECT last_number FROM invoice_sequences WHERE series='R2030'")
      await behaviourClient.query("ROLLBACK TO SAVEPOINT num")
      check("a raw numeric literal is assignment-cast and rounds (SQLite STRICT refused it)", () => {
        assert.equal(rawLiteral.ok, true, rawLiteral.message)
        assert.equal(rounded.rows[0].last_number, 8)
      })
      for (const [label, value] of [["a JS number", 7.5], ["a text fraction", "0.6"]]) {
        await behaviourClient.query("SAVEPOINT bind")
        let code
        try {
          await behaviourClient.query(
            "INSERT INTO invoice_sequences VALUES('org-1','invoice','R2031',$1)", [value])
        } catch (error) { code = error.code }
        await behaviourClient.query("ROLLBACK TO SAVEPOINT bind")
        check(`a bound fraction (${label}) is refused with 22P02`, () => { assert.equal(code, "22P02") })
      }
      const boolRounding = await attempt(behaviourClient,
        `INSERT INTO customers(id,organization_id,legal_name,tax_identifier,country_code,city,street,county,
         party_type,vat_registered) VALUES('c-round','org-1','X','1','RO','X','Y','RO-IS','company',0.6)`)
      check("a raw 0.6 rounds to 1 and satisfies CHECK IN(0,1) — recorded, not endorsed", () => {
        assert.equal(boolRounding.ok, true, boolRounding.message)
      })

      // The generated column, read rather than written.
      const generated = await behaviourClient.query(
        "SELECT id, direct_source_proforma_id FROM issued_invoices ORDER BY id")
      check("the generated column mirrors a proforma-sourced invoice only", () => {
        assert.deepEqual(generated.rows, [
          { id: "invoice-1", direct_source_proforma_id: null },
          { id: "invoice-3", direct_source_proforma_id: "pf-3" },
        ])
      })

      // NULL branding stays allowed, the IS NULL arm of the CHECK.
      const nullBranding = await attempt(behaviourClient, `INSERT INTO issuers(organization_id,legal_name,
        tax_identifier,country_code,city,street,county,default_currency,default_payment_term_days,branding,
        legal_form,trade_registry_number,iban,bank_name,social_capital)
        VALUES('org-null','X','1','RO','X','Y','RO-IS','RON',15,NULL,'srl','J','I','B',100)`)
      check("NULL JSON column stays accepted", () => { assert.equal(nullBranding.ok, true, nullBranding.message) })

      // IS DISTINCT FROM, the NULL <-> value pair the SQLite `IS NOT` carried.
      const distinct = await behaviourClient.query(
        "SELECT (NULL::text IS DISTINCT FROM 'INV') AS a, ('INV' IS DISTINCT FROM 'INV') AS b")
      check("IS DISTINCT FROM keeps the NULL semantics of SQLite IS NOT", () => {
        assert.deepEqual(distinct.rows[0], { a: true, b: false })
      })

      // The ASCII fold the NOCASE index was replaced with.
      const fold = await behaviourClient.query(
        "SELECT translate($1,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') AS folded", ["ĂLPHA"])
      check("the fold is ASCII-only, like NOCASE", () => {
        assert.equal(fold.rows[0].folded, "Ălpha")
      })

      await behaviourClient.query("ROLLBACK")

      // The deferred lineage key still fires, at COMMIT and NOT at INSERT.
      // The two statements are asserted separately on the same client and the
      // same transaction: a NOT DEFERRABLE key would fail at the INSERT.
      await behaviourClient.query("BEGIN")
      let insertFailure
      let deferredCode
      try {
        await behaviourClient.query(`INSERT INTO issued_invoices(id,draft_id,organization_id,fiscal_year,
          document_type,series,number,issue_date,supply_date,issued_at,currency,issuer_legal_name,issuer_tax_identifier,
          issuer_country_code,issuer_city,issuer_street,issuer_county,customer_legal_name,
          customer_tax_identifier,customer_country_code,customer_city,customer_street,customer_county,
          total_excluding_tax,tax_total,total_including_tax,customer_party_type,customer_vat_registered,
          source_proforma_id,issuer_legal_form,issuer_trade_registry_number,issuer_iban,issuer_bank_name,
          issuer_social_capital,actor_id,issuer_vat_registered)
          VALUES('inv-deferred',NULL,'org-1',2026,'invoice','INV',7,'2026-09-01','2026-09-01','t','RON','F','1','RO','X',
          'Y','RO-IS','C','2','RO','X','Y','RO-IS',100,0,100,'company',1,'pf-1','srl','J','I','B',
          100,'operator',1)`)
      } catch (error) {
        insertFailure = error.code ?? error.message
      }
      if (insertFailure === undefined) {
        try { await behaviourClient.query("COMMIT") } catch (error) { deferredCode = error.code }
      }
      try { await behaviourClient.query("ROLLBACK") } catch { /* already ended */ }
      check("the deferred lineage key does not fire at INSERT", () => {
        assert.equal(insertFailure, undefined, "the INSERT was refused, so the key is not deferred")
      })
      check("the deferred lineage key fires at COMMIT with 23503", () => {
        assert.equal(deferredCode, "23503")
      })
    } finally {
      behaviourClient.release()
    }
  } finally {
    for (const pool of pools) {
      try { await bounded("pool end", 10000, pool.end()) } catch (error) { console.error("·", error.message) }
    }
    for (const name of databases) {
      try { await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`) } catch (error) {
        console.error("· drop", name, error.message)
      }
    }
    await admin.end()
  }
}

await bounded("gate", 600000, main()).catch((error) => {
  results.push({ name: "gate", ok: false, detail: error instanceof Error ? error.stack : String(error) })
})

const passed = results.filter(({ ok }) => ok).length
for (const { name, ok, detail } of results) if (!ok) console.error(`FAIL ${name}\n     ${detail}`)
console.log(`${passed}/${results.length} checks passed in ${Date.now() - started}ms`)
process.exit(passed === results.length ? 0 : 1)
