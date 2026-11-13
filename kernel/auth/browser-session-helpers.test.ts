import assert from "node:assert/strict"
import test from "node:test"

import { cookieValue, sessionCookieValues } from "./browser-session-helpers.ts"

const id = "a".repeat(43)

void test("a session id is read only from exactly one non-empty rfi_session cookie", () => {
  assert.equal(cookieValue(`rfi_session=${id}`), id)
  assert.equal(cookieValue(`other=1; rfi_session=${id}; theme=dark`), id)
  // An empty cookie before a valid one used to be skipped, so the second won.
  for (const header of [undefined, "", "rfi_session=", "rfi_session", `rfi_session=; rfi_session=${id}`,
    `rfi_session=${id}; rfi_session=${id}`, `rfi_session=${id}, rfi_session=${"b".repeat(43)}`]) {
    assert.equal(cookieValue(header), undefined, String(header))
  }
})

void test("every rfi_session value is listed, empty ones included, and foreign names are ignored", () => {
  assert.deepEqual(sessionCookieValues(`rfi_session=; x=1, rfi_session = ${id}; RFI_SESSION=y`), ["", id])
  assert.deepEqual(sessionCookieValues("rfi_sessionx=1; xrfi_session=2"), [])
})
