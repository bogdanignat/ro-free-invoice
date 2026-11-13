import assert from "node:assert/strict"
import test from "node:test"

import { ValidationFailure } from "../../contracts/failures.ts"
import { normalizeUnitOfMeasure, unitOfMeasures } from "./unit-of-measures.ts"

void test("publishes only the curated Romanian invoicing units, piece first, with UN/ECE codes", () => {
  assert.equal(new Set(unitOfMeasures.map(({ code }) => code)).size, unitOfMeasures.length)
  assert.deepEqual(unitOfMeasures, [
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
  ], "keep the catalogue limited to practical units, not every available UN/ECE code")
  assert.ok(unitOfMeasures.every(({ code }) => /^[A-Z0-9]{2,3}$/.test(code)))
  for (const unit of unitOfMeasures) assert.deepEqual(normalizeUnitOfMeasure(unit), unit)
})

void test("rejects packaging and redundant units for new input", () => {
  for (const code of ["GRM", "MLT", "CMT", "MMT", "PR", "E48", "XPK", "XBX"]) {
    assert.throws(() => normalizeUnitOfMeasure({ code, name: "unitate eliminată" }), ValidationFailure, code)
  }
})

void test("validates the curated code while preserving the caller-facing snapshot name", () => {
  assert.deepEqual(normalizeUnitOfMeasure({ code: "HUR", name: "ore" }), { code: "HUR", name: "ore" })
  assert.throws(() => normalizeUnitOfMeasure({ code: "X1A", name: "butoi" }), ValidationFailure)
  assert.throws(() => normalizeUnitOfMeasure({ code: "NOPE", name: "inventată" }), ValidationFailure)
  assert.throws(() => normalizeUnitOfMeasure({ code: "HUR", name: " oră " }), ValidationFailure)
})
