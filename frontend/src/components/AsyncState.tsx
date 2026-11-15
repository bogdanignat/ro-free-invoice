import type { ReactNode } from "react"

import { Button } from "./ui/Button.tsx"
import { CardText } from "./ui/CardText.tsx"
import { StatusNote } from "./ui/StatusNote.tsx"
import { ApiFailure } from "../lib/api-errors.ts"

interface ErrorAlertProps {
  readonly error: unknown
  /** Rendered only when the caller's model decided this failure is worth retrying. */
  readonly onRetry?: (() => void) | undefined
}

export const ErrorAlert = ({ error, onRetry }: ErrorAlertProps) => {
  const failure = error instanceof ApiFailure ? error : undefined
  return <StatusNote tone="error" role="alert">
    <strong>Nu am putut finaliza operația.</strong>
    <CardText>{failure?.message ?? (error instanceof Error ? error.message : "A apărut o eroare neașteptată.")}</CardText>
    {onRetry === undefined ? null : <CardText><Button type="button" onClick={onRetry}>Reîncearcă</Button></CardText>}
  </StatusNote>
}

export const Loading = ({ label }: { readonly label: string }) =>
  <div className="grid place-items-center min-h-[45vh] text-invoice-muted" role="status">
    <span className="size-8 rounded-full border-3 border-invoice-border border-t-invoice-primary animate-[spin_.8s_linear_infinite]" aria-hidden="true" />
    <CardText>{label}</CardText>
  </div>

// In a card the sentence also takes the legacy `.card p` line height.
export const EmptyState = ({ children }: { readonly children: ReactNode }) =>
  <p className="m-0 py-7 text-invoice-muted text-center in-data-[card]:leading-[1.6]">{children}</p>
