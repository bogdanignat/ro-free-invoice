import assert from "node:assert/strict"
import test from "node:test"

import { calendarDate, moneyMinor, type Payment } from "./payments.ts"
import { collectionsListLimit, collectionsReport, type CollectionInvoiceRow, type CollectionsStatusFilter } from "./collections-report.ts"
import { derivePaymentStatus, paymentAmounts, paymentStatus, sumPaymentsMinor } from "./settlement.ts"

const payment = (amount: string, kind: Payment["kind"] = "payment"): Payment => ({
  id: `${kind}-${amount}`, invoiceId: "invoice-1", organizationId: "org-1", kind, amount, currency: "RON",
  paymentDate: "2026-09-01", method: "transfer", actorId: "user-1", createdAt: "2026-09-01T10:00:00.000Z",
})

void test("the per-invoice status and the aggregated classification agree on every edge", () => {
  const now = new Date("2026-09-10T10:00:00.000Z")
  const cases = [
    { name: "zero total, nothing paid, due before today", total: "0.00", dueDate: "2026-09-09", payments: [], expected: "overdue" },
    { name: "zero total, no due date", total: "0.00", dueDate: null, payments: [], expected: "unpaid" },
    { name: "overpaid after the due date", total: "100.00", dueDate: "2026-09-01", payments: [payment("150.00")], expected: "overpaid" },
    { name: "paid in full after the due date", total: "100.00", dueDate: "2026-09-01", payments: [payment("100.00")], expected: "paid" },
    { name: "partial, no due date", total: "100.00", dueDate: null, payments: [payment("40.00")], expected: "partially_paid" },
    { name: "due today", total: "100.00", dueDate: "2026-09-10", payments: [], expected: "unpaid" },
    { name: "partial, due yesterday", total: "100.00", dueDate: "2026-09-09", payments: [payment("40.00")], expected: "overdue" },
    { name: "reversed payment", total: "100.00", dueDate: null, payments: [payment("40.00"), payment("40.00", "reversal")], expected: "unpaid" },
  ] as const
  for (const { name, total, dueDate, payments, expected } of cases) {
    const derived = derivePaymentStatus({ totalIncludingVat: total, creditedAmount: "0.00", dueDate, payments, now })
    const aggregated = paymentStatus({ total: moneyMinor(total), credited: 0n, paid: sumPaymentsMinor(payments), dueDate, today: calendarDate(now) })
    assert.deepEqual([derived, aggregated], [expected, expected], name)
  }
})

const row = (id: string, totalIncludingVat: string, paidAmount: string, dueDate: string | null, creditedAmount = "0.00"): CollectionInvoiceRow => ({
  id, series: "F", number: Number(id.replace(/\D/gu, "")) || 1, issueDate: "2026-08-01", dueDate,
  customer: { name: "Client SRL" }, totalIncludingVat, paidAmount, creditedAmount,
})
const rows = [
  row("overdue-1", "100.00", "30.00", "2026-09-01"),
  row("unpaid-2", "50.00", "0.00", "2026-09-20"),
  row("paid-3", "80.00", "80.00", "2026-09-05"),
  row("overpaid-4", "20.00", "25.00", null),
]
const report = (status: CollectionsStatusFilter, invoices: ReadonlyArray<CollectionInvoiceRow> = rows) => collectionsReport({
  period: { from: "2026-07-15", to: "2026-09-10" }, status, today: "2026-09-10",
  monthly: { months: [{ month: "2026-09", collected: "-10.00" }], collected: "-10.00" }, invoices,
})

void test("the period block is continuous and does not depend on the status filter", () => {
  for (const status of ["all", "overdue"] as const) {
    const { months, collected } = report(status)
    assert.deepEqual(months, [{ month: "2026-07", collected: "0.00" }, { month: "2026-08", collected: "0.00" }, { month: "2026-09", collected: "-10.00" }])
    assert.equal(collected, "-10.00")
  }
})

