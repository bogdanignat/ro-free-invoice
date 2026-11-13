import { validationFailure } from "../contracts/failures.ts"
import { containsControlCharacters, tooLong, type IssueDetail } from "../issues/index.ts"

/** The one rule for a `q` search text: the register, the customers and the product presets share it. */
export const maximumSearchLength = 100

/** Empty when the text can be searched for. */
export const searchTextDetails = (search = ""): ReadonlyArray<IssueDetail> => [
  ...search.length > maximumSearchLength ? [tooLong("q", maximumSearchLength)] : [],
  .../\p{Cc}/u.test(search) ? [containsControlCharacters("q")] : [],
]

/** A blank search is no search, and the search is trimmed. */
export const normalizeSearchText = (search: string | undefined): string | undefined => {
  const trimmed = search?.trim()
  return trimmed === "" ? undefined : trimmed
}

/** The text a store runs, or the refusal; for operations that take only `q`. */
export const requireSearchText = (search: string | undefined): string | undefined => {
  const details = searchTextDetails(search)
  if (details.length > 0) throw validationFailure(details)
  return normalizeSearchText(search)
}
