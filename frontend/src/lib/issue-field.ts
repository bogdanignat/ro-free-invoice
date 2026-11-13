import { localizedIssue } from "./issue-messages.ts"

/**
 * The field of the detail a failure's message was read from (the first one
 * `localizedIssue` can localize), so a screen can show it under that control.
 * A message that came from elsewhere names no field.
 */
export const localizedIssueField = (details: unknown, message: string): string | undefined => {
  if (!Array.isArray(details) || localizedIssue(details) !== message) return undefined
  const detail: unknown = details.find((item) => localizedIssue([item]) !== undefined)
  return typeof detail === "object" && detail !== null && "field" in detail && typeof detail.field === "string"
    ? detail.field
    : undefined
}
