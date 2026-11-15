import type { ReactNode, RefObject } from "react"

/**
 * A section's `h2`, an optional sentence under it and, beside them, what the
 * section counts or offers (`aside`). On a narrow screen the aside goes under.
 * In a card the title and the sentence read as the legacy `.card h2` / `.card p`.
 */
export const SectionHeading = ({ eyebrow, title, id, titleRef, description, aside }: {
  /** The area the section belongs to, over the title. */
  readonly eyebrow?: ReactNode
  readonly title: ReactNode
  /** For the section's `aria-labelledby`. */
  readonly id?: string
  /** The heading a keyboard move lands on: it takes the ref and `tabIndex={-1}`. */
  readonly titleRef?: RefObject<HTMLHeadingElement | null>
  readonly description?: ReactNode
  readonly aside?: ReactNode
}) => <div className="flex gap-4 items-start justify-between mb-[1.15rem] narrow:flex-col narrow:items-start">
  <div>
    {/* The legacy `.section-heading p` set the eyebrow's margin and size, `.card p` its colour. */}
    {eyebrow === undefined
      ? null
      : <p className="mt-[.3rem] text-[.85rem] text-invoice-primary-hover font-extrabold tracking-[.14em] uppercase in-data-[card]:text-invoice-muted in-data-[card]:leading-[1.6]">{eyebrow}</p>}
    <h2 id={id} ref={titleRef} tabIndex={titleRef === undefined ? undefined : -1}
      className="block m-0 in-data-[card]:text-[1.1rem]">{title}</h2>
    {description === undefined
      ? null
      : <p className="mt-[.3rem] text-[.85rem] in-data-[card]:text-invoice-muted in-data-[card]:leading-[1.6]">{description}</p>}
  </div>
  {aside}
</div>
