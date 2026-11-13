import assert from "node:assert/strict"
import { test } from "node:test"

import { SPV_UNRESOLVED_STATUSES } from "../../../corrections/index.ts"
import { spvDeadline, spvNeedsAction, spvState, spvUrgency } from "./deadline.ts"
import { FISCAL_STATES } from "./states.ts"

void test("from 2026 the deadline is 5 working days after the issue day", () => {
  assert.equal(spvDeadline("2026-01-05"), "2026-01-12") // Monday
  assert.equal(spvDeadline("2026-01-08"), "2026-01-15") // Thursday
  assert.equal(spvDeadline("2026-01-09"), "2026-01-16") // Friday
  assert.equal(spvDeadline("2026-01-10"), "2026-01-16") // Saturday: the first counted day is Monday
  assert.equal(spvDeadline("2026-01-11"), "2026-01-16") // Sunday
})

void test("up to 2025-12-31 the deadline is 5 calendar days, from 2026-01-01 working days", () => {
  assert.equal(spvDeadline("2025-12-31"), "2026-01-05")
  assert.equal(spvDeadline("2025-12-26"), "2025-12-31")
  assert.equal(spvDeadline("2026-01-01"), "2026-01-08") // Thursday
  assert.equal(spvDeadline("2026-01-02"), "2026-01-09")
})

void test("the urgency is overdue after the deadline, imminent up to one working day before it", () => {
  assert.equal(spvUrgency("2026-01-12", "2026-01-13"), "overdue")
  assert.equal(spvUrgency("2026-01-12", "2026-01-12"), "imminent")
  assert.equal(spvUrgency("2026-01-12", "2026-01-09"), "imminent") // Friday: Monday is the next working day
  assert.equal(spvUrgency("2026-01-12", "2026-01-08"), "ok")
  assert.equal(spvUrgency("2026-01-13", "2026-01-12"), "imminent")
  assert.equal(spvUrgency("2026-01-14", "2026-01-12"), "ok")
})

void test("every fiscal state has one group, and failed and unknown are not not_sent", () => {
  const groups = Object.fromEntries(FISCAL_STATES.map((state) => [state, spvState(state)]))
  assert.deepEqual(groups, {
    queued: "in_progress", validating: "in_progress", uploading: "in_progress", processing: "in_progress",
    accepted: "accepted", rejected: "failed", refused: "failed", unknown: "unknown",
  })
  assert.equal(spvState("not_sent"), "not_sent")
})

void test("what needs action is the register's unresolved list: the not_sent, failed and unknown groups", () => {
  const needing = [...FISCAL_STATES, "not_sent" as const].filter(spvNeedsAction)
  assert.deepEqual(needing.sort(), [...SPV_UNRESOLVED_STATUSES].sort())
  assert.ok(needing.every((status) => ["not_sent", "failed", "unknown"].includes(spvState(status))))
})
