import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { Effect } from "effect"

import { CIUS_TEXT_LIMITS, DOCUMENT_NOTES_MAX_LENGTH, ROMANIAN_COUNTIES } from "../../cubes/invoicing/index.ts"
import { createRequestAuthenticator } from "../auth/auth.ts"
import { allPlugins } from "../plugins.ts"
import { migratedFixture } from "../storage/postgres-rig.test-support.ts"
import { handleApiRequest } from "./api.test-support.ts"

void test("GET /api/reference-data answers the cube's counties and text limits, and only to a reader", async () => {
  const rig = await migratedFixture("reference_data")
  try {
    const token = "r".repeat(64)
    const tokenFile = join(rig.dataDirectory, "api-token")
    writeFileSync(tokenFile, token, { mode: 0o600 })
    const runtime = {
      authenticate: createRequestAuthenticator(rig.config({ authTokenFile: tokenFile })),
      pool: rig.pool, dataDirectory: rig.dataDirectory, plugins: allPlugins,
    }
    const get = (authorization: string | undefined, as = runtime) =>
      handleApiRequest({ method: "GET", url: "/api/reference-data", authorization, body: undefined }, as)

    const answer = await get(`Bearer ${token}`)
    assert.equal(answer.status, 200)
    assert.deepEqual(answer.body, {
      counties: ROMANIAN_COUNTIES,
      textLimits: { ...CIUS_TEXT_LIMITS, documentNotes: DOCUMENT_NOTES_MAX_LENGTH },
    })

    assert.equal((await get(undefined)).status, 401)
    const withPermissions = (permissions: ReadonlyArray<string>) => ({ ...runtime, authenticate: () => ({ current: Effect.succeed({
      identity: { id: "u", username: "u", roles: [], permissions }, organization: { id: "org-1" } }) }) })
    assert.equal((await get(`Bearer ${token}`, withPermissions(["invoicing:invoice.issue"]))).status, 403)
    assert.equal((await get(`Bearer ${token}`, withPermissions(["invoicing:read"]))).status, 200)
  } finally {
    await rig.close()
  }
})
