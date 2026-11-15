import type { ReactNode } from "react"

import { Eyebrow } from "./ui/Eyebrow.tsx"

interface PageProps {
  readonly title: string
  readonly eyebrow: string
  readonly actions?: ReactNode
  readonly children: ReactNode
}

export const Page = ({ title, eyebrow, actions, children }: PageProps) => <>
  <header className="flex flex-wrap gap-4 items-end justify-between mb-8 narrow:flex-col narrow:items-start">
    <div>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-[.15rem] mb-0 font-invoice-display text-[length:clamp(2rem,3vw,3rem)] font-medium tracking-[-.035em]">{title}</h1>
    </div>
    {actions === undefined ? null : <div className="flex flex-wrap gap-[.6rem]">{actions}</div>}
  </header>
  {children}
</>
