/**
 * A logout the server never confirmed, which is not the same as a session ended.
 */
export class LogoutUnconfirmedError extends Error {
  constructor(cause: unknown) {
    const detail = cause instanceof Error ? ` ${cause.message}` : ""
    super(`Serverul nu a confirmat ieșirea; sesiunea poate rămâne activă.${detail}`)
    this.name = "LogoutUnconfirmedError"
  }
}
