import type { SqlFragment } from "./postgres-sql.ts"

/**
 * "Contains, ignoring case only" as SQL, for the register, the customers and the
 * product presets. Case folds on diacritic letters too, but diacritics are not
 * ignored: "ștefan" finds "ȘTEFAN", "stefan" does not find "Ștefan".
 *
 * The fold is ICU, not the cluster's `C` ctype, which lowers ASCII only: "ștefan"
 * has to find "ȘTEFAN SRL". The needle is always a bound value, never spliced, and
 * its LIKE wildcards are escaped, so `%`, `_` and `\` search for themselves.
 */
export const lowered = (expression: string): string => `lower((${expression}) COLLATE "und-x-icu")`

export const escapeLike = (value: string): string => value.replace(/[\\%_]/gu, (character) => `\\${character}`)

export const containing = (value: string): string => `%${escapeLike(value)}%`

/**
 * ` AND (any column contains search)` with one placeholder at `startIndex`; no
 * search is no condition. A NULL column never matches (NULL LIKE is not true).
 */
export const containsAny = (columns: ReadonlyArray<string>, search: string | undefined, startIndex: number): SqlFragment => {
  if (search === undefined) return { sql: "", values: [] }
  const pattern = lowered(`$${String(startIndex)}::text`)
  return {
    sql: ` AND (${columns.map((column) => `${lowered(column)} LIKE ${pattern} ESCAPE '\\'`).join(" OR ")})`,
    values: [containing(search)],
  }
}
