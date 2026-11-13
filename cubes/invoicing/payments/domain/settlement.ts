import { calendarDate, formatMinor, moneyMinor, type Payment, type PaymentStatus } from "./payments.ts"

/**
 * Settlement: how much of an invoice is paid, per invoice and across a period.
 * The status is classified once, from the net sum paid; the per-invoice summary
 * sums the payment rows, the collections report gets the sum from the store.
 */
export const sumPaymentsMinor = (payments: ReadonlyArray<Payment>): bigint =>
  payments.reduce((total, payment) => total + (payment.kind === "reversal" ? -moneyMinor(payment.amount) : moneyMinor(payment.amount)), 0n)

/** An invoice's total, what its storno takes off (positive, 0n with none) and the net sum paid, in bani, with its due date and the fiscal today. */
export interface PaymentPosition {
  readonly total: bigint
  readonly credited: bigint
  readonly paid: bigint
  readonly dueDate: string | null
  readonly today: string
}
// Limit: a 0.00 total has no storno sum to see here, so a reversed zero invoice stays `unpaid`.
const isFullyCredited =({ total, credited }: Pick<PaymentPosition, "total" | "credited">): boolean => credited > 0n && total - credited <= 0n
/** Read against the debt net of storno; a full storno with nothing paid is `credited`, with money in it is `overpaid`. */
export const paymentStatus = (position: PaymentPosition): PaymentStatus => {
  const { total, credited, paid, dueDate, today } = position
  if (isFullyCredited(position)) return paid > 0n ? "overpaid" : "credited"
  const owed = total - credited
  const status: PaymentStatus = paid === 0n ? "unpaid" : paid < owed ? "partially_paid" : paid === owed ? "paid" : "overpaid"
  return dueDate !== null && (status === "unpaid" || status === "partially_paid") && dueDate < today ? "overdue" : status
}
export const derivePaymentStatus = (input: {
  readonly totalIncludingVat: string
  readonly creditedAmount: string
  readonly dueDate: string | null
  readonly payments: ReadonlyArray<Payment>
  readonly now: Date
}): PaymentStatus => paymentStatus({
  total: moneyMinor(input.totalIncludingVat), credited: moneyMinor(input.creditedAmount), paid: sumPaymentsMinor(input.payments), dueDate: input.dueDate, today: calendarDate(input.now),
})

export type PaymentAmounts = {
  readonly status: PaymentStatus
  readonly paidAmount: string
  readonly creditedAmount: string
  readonly remainingAmount: string
}
const atLeastZero = (value: bigint): bigint => value < 0n ? 0n : value
/** Status plus the amounts shown next to it; paid and remaining are never negative, remaining is 0 on a full storno. */
export const paymentAmounts = (position: PaymentPosition): PaymentAmounts => ({
  status: paymentStatus(position),
  paidAmount: formatMinor(atLeastZero(position.paid)), creditedAmount: formatMinor(position.credited),
  remainingAmount: formatMinor(isFullyCredited(position) ? 0n : atLeastZero(position.total - position.credited - position.paid)),
})
