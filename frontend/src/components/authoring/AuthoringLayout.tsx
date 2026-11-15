import type { SubmitEvent, ReactNode } from "react"

/**
 * The authoring form's frame: the sections on the left, the totals and actions
 * on the right, kept in view while the sections scroll. Under 900px it is one
 * column and the right side follows the sections.
 */
export const AuthoringLayout = ({ side, onSubmit, children }: {
  readonly side: ReactNode
  readonly onSubmit: (event: SubmitEvent<HTMLFormElement>) => void
  readonly children: ReactNode
}) => <form className="grid gap-6 grid-cols-[minmax(0,2.1fr)_minmax(15rem,1fr)] items-start stacked:grid-cols-[1fr]" onSubmit={onSubmit}>
  <div className="grid gap-6">{children}</div>
  <div className="grid gap-6 sticky top-6 stacked:static">{side}</div>
</form>
