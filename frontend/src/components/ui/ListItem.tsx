import type { ReactNode } from "react"

import { cx } from "./cx.ts"

/**
 * One row of a list (a draft, a payment, a storno): what it says on the left, its
 * actions on the right. `muted` is a reversed entry; `small` lines read muted.
 */
export const ListItem = ({ muted = false, actions, children }: {
  readonly muted?: boolean
  readonly actions?: ReactNode
  readonly children: ReactNode
}) => <div className={cx("flex flex-wrap gap-x-4 gap-y-2 items-center justify-between py-[.8rem] border-b border-invoice-border last:border-b-0",
  muted && "text-invoice-muted")}>
  <div className="grid gap-[.15rem] [&_small]:text-invoice-muted">{children}</div>
  {actions === undefined ? null : <div className="flex gap-2 ml-auto">{actions}</div>}
</div>
