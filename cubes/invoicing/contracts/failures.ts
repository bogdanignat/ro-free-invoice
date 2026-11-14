import { Data } from "effect"

import { renderIssue, type IssueDetail } from "../issues/index.ts"

export class AuthenticationRequired extends Data.TaggedError("AuthenticationRequired") {}

export class OrganizationContextMissing extends Data.TaggedError("OrganizationContextMissing") {}

export class PermissionDenied extends Data.TaggedError("PermissionDenied")<{
  readonly permission: string
}> {}

export class ValidationFailure extends Data.TaggedError("ValidationFailure")<{
  readonly issues: ReadonlyArray<string>
  /** Aligned 1:1 with `issues`: the code the browser says in Romanian. */
  readonly details: ReadonlyArray<IssueDetail>
}> {}

export const validationFailure = (details: ReadonlyArray<IssueDetail>): ValidationFailure =>
  new ValidationFailure({ issues: details.map(renderIssue), details })

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
