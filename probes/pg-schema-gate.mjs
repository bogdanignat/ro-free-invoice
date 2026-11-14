/**
 * Gate G1 and the PostgreSQL schema behaviour matrix.
 *
 * Runs only against a throwaway PostgreSQL 16 cluster (compose.pg-schema-gate.yaml);
 * it is not part of `pnpm verify`, so it is run by hand after a schema change. Every database
 * it uses it creates itself, from `template0` with the C collation, and drops in a
 * `finally`. No existing database, volume or port is touched.
 */
import pg from "pg"

import { checkBehaviour } from "./pg-schema-gate-behaviour.mjs"
import { checkStructure } from "./pg-schema-gate-structure.mjs"
import { bounded, connection, databases, results } from "./pg-schema-gate-support.mjs"

const { Client } = pg

const started = Date.now()

const main = async () => {
  const admin = new Client(connection)
  await bounded("admin connect", 10000, admin.connect())
  const pools = []
  try {
    await checkStructure(admin, pools)
    await checkBehaviour(admin, pools)
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
