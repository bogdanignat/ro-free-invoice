import type { SubmitEvent, ReactNode } from "react"
import { SplitLayout } from "../ui/SplitLayout.tsx"

/**
 * The authoring form's frame: the sections on the left, the totals and actions
 * on the right, kept in view while the sections scroll. Under 900px it is one
 * column and the right side follows the sections.
 */
export const AuthoringLayout = ({ side, onSubmit, children }: {
  readonly side: ReactNode
  readonly onSubmit: (event: SubmitEvent<HTMLFormElement>) => void
  readonly children: ReactNode
}) => <form onSubmit={onSubmit}>
  <SplitLayout side={side}>
    <div className="grid gap-6">{children}</div>
  </SplitLayout>
</form>
