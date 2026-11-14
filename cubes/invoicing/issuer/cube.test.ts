import assert from "node:assert/strict"
import test from "node:test"

import { cube, issuerMigrations } from "./index.ts"

void test("declares issuer as a required child of invoicing that owns its tables", () => {
  assert.deepEqual(cube.manifest, {
    name: "issuer", parent: "invoicing", summary: "Issuer profile, branding, VAT registration and legal VAT catalogue",
    required: true, tables: ["issuers", "issuer_tax_configurations"],
  })
  assert.deepEqual(issuerMigrations.map(({ name }) => name), ["issuer-001-baseline"])
})
