import type { ComponentPropsWithoutRef } from "react"

import { cx } from "./cx.ts"

// Narrow: each row becomes its own card and the column heading travels with the value (`Td`'s `label`).
const TABLE = "w-full border-collapse text-[.89rem]"
  + " narrow:[&_thead]:absolute narrow:[&_thead]:w-px narrow:[&_thead]:h-px narrow:[&_thead]:overflow-hidden"
  + " narrow:[&_thead]:[clip-path:inset(50%)]"
  + " narrow:[&_tr]:block narrow:[&_tr]:py-[.6rem] narrow:[&_tr]:border-b narrow:[&_tr]:border-invoice-border"

const CELL = "px-3 py-[.7rem] border-b border-invoice-border align-top"

const TH_ALIGN = { text: "text-left", numeric: "text-right tabular-nums" } as const
const TD_ALIGN = { text: "text-left", numeric: "text-right tabular-nums narrow:text-left" } as const

const LABEL = "narrow:grid narrow:gap-[.1rem] narrow:px-0 narrow:py-[.3rem] narrow:border-0"
  + " narrow:before:content-[attr(data-label)] narrow:before:text-invoice-muted narrow:before:text-invoice-caption"
  + " narrow:before:font-extrabold narrow:before:tracking-invoice-caps narrow:before:uppercase"

/** A table that scrolls sideways inside its own box instead of widening the page. */
export const Table = ({ className, ...props }: ComponentPropsWithoutRef<"table">) =>
  <div className="overflow-x-auto"><table {...props} className={cx(TABLE, className)} /></div>

type CellProps<Cell extends "th" | "td"> = ComponentPropsWithoutRef<Cell> & { readonly numeric?: boolean | undefined }

export const Th = ({ numeric = false, className, ...props }: CellProps<"th">) =>
  <th {...props} className={cx(CELL, numeric ? TH_ALIGN.numeric : TH_ALIGN.text,
    "text-invoice-label text-invoice-caption font-extrabold tracking-invoice-caps uppercase", className)} />

/** `label` is the column heading a narrow screen shows above the value. */
export const Td = ({ label, numeric = false, className, ...props }: CellProps<"td"> & { readonly label?: string | undefined }) =>
  <td {...props} data-label={label} className={cx(CELL, numeric ? TD_ALIGN.numeric : TD_ALIGN.text, LABEL, className)} />
