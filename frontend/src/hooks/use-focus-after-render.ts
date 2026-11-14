import { useEffect, useRef } from "react"

import { focusAndReveal } from "../lib/focus.ts"

/**
 * Focuses an element by id after the next render, for a control the same click
 * creates (a new line's description): it does not exist yet when the handler runs.
 */
export const useFocusAfterRender = (): ((id: string) => void) => {
  const pending = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (pending.current === undefined) return
    focusAndReveal(document.getElementById(pending.current))
    pending.current = undefined
  })
  return (id) => { pending.current = id }
}
