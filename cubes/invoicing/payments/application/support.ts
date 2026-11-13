import { Effect } from "effect"

import { DomainConflict, PermissionDenied, ResourceNotFound, validationFailure, type PaymentsFailure, type ValidationFailure } from "../contracts/failures.ts"
import type { Clock, IdGenerator, RequestContext, RequestContextProvider, TransactionalStore } from "../contracts/host.ts"
import { calendarDate, moneyMinor, type IdempotencyAttempt, type Payment, type PaymentIdempotencyRecord, type PaymentOperation } from "../domain/payments.ts"
import { idempotencyFingerprintInvalid, idempotencyKeyInvalid } from "../../issues/index.ts"
import { paymentAmounts, sumPaymentsMinor, type PaymentAmounts } from "../domain/settlement.ts"
import type { AuditEvent, InvoiceSnapshot, PaymentsTransaction } from "./ports.ts"

export interface PaymentsDependencies {
  readonly context: RequestContextProvider
  readonly clock: Clock
  readonly ids: IdGenerator
  readonly store: TransactionalStore<PaymentsTransaction>
  readonly cubeIdentity: string
}
export type RecordPaymentResult = PaymentAmounts & { readonly payment: Payment }
export type InvoicePaymentSummary = PaymentAmounts & { readonly invoiceId: string; readonly payments: ReadonlyArray<Payment> }

export type Authorize = (permission: string, legacyPermission: string) => Effect.Effect<RequestContext, PaymentsFailure>

export const createAuthorize = (dependencies: PaymentsDependencies): Authorize => (permission, legacyPermission) =>
  Effect.flatMap(dependencies.context.current, (context) =>
    context.identity.permissions.includes(permission) || context.identity.permissions.includes(legacyPermission)
      ? Effect.succeed(context)
      : Effect.fail(new PermissionDenied({ permission })))

export const summarize = (invoice: InvoiceSnapshot, payments: ReadonlyArray<Payment>, now: Date): PaymentAmounts => paymentAmounts({
  total: moneyMinor(invoice.totalIncludingVat), credited: moneyMinor(invoice.creditedAmount), paid: sumPaymentsMinor(payments), dueDate: invoice.dueDate, today: calendarDate(now),
})
export const recordAuditEvent = (
  transaction: PaymentsTransaction, context: RequestContext, dependencies: PaymentsDependencies, occurredAt: Date,
  event: Pick<AuditEvent, "action" | "targetKind" | "targetId" | "reason">,
) => Effect.flatMap(dependencies.ids.next, (id) => transaction.appendAuditEvent({
  id, organizationId: context.organization.id, actorId: context.identity.id, occurredAt: occurredAt.toISOString(), ...event,
}))
export const missingInvoice = (id: string) => new ResourceNotFound({ resource: "invoice", id })
export const missingPayment = (id: string) => new ResourceNotFound({ resource: "payment", id })

// Replays answer with the same result the first request produced, recomputed against today's balance.
export const replayed = (transaction: PaymentsTransaction, context: RequestContext, invoice: InvoiceSnapshot, paymentId: string, now: Date) => Effect.gen(function*() {
  const payment = yield* transaction.findPayment(context.organization.id, invoice.id, paymentId)
  if (payment === undefined) return yield* Effect.fail(missingPayment(paymentId))
  const payments = yield* transaction.listPayments(context.organization.id, invoice.id)
  return { payment, ...summarize(invoice, payments, now) } satisfies RecordPaymentResult
})

export const validateAttempt = (attempt: IdempotencyAttempt): Effect.Effect<void, ValidationFailure> => {
  const validKey = /^[\x21-\x7e]{1,255}$/.test(attempt.key)
  const validFingerprint = /^sha256:[a-f0-9]{64}$/.test(attempt.fingerprint)
  return validKey && validFingerprint
    ? Effect.void
    : Effect.fail(validationFailure([validKey ? idempotencyFingerprintInvalid() : idempotencyKeyInvalid()]))
}

// Returns the id of the payment row an identical earlier request produced, or fails when the key was reused for a different request.
export const findReplay = (
  transaction: PaymentsTransaction, organizationId: string, attempt: IdempotencyAttempt, operation: PaymentOperation,
): Effect.Effect<string | undefined, PaymentsFailure> => Effect.gen(function*() {
  const existing = yield* transaction.findIdempotencyRecord(organizationId, attempt.key)
  if (existing === undefined) return undefined
  if (existing.operation !== operation || existing.fingerprint !== attempt.fingerprint) {
    return yield* Effect.fail(new DomainConflict({ code: "idempotency_key_reused", message: "Idempotency key was already used for a different request" }))
  }
  return existing.resultId
})

export const idempotencyRecord = (
  organizationId: string, attempt: IdempotencyAttempt, operation: PaymentOperation, resultId: string, createdAt: string,
): PaymentIdempotencyRecord => ({ organizationId, ...attempt, operation, resultId, createdAt })
