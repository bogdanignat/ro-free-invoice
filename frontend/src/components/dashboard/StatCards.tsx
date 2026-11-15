import type { StatCard } from "../../lib/dashboard-view.ts"

/** A row of figures; each card is a term and its value, so a screen reader reads them as pairs. */
export const StatCards = ({ cards, label }: { readonly cards: ReadonlyArray<StatCard>; readonly label: string }) =>
  // Narrow enough that five cards share one desktop row; on a phone two columns, an odd last card takes the whole row.
  <dl className="grid gap-[.9rem] grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] m-0 mb-5 narrow:grid-cols-2 narrow:gap-[.6rem]"
    aria-label={label}>
    {cards.map((card) => <div key={card.key}
      className="grid gap-[.3rem] content-start px-[1.1rem] py-4 border border-invoice-border rounded-invoice-container bg-invoice-secondary-surface narrow:p-[.8rem] narrow:last:odd:col-span-full">
      <dt className="text-invoice-muted text-invoice-caption font-extrabold tracking-invoice-caps uppercase">{card.label}</dt>
      <dd className="m-0 text-invoice-ink text-[1.3rem] font-invoice-label tabular-nums wrap-anywhere narrow:text-[1.05rem]">{card.value}</dd>
      {card.hint === undefined ? null : <dd className="m-0 text-invoice-muted text-[.78rem] leading-[1.45]">{card.hint}</dd>}
    </div>)}
  </dl>
