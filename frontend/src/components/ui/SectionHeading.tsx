import type { ReactNode } from "react"

/**
 * A section's `h2`, an optional sentence under it and, beside them, what the
 * section counts or offers (`aside`). On a narrow screen the aside goes under.
 */
export const SectionHeading = ({ title, id, description, aside }: {
  readonly title: ReactNode
  /** For the section's `aria-labelledby`. */
  readonly id?: string
  readonly description?: ReactNode
  readonly aside?: ReactNode
}) => <div className="flex gap-4 items-start justify-between mb-[1.15rem] narrow:flex-col narrow:items-start">
  <div>
    <h2 id={id} className="block m-0">{title}</h2>
    {description === undefined ? null : <p className="mt-[.3rem] text-[.85rem]">{description}</p>}
  </div>
  {aside}
</div>
