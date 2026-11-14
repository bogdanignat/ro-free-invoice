/**
 * The application's confirmation, without React or the DOM.
 *
 * One question is open at a time. A second one asked while the first waits —
 * a double click that reached the button before the dialog covered it — is
 * answered `false` at once, so it can never start a second operation. The
 * open question is answered by `settle` (the dialog's buttons and Escape) or
 * by `cancel` (the screen that asked went away), which is always a „no”.
 */
export type ConfirmTone = "default" | "danger"

export interface ConfirmOptions {
  /** The confirming button; „Confirmă” when absent. */
  readonly confirmLabel?: string
  /** `danger` for deletions and reversals. */
  readonly tone?: ConfirmTone
}

export interface ConfirmRequest {
  readonly message: string
  readonly confirmLabel: string
  readonly tone: ConfirmTone
}

export interface ConfirmController {
  /** `owner` lets `cancel` drop only the question its owner asked. */
  readonly request: (message: string, options?: ConfirmOptions, owner?: object) => Promise<boolean>
  readonly current: () => ConfirmRequest | undefined
  readonly settle: (answer: boolean) => void
  /** Answers the open question `false`; with an `owner`, only when that owner asked it. */
  readonly cancel: (owner?: object) => void
  readonly subscribe: (listener: () => void) => () => void
}

interface OpenQuestion {
  readonly request: ConfirmRequest
  readonly owner: object | undefined
  readonly resolve: (answer: boolean) => void
}

export const createConfirmController = (): ConfirmController => {
  let open: OpenQuestion | undefined
  const listeners = new Set<() => void>()
  const close = (answer: boolean): void => {
    if (open === undefined) return
    const { resolve } = open
    open = undefined
    for (const listener of listeners) listener()
    resolve(answer)
  }
  return {
    request: (message, options = {}, owner) => {
      if (open !== undefined) return Promise.resolve(false)
      const request = { message, confirmLabel: options.confirmLabel ?? "Confirmă", tone: options.tone ?? "default" }
      const answer = new Promise<boolean>((resolve) => { open = { request, owner, resolve } })
      for (const listener of listeners) listener()
      return answer
    },
    current: () => open?.request,
    settle: close,
    cancel: (owner) => { if (owner === undefined || open?.owner === owner) close(false) },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

/**
 * A guarded question: `allowed` reads the guard as it stands now, so it is
 * checked before asking and again on the answer, after the dialog was open.
 */
export const confirmWhile = async (allowed: () => boolean, ask: () => Promise<boolean>): Promise<boolean> =>
  allowed() && await ask() && allowed()
