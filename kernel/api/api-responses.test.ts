import assert from "node:assert/strict"
import test from "node:test"

import { Effect, Either } from "effect"

import { EFacturaContractViolation } from "../../cubes/invoicing/efactura/index.ts"
import { renderEFactura } from "./api-responses.ts"

void test("an e-Factura refusal reaches the API coded by its BR rule, the validator's text kept in issues", () => {
  const issues = ["buyer.registrationName exceeds 200 characters after normalize-space (BR-RO-L200)", "UBL root is missing",
    "a document that is not subject to VAT cannot also carry taxed or exempt lines (BR-O-11..14)"]
  const result = Effect.runSync(Effect.either(renderEFactura(() => { throw new EFacturaContractViolation({ issues }) })))
  assert.ok(Either.isLeft(result))
  assert.deepEqual(result.left.issues, issues)
  assert.deepEqual(result.left.details, [
    { code: "efactura_rule", params: { rule: "BR-RO-L200", text: "buyer.registrationName exceeds 200 characters after normalize-space" } },
    { code: "efactura_contract", params: { text: "UBL root is missing" } },
    { code: "efactura_rule", params: { rule: "BR-O-11..14", text: "a document that is not subject to VAT cannot also carry taxed or exempt lines" } },
  ])
})
