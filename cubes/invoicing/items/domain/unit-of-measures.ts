import { validationFailure } from "../../contracts/failures.ts"
import * as issue from "../../issues/index.ts"

export interface UnitOfMeasure {
  readonly code: string
  readonly name: string
}

// Only the everyday units for goods, services and subscriptions, grouped so
// the dropdown reads naturally: piece, unit, set and lump sum first; then time
// (shortest first), mass, volume, length and area, and energy; no packaging
// options. Codes are UN/ECE Recommendation 20 rev. 3 / 21 rev. 3, as RO
// e-Factura (EN 16931 BT-130) requires; names are the Romanian labels shown in
// the UI and frozen into the document snapshot. Extend deliberately, never by
// importing the full 2,000-entry catalogue.
const curated: ReadonlyArray<UnitOfMeasure> = [
  { code: "H87", name: "bucată" },
  { code: "C62", name: "unitate" },
  { code: "SET", name: "set" },
  { code: "LS", name: "forfetar" },
  { code: "MIN", name: "minut" },
  { code: "HUR", name: "oră" },
  { code: "DAY", name: "zi" },
  { code: "WEE", name: "săptămână" },
  { code: "MON", name: "lună" },
  { code: "ANN", name: "an" },
  { code: "KGM", name: "kilogram" },
  { code: "TNE", name: "tonă" },
  { code: "LTR", name: "litru" },
  { code: "MTQ", name: "metru cub" },
  { code: "MTR", name: "metru" },
  { code: "KMT", name: "kilometru" },
  { code: "MTK", name: "metru pătrat" },
  { code: "KWH", name: "kilowatt-oră" },
]

const byCode = new Map(curated.map((unit) => [unit.code, Object.freeze({ ...unit })]))

export const unitOfMeasures: ReadonlyArray<UnitOfMeasure> = Object.freeze([...byCode.values()])

export const normalizeUnitOfMeasure = (input: UnitOfMeasure): UnitOfMeasure => {
  const issues: Array<issue.IssueDetail> = []
  if (!byCode.has(input.code)) issues.push(issue.unitInvalid())
  if (input.name.trim().length === 0) issues.push(issue.required("unitOfMeasure.name"))
  if (input.name !== input.name.trim()) issues.push(issue.surroundingWhitespace("unitOfMeasure.name"))
  if (input.name.length > 100) issues.push(issue.tooLong("unitOfMeasure.name", 100))
  if (/\p{Cc}/u.test(input.name)) issues.push(issue.containsControlCharacters("unitOfMeasure.name"))
  if (issues.length > 0) throw validationFailure(issues)
  return { code: input.code, name: input.name }
}
