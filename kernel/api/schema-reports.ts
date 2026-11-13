import { Schema } from "effect"

import { allErrors, InputText, nullableString, optional } from "./schema-primitives.ts"

const periodOf = (date: Schema.Schema<string>) => ({
  from: date.annotations({ description: "First day of the period, YYYY-MM-DD, inclusive." }),
  to: date.annotations({ description: "Last day of the period, YYYY-MM-DD, inclusive. At most 36 calendar months after from." }),
})
const period = periodOf(Schema.String)
const periodQuery = periodOf(InputText)
export const ReportQuery = Schema.Struct(periodQuery).annotations(allErrors)
export const CollectionsStatusFilter = Schema.Literal("all", "paid", "unpaid", "overdue").annotations({
  description: "paid = paid, overpaid and credited (fully reversed by storno); unpaid = unpaid, partially paid and overdue; default all.",
})
export const CollectionsQuery = Schema.Struct({ ...periodQuery, status: optional(CollectionsStatusFilter) }).annotations(allErrors)

const revenueFigures = {
  revenueExcludingVat: Schema.String, invoicedIncludingVat: Schema.String, invoiceCount: Schema.Int, correctionCount: Schema.Int,
}
export const RevenueReport = Schema.Struct({
  ...period, currency: Schema.Literal("RON"),
  months: Schema.Array(Schema.Struct({ month: Schema.String, ...revenueFigures })),
  totals: Schema.Struct(revenueFigures),
}).annotations({
  description: "Issued invoices plus corrections by issue month; corrections count with their negative totals. Every month of the period is listed.",
})

const PaymentStatus = Schema.Literal("unpaid", "partially_paid", "paid", "overpaid", "overdue", "credited")
const CollectionInvoice = Schema.Struct({
  id: Schema.String, series: Schema.String, number: Schema.Int, issueDate: Schema.String, dueDate: nullableString,
  customer: Schema.Struct({ name: Schema.String }), totalIncludingVat: Schema.String,
  paidAmount: Schema.String, creditedAmount: Schema.String, remainingAmount: Schema.String, status: PaymentStatus,
})
export const CollectionsReport = Schema.Struct({
  ...period, currency: Schema.Literal("RON"), status: CollectionsStatusFilter,
  months: Schema.Array(Schema.Struct({ month: Schema.String, collected: Schema.String })),
  collected: Schema.String,
  invoices: Schema.Struct({
    count: Schema.Int, totalIncludingVat: Schema.String, paidAmount: Schema.String, creditedAmount: Schema.String,
    remainingAmount: Schema.String, overdueCount: Schema.Int, overdueAmount: Schema.String, items: Schema.Array(CollectionInvoice),
  }),
}).annotations({
  description: "months/collected: payments minus reversals by payment date, independent of status. invoices: the invoices issued in the period that match status, with today's status and balance; the totals cover all of them, items the first 50 by due date.",
})
