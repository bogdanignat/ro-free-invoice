import type { ReactNode } from "react"

/**
 * A main column with a side column kept in view beside it. Under 900px it is one
 * `minmax(0, 1fr)` column, so a wide table scrolls in its own container instead
 * of stretching the page, and the side follows the main column.
 */
export const SplitLayout = ({ side, children }: {
  readonly side: ReactNode
  readonly children: ReactNode
}) => <div className="grid gap-6 grid-cols-[minmax(0,2.1fr)_minmax(15rem,1fr)] items-start stacked:grid-cols-1">
  {children}
  <div className="grid gap-6 sticky top-6 stacked:static">{side}</div>
</div>
