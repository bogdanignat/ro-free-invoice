import { Effect } from "effect"

import { reportPeriodDetails } from "../../corrections/index.ts"
import { validationFailure, type PaymentsFailure } from "../contracts/failures.ts"
import { legacyPaymentsPermissions, paymentsPermissions } from "../contracts/permissions.ts"
import { collectionsReport, type CollectionsReport, type CollectionsStatusFilter } from "../domain/collections-report.ts"
import { calendarDate } from "../domain/payments.ts"
import type { Authorize, PaymentsDependencies } from "./support.ts"

export interface CollectionsReportInput { readonly from: string; readonly to: string; readonly status: CollectionsStatusFilter }

// Both aggregates are read under one lock; the classification runs after it is released.
export const createCollectionsReport = (dependencies: PaymentsDependencies, authorized: Authorize) => {
  const permissions = paymentsPermissions(dependencies.cubeIdentity)
  return (input: CollectionsReportInput): Effect.Effect<CollectionsReport, PaymentsFailure> => Effect.gen(function*() {
    const period = { from: input.from, to: input.to }
    const details = reportPeriodDetails(period)
    if (details.length > 0) return yield* Effect.fail(validationFailure(details))
    const context = yield* authorized(permissions.read, legacyPaymentsPermissions.read); const now = yield* dependencies.clock.now
    const [monthly, invoices] = yield* dependencies.store.transaction((transaction) => Effect.all([
      transaction.aggregateCollections(context.organization.id, period),
      transaction.listCollectionInvoices(context.organization.id, period),
    ]))
    return collectionsReport({ period, status: input.status, today: calendarDate(now), monthly, invoices })
  })
}
