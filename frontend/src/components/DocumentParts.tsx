import type { ReactNode } from "react"

import { CardText } from "./ui/CardText.tsx"
import { FactList } from "./ui/FactList.tsx"

type Labelled = ReadonlyArray<{ readonly label: string; readonly value: string }>

// The legacy `.parties h3` / `.document-notes h3`.
const SMALL_TITLE = "m-0 mb-[.4rem] text-invoice-muted text-[.76rem] font-extrabold tracking-[.1em] uppercase"

/** The document's title and its head facts; the heading is the page's one `h2` of the document. */
export const DocumentHead = ({ heading, facts }: { readonly heading: string; readonly facts: Labelled }) => <header>
  <h2 className="block mb-[.8rem] font-invoice-display text-[1.6rem]">{heading}</h2>
  <FactList layout="facts" items={facts} />
</header>

/** The parties of a document side by side, as many as fit. */
export const DocumentParties = ({ parties }: {
  readonly parties: ReadonlyArray<{ readonly heading: string; readonly name: string; readonly details: ReadonlyArray<string> }>
}) => <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
  {parties.map((party) => <section key={party.heading}>
    <h3 className={SMALL_TITLE}>{party.heading}</h3>
    <CardText tone="strong">{party.name}</CardText>
    {/* The gap the legacy `.party-name` margin left under the name. */}
    <ul className="mt-[.35rem] text-invoice-muted text-[.84rem] leading-[1.55]">
      {party.details.map((detail, index) => <li key={`${String(index)}:${detail}`}>{detail}</li>)}
    </ul>
  </section>)}
</div>

export const DocumentTotals = ({ totals }: { readonly totals: Labelled }) => <FactList layout="totals" items={totals} />

export const DocumentNotes = ({ notes }: { readonly notes: ReadonlyArray<string> }): ReactNode => notes.length === 0
  ? null
  : <section>
    <h3 className={SMALL_TITLE}>Observații</h3>
    {notes.map((note, index) => <CardText key={`${String(index)}:${note}`}>{note}</CardText>)}
  </section>
