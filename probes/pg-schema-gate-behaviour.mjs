/** The behaviour matrix: the seed is accepted, every trigger refuses its write, constraints and recorded PostgreSQL deltas. */
import assert from "node:assert/strict"

import { applyMigrationsOnClient } from "../kernel/storage/postgres-migrations.ts"

import { attempt, check, createDatabase, results, TABLE_COLUMNS, UPDATE_OF_ROWS } from "./pg-schema-gate-support.mjs"

export const checkBehaviour = async (admin, pools) => {
  // ---------------------------------------------------------- behaviour
  const { seedStatements } = await import("./pg-schema-seed-lib.mjs")
  const { acceptedWrites, constraintCases, updateOfDifferences } = await import("./pg-schema-behaviour-lib.mjs")
  const { triggerRejections } = await import("./pg-schema-trigger-cases.mjs")
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
}
