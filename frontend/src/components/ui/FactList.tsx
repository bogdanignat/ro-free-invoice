import type { ReactNode } from "react"

import { cx } from "./cx.ts"

export type FactListLayout = "facts" | "totals" | "payments"

const LISTS: Readonly<Record<FactListLayout, string>> = {
  facts: "flex flex-wrap gap-x-8 gap-y-[.6rem]",
  // Beside the facts on a wide screen, under them on a narrow one; the last figure is the one to read.
  totals: "flex flex-wrap gap-x-8 gap-y-[.6rem] justify-end narrow:justify-start",
  payments: "grid grid-cols-2 gap-x-8 gap-y-[.6rem] mb-4",
}

const VALUES: Readonly<Record<FactListLayout, string>> = {
  facts: "font-invoice-emphasis",
  totals: "font-invoice-emphasis",
  payments: "font-bold tabular-nums",
}

/** Labelled figures as a `dl`: a document's head facts, its totals, an invoice's payment balance. */
export const FactList = ({ layout, items }: {
  readonly layout: FactListLayout
  readonly items: ReadonlyArray<{ readonly label: string; readonly value: ReactNode }>
}) => <dl className={cx("m-0", LISTS[layout])}>
  {items.map((item, index) => <div key={item.label}>
    <dt className="text-invoice-muted text-invoice-caption font-extrabold tracking-invoice-caps uppercase">{item.label}</dt>
    <dd className={cx("m-0 mt-[.15rem]", VALUES[layout], layout === "totals" && index === items.length - 1 && "text-[1.15rem]")}>{item.value}</dd>
  </div>)}
</dl>
