import { ValidationFailure } from "../contracts/failures.ts"

/** The one rule for a `q` search text: the register, the customers and the product presets share it. */
export const maximumSearchLength = 100

/** Empty when the text can be searched for. */
export const searchTextIssues = (search: string | undefined): ReadonlyArray<string> => {
  const issues: Array<string> = []
  if (search !== undefined && search.length > maximumSearchLength) issues.push(`q must be at most ${String(maximumSearchLength)} characters`)
  if (search !== undefined && /\p{Cc}/u.test(search)) issues.push("q must not contain control characters")
  return issues
}

/** A blank search is no search, and the search is trimmed. */
export const normalizeSearchText = (search: string | undefined): string | undefined => {
  const trimmed = search?.trim()
  return trimmed === "" ? undefined : trimmed
}

/** The text a store runs, or the refusal; for operations that take only `q`. */
export const requireSearchText = (search: string | undefined): string | undefined => {
  const issues = searchTextIssues(search)
  if (issues.length > 0) throw new ValidationFailure({ issues })
  return normalizeSearchText(search)
}