void test("each filter keeps its statuses, in the store's order, with today's balance", () => {
  const ids = (status: CollectionsStatusFilter) => report(status).invoices.items.map((item) => item.id)
  assert.deepEqual(ids("all"), ["overdue-1", "unpaid-2", "paid-3", "overpaid-4"])
  assert.deepEqual(ids("paid"), ["paid-3", "overpaid-4"])
  assert.deepEqual(ids("unpaid"), ["overdue-1", "unpaid-2"])
  assert.deepEqual(ids("overdue"), ["overdue-1"])
  assert.deepEqual(report("all").invoices.items.map(({ status, paidAmount, remainingAmount }) => [status, paidAmount, remainingAmount]), [
    ["overdue", "30.00", "70.00"], ["unpaid", "0.00", "50.00"], ["paid", "80.00", "0.00"], ["overpaid", "25.00", "0.00"],
  ])
})

void test("totals cover the whole filtered set; overdue is the balance left, not the invoice value", () => {
  const { items, ...totals } = report("unpaid").invoices
  assert.equal(items.length, 2)
  assert.deepEqual(totals, { count: 2, totalIncludingVat: "150.00", paidAmount: "30.00", creditedAmount: "0.00", remainingAmount: "120.00",
    overdueCount: 1, overdueAmount: "70.00" })
})

void test("the list stops at the limit after the totals are taken", () => {
  const many = Array.from({ length: collectionsListLimit + 5 }, (_, index) => row(`i${String(index + 1)}`, "10.00", "0.00", null))
  const { invoices } = report("unpaid", many)
  assert.equal(invoices.count, collectionsListLimit + 5)
  assert.equal(invoices.totalIncludingVat, "550.00")
  assert.equal(invoices.items.length, collectionsListLimit)
  assert.equal(invoices.items.at(-1)?.id, `i${String(collectionsListLimit)}`)
})

const position = (total: string, credited: string, paid: string, dueDate: string | null = null) => ({
  total: moneyMinor(total), credited: moneyMinor(credited), paid: moneyMinor(paid), dueDate, today: "2026-09-10",
})

void test("a storno takes its sum off the debt the status is read against", () => {
  const cases = [
    { name: "no storno", position: position("100.00", "0.00", "40.00"), status: "partially_paid", remaining: "60.00" },
    { name: "partial storno, nothing paid", position: position("100.00", "30.00", "0.00"), status: "unpaid", remaining: "70.00" },
    { name: "partial storno, rest paid", position: position("100.00", "30.00", "70.00"), status: "paid", remaining: "0.00" },
    { name: "partial storno, more than the rest paid", position: position("100.00", "30.00", "80.00"), status: "overpaid", remaining: "0.00" },
    { name: "partial storno, past due, rest unpaid", position: position("100.00", "30.00", "0.00", "2026-09-01"), status: "overdue", remaining: "70.00" },
    { name: "full storno, nothing paid, past due", position: position("100.00", "100.00", "0.00", "2026-09-01"), status: "credited", remaining: "0.00" },
    { name: "full storno, money in", position: position("100.00", "100.00", "100.00", "2026-09-01"), status: "overpaid", remaining: "0.00" },
    { name: "full storno, payment reversed", position: position("100.00", "100.00", "0.00"), status: "credited", remaining: "0.00" },
    { name: "zero total, nothing credited, stays unpaid", position: position("0.00", "0.00", "0.00"), status: "unpaid", remaining: "0.00" },
  ] as const
  for (const { name, position: input, status, remaining } of cases) {
    const amounts = paymentAmounts(input)
    assert.deepEqual([amounts.status, amounts.remainingAmount], [status, remaining], name)
  }
})

void test("several stornos add up, and the report keeps credited invoices out of unpaid and overdue", () => {
  const stornoed = [
    row("half-1", "100.00", "0.00", "2026-09-01", "50.00"), row("done-2", "100.00", "0.00", "2026-09-01", "100.00"),
    row("paid-3", "100.00", "100.00", "2026-09-01", "100.00"),
  ]
  const ids = (status: CollectionsStatusFilter) => report(status, stornoed).invoices.items.map((item) => item.id)
  assert.deepEqual(ids("all"), ["half-1", "done-2", "paid-3"])
  assert.deepEqual(ids("paid"), ["done-2", "paid-3"])
  assert.deepEqual(ids("unpaid"), ["half-1"])
  assert.deepEqual(ids("overdue"), ["half-1"])
  const { invoices } = report("all", stornoed)
  assert.deepEqual([invoices.creditedAmount, invoices.remainingAmount, invoices.overdueAmount], ["250.00", "50.00", "50.00"])
  assert.equal(invoices.items[1]?.status, "credited")
})
