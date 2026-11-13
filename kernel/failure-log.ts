// A 500 says "internal_failure" and nothing more, on purpose: the caller cannot
// act on a bug in the server, and a leaked reason is a leaked internal. That
// opacity is only honest if the reason survives on this side, so every such
// answer writes exactly one line here first. Without it a defect leaves no
// trace at all and the next bug report is "salvarea a eșuat" with nothing to go
// on — which is how this module came to exist.
import { redactSecrets } from "./storage/postgres-errors.ts"

const reasonLimit = 4000
const frameLimit = 12

// Free text can quote request values (a CNP, a name, a token) because Effect and
// Schema messages cite what they refused. `redactSecrets` only knows passwords and
// URL credentials, so the rest is masked by shape: long hex, base64 or JWT runs,
// then 13 digits. A run is a token when a 16+ character stretch between "/" and "."
// holds a digit and is not a UUID: a path is short segments, a bare long word is a
// name, a UUID an id kept for debugging. Tokens go first so 13 digits inside one cannot
// split it into fragments too short to be masked.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const isToken = (run: string): boolean =>
  run.split(/[/.]/u).some((part) => part.length >= 16 && /\d/u.test(part) && !uuid.test(part))
const sanitize = (text: string): string => redactSecrets(text)
  .replace(/(?<![\w+/.-])[\w+/.-]{32,}={0,2}/gu, (run) => isToken(run) ? "[redacted]" : run)
  .replace(/(?<!\d)\d{13}(?!\d)/gu, "[redacted]")

export interface InternalFailure {
  // Where the answer was decided: an unmapped domain failure, a declared server
  // failure whose wire tag drops the reason, a defect caught by the API
  // middleware, or a throw in the plain HTTP layer.
  readonly kind: "unmapped_failure" | "server_failure" | "defect" | "api_docs" | "request"
  readonly reason: string
}

export const internalFailureLine = (failure: InternalFailure): string => JSON.stringify({
  event: "internal_failure", kind: failure.kind, reason: sanitize(failure.reason).slice(0, reasonLimit),
})

export const logInternalFailure = (failure: InternalFailure): void => {
  process.stderr.write(`${internalFailureLine(failure)}\n`)
}

/**
 * What helps to debug a thrown value without its payload: the error name, its
 * `code`/`_tag` when it has one, and the stack frames. The message is left out on
 * purpose — it is where a refused value gets quoted.
 */
export const failureReason = (error: unknown): string => {
  if (typeof error !== "object" || error === null) return `non-error thrown: ${typeof error}`
  const label = (key: "code" | "_tag"): Array<string> => {
    const value: unknown = Reflect.get(error, key)
    return typeof value === "string" || typeof value === "number" ? [`${key}=${String(value)}`] : []
  }
  const name = error instanceof Error ? error.name : "object"
  const frames = error instanceof Error && error.stack !== undefined
    ? error.stack.split("\n").filter((line) => line.startsWith("    at ")).slice(0, frameLimit)
    : []
  return [[name, ...label("_tag"), ...label("code")].join(" "), ...frames].join("\n")
}
