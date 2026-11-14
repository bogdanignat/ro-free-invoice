import { Effect } from "effect"

import type { InvoicingFailure } from "../contracts/failures.ts"
import type { InvoicingPermissions } from "../contracts/permissions.ts"
import { CIUS_TEXT_LIMITS, DOCUMENT_NOTES_MAX_LENGTH } from "../domain/validation.ts"
import { ROMANIAN_COUNTIES, type RomanianCounty } from "../parties/index.ts"
import type { Authorize } from "./support.ts"

/** What a form offers and limits before the server checks it: the cube's own lists, never a copy. */
export interface ReferenceData {
  readonly counties: ReadonlyArray<RomanianCounty>
  readonly textLimits: typeof CIUS_TEXT_LIMITS & { readonly documentNotes: number }
}

export interface ReferenceDataOperations {
  readonly getReferenceData: () => Effect.Effect<ReferenceData, InvoicingFailure>
}

export const createReferenceDataOperations = (permissions: InvoicingPermissions, authorize: Authorize): ReferenceDataOperations => ({
  getReferenceData: () => Effect.gen(function*() {
    yield* authorize(permissions.read)
    return {
      counties: ROMANIAN_COUNTIES.map((county) => ({ ...county })),
      textLimits: { ...CIUS_TEXT_LIMITS, documentNotes: DOCUMENT_NOTES_MAX_LENGTH },
    }
  }),
})
