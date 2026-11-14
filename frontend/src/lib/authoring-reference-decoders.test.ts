import assert from "node:assert/strict"
import test from "node:test"

import { decodeReferenceData } from "./authoring-reference-decoders.ts"

const textLimits = { partyName: 200, street: 150, city: 50, postalCode: 20, lineDescription: 100, documentNotes: 300 }
const answer = { counties: [{ code: "RO-B", name: "București" }], textLimits }

void test("the reference data decodes as the server answers it", () => {
  assert.deepEqual(decodeReferenceData(answer), answer)
})

// A limit the decoder let through wrong would leave a field without its cap, silently.
void test("a missing, fractional or non-positive limit, or a malformed county, is refused", () => {
  for (const limit of [undefined, "200", 1.5, 0, -1]) {
    assert.throws(() => decodeReferenceData({ ...answer, textLimits: { ...textLimits, city: limit } }), /invalid city/u)
  }
  assert.throws(() => decodeReferenceData({ ...answer, textLimits: undefined }))
  assert.throws(() => decodeReferenceData({ ...answer, counties: [{ code: "RO-B" }] }), /invalid name/u)
  assert.throws(() => decodeReferenceData({ textLimits }))
})
