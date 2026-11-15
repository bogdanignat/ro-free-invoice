import { useLocation } from "@tanstack/react-router"
import {
  createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject,
} from "react"

import type { ConfirmController, ConfirmOptions, ConfirmRequest } from "../lib/confirm-controller.ts"

/**
 * The application's confirmation: a screen asks, the one dialog in
 * `AppProviders` answers (`lib/confirm-controller.ts` holds the rules).
 */
type ConfirmPort = Pick<ConfirmController, "request" | "cancel">

/** Outside the provider — a screen rendered alone in a test — every question is a „no”. */
const REFUSE_ALL: ConfirmPort = { request: () => Promise.resolve(false), cancel: () => undefined }

export const ConfirmContext = createContext<ConfirmPort>(REFUSE_ALL)

export type Confirm = (message: string, options?: ConfirmOptions) => Promise<boolean>

/** A question asked by a screen that unmounts before the answer is answered „no”. */
export const useConfirm = (): Confirm => {
  const port = useContext(ConfirmContext)
  const [owner] = useState(() => ({}))
  useEffect(() => () => { port.cancel(owner) }, [port, owner])
  return (message, options) => port.request(message, options, owner)
}

/**
 * The value of the latest committed render, for the code after an `await`:
 * a guard checked before the dialog is checked again on what holds now, not
 * on the closure of the click that opened it.
 */
export const useLatest = <Value>(value: Value): { readonly current: Value } => {
  const latest = useRef(value)
  useLayoutEffect(() => { latest.current = value })
  return latest
}

export interface ConfirmDialogModel {
  readonly request: ConfirmRequest | undefined
  readonly answer: (confirmed: boolean) => void
  /** Bound to the dialog's own `close` event, which Escape fires too. */
  readonly closed: () => void
}

/**
 * The focus goes back to the control that asked; one that is gone or disabled
 * cannot take it, so the page's `main` does instead of `document.body`.
 */
const restoreFocus = (opener: HTMLElement | null): void => {
  if (opener?.isConnected === true && !opener.matches(":disabled")) {
    opener.focus()
    return
  }
  const main = document.querySelector("main")
  if (main === null) return
  if (!main.hasAttribute("tabindex")) main.tabIndex = -1
  main.focus({ preventScroll: true })
}

/**
 * The native modal behind the controller: `showModal` gives the top layer, an
 * inert page and Escape, as in `use-help-dialog.ts`. The dialog is open while
 * a question is; a new address answers the open one „no”, so Back never lets
 * an operation start on the screen that was left.
 */
export const useConfirmDialog = (
  controller: ConfirmController,
): readonly [RefObject<HTMLDialogElement | null>, RefObject<HTMLButtonElement | null>, ConfirmDialogModel] => {
  const dialog = useRef<HTMLDialogElement>(null)
  const refuse = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const request = useSyncExternalStore(controller.subscribe, controller.current, controller.current)
  const pathname = useLocation({ select: (location) => location.pathname })
  useEffect(() => () => { controller.cancel() }, [controller, pathname])
  useEffect(() => {
    const element = dialog.current
    if (element === null) return
    if (request === undefined) {
      if (element.open) element.close()
      return
    }
    if (element.open) return
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal()
    refuse.current?.focus()
  }, [request])
  return [dialog, refuse, {
    request,
    answer: controller.settle,
    closed: () => {
      // A late `close` of an answered question, after the dialog reopened for the next one.
      if (dialog.current?.open === true) return
      controller.settle(false)
      restoreFocus(opener.current)
    },
  }]
}
