/** Joins the class lists that are set, skipping `undefined`, `false` and empty strings. */
export const cx = (...parts: ReadonlyArray<string | false | null | undefined>): string => parts.filter(Boolean).join(" ")
