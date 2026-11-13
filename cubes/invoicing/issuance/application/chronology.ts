import { Effect } from "effect"

import type { InvoicingTransaction } from "../../application/ports.ts"
import { validationFailure, type ValidationFailure, type PersistenceFailure } from "../../contracts/failures.ts"
import { issueDateBeforeLast, issueDateFuture } from "../../issues/index.ts"
import type { NumberedDocumentType } from "../../domain/invoice.ts"

export const ensureChronology = (tx: InvoicingTransaction, org: string, kind: NumberedDocumentType, series: string,
  issueDate: string, today: string): Effect.Effect<void, ValidationFailure | PersistenceFailure> => Effect.gen(function*() {
  if (issueDate > today) return yield* Effect.fail(validationFailure([issueDateFuture()]))
  const latest = yield* tx.findLatestIssueDate(org, kind, series)
  if (latest !== undefined && issueDate < latest) return yield* Effect.fail(validationFailure([issueDateBeforeLast(latest, kind, series)]))
})
