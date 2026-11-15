import type { ReactNode } from "react"

/** One topic of the field guide: a small-caps title over its terms, and an optional closing note. */
export const HelpSection = ({ title, note, children }: {
  readonly title: string
  readonly note?: ReactNode
  readonly children: ReactNode
}) => <section>
  <h3 className="mb-2 text-invoice-muted text-[.84rem] font-extrabold tracking-invoice-caps uppercase">{title}</h3>
  <dl className="grid gap-[.8rem] m-0">{children}</dl>
  {note === undefined ? null : <p className="mt-[.9rem] text-invoice-muted text-[.8rem] leading-[1.55]">{note}</p>}
</section>

/** A term and what it means; `highlight` marks the one rule the screen cannot enforce. */
export const HelpItem = ({ term, highlight = false, children }: {
  readonly term: string
  readonly highlight?: boolean
  readonly children: ReactNode
}) => <div className={highlight
  ? "px-[.9rem] py-[.7rem] border-l-3 border-l-invoice-primary-hover rounded-invoice-control bg-invoice-primary-soft"
  : undefined}>
  <dt className="text-invoice-label text-[.82rem] font-invoice-label">{term}</dt>
  <dd className="mt-[.2rem] text-invoice-muted text-[.86rem] leading-[1.55]">{children}</dd>
</div>
