const identity = "payments"
export const cube = {
  manifest: {
    name: identity,
    parent: "invoicing",
    summary: "Tenant-scoped invoice payment recording and settlement status",
    required: false,
    tables: ["invoice_payments", "payment_idempotency_records"],
  },
}

export * from "./contracts/index.ts"
export * from "./domain/payments.ts"
export * from "./domain/settlement.ts"
export * from "./domain/collections-report.ts"
export { createPaymentsService } from "./application/payments.ts"
export type { CollectionsReportInput } from "./application/collections.ts"
export type { InvoicePaymentSummary, PaymentsDependencies, PaymentsService, RecordPaymentResult } from "./application/payments.ts"
export type { InvoiceSnapshot, PaymentsTransaction } from "./application/ports.ts"
