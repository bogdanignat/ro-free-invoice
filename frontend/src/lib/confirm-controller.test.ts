import assert from "node:assert/strict"
import test from "node:test"

import { confirmWhile, createConfirmController } from "./confirm-controller.ts"

void test("settle(true) confirms the open question and closes it", async () => {
  const controller = createConfirmController()
  const answer = controller.request("Ștergi?", { confirmLabel: "Șterge", tone: "danger" })
  assert.deepEqual(controller.current(), { message: "Ștergi?", confirmLabel: "Șterge", tone: "danger" })
  controller.settle(true)
  assert.equal(await answer, true)
  assert.equal(controller.current(), undefined)
})

void test("settle(false) refuses, and the defaults name the button „Confirmă”", async () => {
  const controller = createConfirmController()
  const answer = controller.request("Emiți?")
  assert.deepEqual(controller.current(), { message: "Emiți?", confirmLabel: "Confirmă", tone: "default" })
  controller.settle(false)
  assert.equal(await answer, false)
})

void test("a second question while one is open is refused at once and leaves the first open", async () => {
  const controller = createConfirmController()
  const first = controller.request("Primul")
  assert.equal(await controller.request("Al doilea"), false)
  assert.equal(controller.current()?.message, "Primul")
  controller.settle(true)
  assert.equal(await first, true)
})

void test("cancel answers the open question false", async () => {
  const controller = createConfirmController()
  const answer = controller.request("Emiți?")
  controller.cancel()
  assert.equal(await answer, false)
  assert.equal(controller.current(), undefined)
})

void test("cancel with an owner drops only that owner's question", async () => {
  const controller = createConfirmController()
  const owner = {}
  const answer = controller.request("Emiți?", {}, owner)
  controller.cancel({})
  assert.equal(controller.current()?.message, "Emiți?")
  controller.cancel(owner)
  assert.equal(await answer, false)
})

void test("a question after settle is asked again, and settling twice changes nothing", async () => {
  const controller = createConfirmController()
  const first = controller.request("Primul")
  controller.settle(false)
  controller.settle(true)
  assert.equal(await first, false)
  const second = controller.request("Al doilea")
  assert.equal(controller.current()?.message, "Al doilea")
  controller.settle(true)
  assert.equal(await second, true)
})

void test("subscribers hear the question open and close", () => {
  const controller = createConfirmController()
  let calls = 0
  const unsubscribe = controller.subscribe(() => { calls += 1 })
  void controller.request("Emiți?")
  controller.settle(true)
  unsubscribe()
  void controller.request("Din nou")
  assert.equal(calls, 2)
})

void test("confirmWhile asks only while allowed and counts the answer only if still allowed", async () => {
  let asked = 0
  const ask = (answer: boolean) => () => { asked += 1; return Promise.resolve(answer) }
  assert.equal(await confirmWhile(() => false, ask(true)), false)
  assert.equal(asked, 0)
  assert.equal(await confirmWhile(() => true, ask(false)), false)
  let allowed = true
  const revoke = () => { asked += 1; allowed = false; return Promise.resolve(true) }
  assert.equal(await confirmWhile(() => allowed, revoke), false)
  assert.equal(await confirmWhile(() => true, ask(true)), true)
  assert.equal(asked, 3)
})
