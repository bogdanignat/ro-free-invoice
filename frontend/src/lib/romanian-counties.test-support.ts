import type { RomanianCounty } from "./romanian-counties.ts"

/** A few of the server's counties (`GET /api/reference-data`), enough for the tests that name or check one. */
export const COUNTIES: ReadonlyArray<RomanianCounty> = [
  { code: "RO-B", name: "București" }, { code: "RO-CJ", name: "Cluj" }, { code: "RO-IS", name: "Iași" },
]
