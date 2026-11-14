/** The focus mark of every control and button: an outline set off the edge, a primary ring in the gap. */
export const FOCUS_RING = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-invoice-focus"
  + " focus-visible:ring-2 focus-visible:ring-invoice-primary"

/** A text input, select or textarea; each adds its own height. */
export const CONTROL = "w-full px-3 py-[.65rem] border border-invoice-control-border rounded-invoice-control"
  + " text-invoice-ink bg-invoice-surface hover:border-invoice-control-border-hover " + FOCUS_RING
