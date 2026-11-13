import { Data } from "effect"

import { renderIssue, type IssueDetail } from "../issues/index.ts"

export class AuthenticationRequired extends Data.TaggedError("AuthenticationRequired") {}

export class OrganizationContextMissing extends Data.TaggedError("OrganizationContextMissing") {}

export class PermissionDenied extends Data.TaggedError("PermissionDenied")<{
  readonly permission: string
}> {}

export class ValidationFailure extends Data.TaggedError("ValidationFailure")<{
  readonly issues: ReadonlyArray<string>
  /** Aligned 1:1 with `issues` when present (a hole is an issue without a code); a failure built from bare text has none. */
  readonly details?: ReadonlyArray<IssueDetail | undefined>
}> {}

/** A string is an issue not coded yet: its text goes out as is, with a hole in `details`. */
export const validationFailure = (entries: ReadonlyArray<IssueDetail | string>): ValidationFailure => new ValidationFailure({
  issues: entries.map((entry) => typeof entry === "string" ? entry : renderIssue(entry)),
  details: entries.map((entry) => typeof entry === "string" ? undefined : entry),
})

export class ResourceNotFound extends Data.TaggedError("ResourceNotFound")<{
  readonly resource: string
  readonly id: string
}> {}

export class DomainConflict extends Data.TaggedError("DomainConflict")<{
  readonly code: string
  readonly message: string
}> {}

export class PersistenceFailure extends Data.TaggedError("PersistenceFailure")<{
  readonly operation: string
}> {}

export class RenderingFailure extends Data.TaggedError("RenderingFailure")<{
  readonly template: string
}> {}

export type InvoicingFailure =
  | AuthenticationRequired
  | OrganizationContextMissing
  | PermissionDenied
  | ValidationFailure
  | ResourceNotFound
  | DomainConflict
  | PersistenceFailure
  | RenderingFailure
