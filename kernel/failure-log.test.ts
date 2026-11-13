import assert from "node:assert/strict"
import test from "node:test"

import { Cause, Effect } from "effect"

import { failureReason, internalFailureLine } from "./failure-log.ts"

const cnp = "1800101221144"
const token = "3f9a1c5e7b2d4a6c8e0f1a2b3c4d5e6f7a8b9c0d"
const leaks = [cnp, token, "hunter2"]

void test("a defect line keeps the error name and stack frames, never the input it quoted", () => {
  const error = new TypeError(`bad CNP ${cnp} for token ${token} password=hunter2 postgres://u:hunter2@db/x`)
  const line = internalFailureLine({ kind: "defect", reason: failureReason(Cause.squash(Cause.die(error))) })
  for (const secret of leaks) assert.ok(!line.includes(secret), secret)
  assert.match(line, /TypeError/u)
  assert.match(line, /failure-log\.test\.ts/u)
})

void test("free text is masked before it is cut, so a secret on the limit cannot survive half-cut", () => {
  const line = internalFailureLine({ kind: "server_failure", reason: `${"x".repeat(3990)} ${cnp} ${token} password=hunter2` })
  for (const secret of leaks) assert.ok(!line.includes(secret), secret)
  const masked = internalFailureLine({ kind: "unmapped_failure", reason: `DomainConflict ${cnp} ${token} password=hunter2` })
  assert.ok(masked.includes("DomainConflict"))
  for (const secret of leaks) assert.ok(!masked.includes(secret), secret)
})

void test("base64 with a slash and a JWT are masked; a UUID and a source path stay", () => {
  const base64 = "q83vEjRWeJA/Ab2kc+9z1Xyz0123456789abcdefGH=="
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxODAwMTAxMjIxMTQ0In0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk"
  const id = "123e4567-e89b-12d3-a456-426614174000"
  const path = "file:///app/node_modules/.pnpm/effect@3.17.0/node_modules/effect/dist/esm/internal/fiberRuntime.js:1:2"
  const line = internalFailureLine({ kind: "server_failure", reason: `token ${base64} bearer ${jwt} invoice ${id}\n    at run (${path})` })
  for (const secret of [base64, jwt, "eyJzdWIiOiIxODAwMTAxMjIxMTQ0In0"]) assert.ok(!line.includes(secret), secret)
  assert.ok(line.includes(id))
  assert.ok(line.includes(path))
})

void test("a hex token with 13 digits in a row is masked whole, not cut into short fragments", () => {
  const hex = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6" + "1234567890123" + "abcdefabcdefabcdefa"
  const line = internalFailureLine({ kind: "server_failure", reason: `token ${hex} end` })
  for (const part of [hex, "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6", "abcdefabcdefabcdefa"]) assert.ok(!line.includes(part), part)
  assert.ok(line.includes("token [redacted] end"))
})

void test("a UUID inside a path or a file name stays", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000"
  for (const run of [`/api/invoices/${id}`, `drafts/${id}/issue`, `${id}.pdf`]) {
    assert.ok(internalFailureLine({ kind: "request", reason: `GET ${run} failed` }).includes(run), run)
  }
})

void test("the tag of a tagged failure is kept and its message is not", async () => {
  const failure = Object.assign(new Error(`name Ion Popescu ${cnp}`), { _tag: "PersistenceFailure", code: "23505" })
  const cause = await Effect.runPromise(Effect.fail(failure).pipe(Effect.sandbox, Effect.flip))
  const reason = failureReason(Cause.squash(cause))
  assert.match(reason, /_tag=PersistenceFailure code=23505/u)
  assert.ok(!reason.includes("Popescu"))
  assert.equal(failureReason("raw " + cnp), "non-error thrown: string")
})
