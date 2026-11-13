import { continuousMonths, type ReportPeriod } from "../../corrections/index.ts"
import { formatMinor, moneyMinor, type PaymentStatus } from "./payments.ts"
import { paymentAmounts, type PaymentAmounts } from "./settlement.ts"

export type CollectionsStatusFilter = "all" | "paid" | "unpaid" | "overdue"
export const collectionsStatusFilters: ReadonlyArray<CollectionsStatusFilter> = ["all", "paid", "unpaid", "overdue"]
const statusesOf: Readonly<Record<CollectionsStatusFilter, ReadonlyArray<PaymentStatus>>> = {
  all: ["unpaid", "partially_paid", "paid", "overpaid", "overdue", "credited"],
  paid: ["paid", "overpaid", "credited"],
  unpaid: ["unpaid", "partially_paid", "overdue"],
  overdue: ["overdue"],
}
export const collectionsListLimit = 50

export interface CollectedMonth { readonly month: string; readonly collected: string }
/** Payments minus reversals by payment date: the months that have any, and the whole period. */
export interface MonthlyCollections { readonly months: ReadonlyArray<CollectedMonth>; readonly collected: string }

/** An invoice issued in the period, with the net sum of all its payments, whatever their date. */
export interface CollectionInvoiceRow {
  readonly id: string
  readonly series: string
  readonly number: number
  readonly issueDate: string
  readonly dueDate: string | null
  readonly customer: { readonly name: string }
  readonly totalIncludingVat: string
  readonly paidAmount: string
  readonly creditedAmount: string
}
export type CollectionInvoice = CollectionInvoiceRow & PaymentAmounts

/** The invoices the filter keeps: every total covers all of them, `items` only the first ones. */
export interface CollectionsSituation {
  readonly count: number
  readonly totalIncludingVat: string
  readonly paidAmount: string
  readonly creditedAmount: string
  readonly remainingAmount: string
  readonly overdueCount: number
  readonly overdueAmount: string
  readonly items: ReadonlyArray<CollectionInvoice>
}

export interface CollectionsReport extends ReportPeriod {
  readonly currency: "RON"
  readonly status: CollectionsStatusFilter
  readonly months: ReadonlyArray<CollectedMonth>
  readonly collected: string
  readonly invoices: CollectionsSituation
}

const sum = (rows: ReadonlyArray<CollectionInvoice>, amount: (row: CollectionInvoice) => string): string =>
  formatMinor(rows.reduce((total, row) => total + moneyMinor(amount(row)), 0n))

const situation = (invoices: ReadonlyArray<CollectionInvoice>): CollectionsSituation => {
  const overdue = invoices.filter((invoice) => invoice.status === "overdue")
  return {
    count: invoices.length, totalIncludingVat: sum(invoices, (row) => row.totalIncludingVat),
    paidAmount: sum(invoices, (row) => row.paidAmount), creditedAmount: sum(invoices, (row) => row.creditedAmount),
    remainingAmount: sum(invoices, (row) => row.remainingAmount),
    overdueCount: overdue.length, overdueAmount: sum(overdue, (row) => row.remainingAmount),
    items: invoices.slice(0, collectionsListLimit),
  }
}

/**
 * Status and balance are today's, not the ones at `to`. The rows arrive in list
 * order, so filtering keeps it and the list is cut only after the totals.
 */
export const collectionsReport = (input: {
  readonly period: ReportPeriod
  readonly status: CollectionsStatusFilter
  readonly today: string
  readonly monthly: MonthlyCollections
  readonly invoices: ReadonlyArray<CollectionInvoiceRow>
}): CollectionsReport => {
  const invoices = input.invoices.map((row): CollectionInvoice => ({ ...row, ...paymentAmounts({
    total: moneyMinor(row.totalIncludingVat), credited: moneyMinor(row.creditedAmount), paid: moneyMinor(row.paidAmount), dueDate: row.dueDate, today: input.today,
  }) })).filter((invoice) => statusesOf[input.status].includes(invoice.status))
  return {
    from: input.period.from, to: input.period.to, currency: "RON", status: input.status,
    months: continuousMonths(input.period, input.monthly.months, (month) => ({ month, collected: "0.00" })),
    collected: input.monthly.collected, invoices: situation(invoices),
  }
}
