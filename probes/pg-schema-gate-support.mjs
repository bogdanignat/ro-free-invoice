/** What every part of the schema gate shares: the connection, the result list, the throwaway databases and the probes. */
import assert from "node:assert/strict"
import { clearTimeout, setTimeout } from "node:timers"

import pg from "pg"

const { Pool } = pg

export const connection = {
  host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER, database: process.env.PGDATABASE,
  connectionTimeoutMillis: 5000, statement_timeout: 30000,
}

export const results = []
export const check = (name, body) => {
  try {
    body()
    results.push({ name, ok: true })
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) })
  }
}

export const bounded = async (label, millis, work) => {
  let timer
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: exceeded ${millis}ms bound`)), millis)
  })
  try { return await Promise.race([work, guard]) } finally { clearTimeout(timer) }
}

export const databases = []
export const createDatabase = async (admin, name, locale = { collate: "C", ctype: "C" }) => {
  assert.match(name, /^gate_[a-z0-9_]+$/u, "database name")
  assert.match(`${locale.collate}${locale.ctype}`, /^[A-Za-z0-9._-]+$/u, "locale")
  await admin.query(`CREATE DATABASE ${name} TEMPLATE template0 `
    + `LC_COLLATE '${locale.collate}' LC_CTYPE '${locale.ctype}' ENCODING 'UTF8'`)
  databases.push(name)
  return new Pool({ ...connection, database: name, max: 2 })
}

export const INVENTORY = `
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

export const UPDATE_OF_ROWS = `
  SELECT t.tgname AS name, c.relname AS table,
         COALESCE((SELECT array_agg(a.attname) FROM unnest(t.tgattr) AS k(num)
                     JOIN pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = k.num)::text[],
                  ARRAY[]::text[]) AS columns
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT t.tgisinternal`

export const TABLE_COLUMNS = `
  SELECT table_name AS table, column_name AS column
    FROM information_schema.columns WHERE table_schema = 'public'`

export const inventory = async (pool) => {
  const { rows } = await pool.query(INVENTORY)
  return rows.map(({ kind, name, definition }) => `${kind} ${name} ${definition}`)
}

export const countOf = (objects, kind) => objects.filter((entry) => entry.startsWith(`${kind} `)).length

export const failed = (error) => ({ code: error?.code, message: error?.message ?? String(error) })

/** Runs one statement in its own savepoint and reports how it ended. */
export const attempt = async (client, sql, values = []) => {
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
