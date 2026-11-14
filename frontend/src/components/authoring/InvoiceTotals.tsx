import { orDash } from "../../lib/format.ts"
import { money } from "../../lib/money.ts"
import { vatTreatmentLabel } from "../../lib/vat-snapshots.ts"
import type { TotalsPreview } from "../../lib/draft-totals-preview.ts"
import { AUTHORING_CURRENCY } from "../../lib/document-authoring-form-model.ts"
import type { TotalsCard, TotalsPreviewModel } from "../../hooks/use-totals-preview.ts"
import { Button } from "../Button.tsx"

const TotalsList = ({ totals, dueDate }: { readonly totals: TotalsPreview; readonly dueDate: string }) => <dl className="totals-list">
  <div><dt>Total fără TVA</dt><dd>{money(totals.totalExcludingVat, AUTHORING_CURRENCY)}</dd></div>
  {totals.vatBreakdown.map((entry) => <div key={`${entry.code}-${entry.vatBaseAmount}`}>
    <dt>{vatTreatmentLabel(entry)}</dt><dd>{money(entry.vatAmount, AUTHORING_CURRENCY)}</dd>
  </div>)}
  <div><dt>Total TVA</dt><dd>{money(totals.vatTotal, AUTHORING_CURRENCY)}</dd></div>
  <div className="grand-total"><dt>Total cu TVA</dt><dd>{money(totals.totalIncludingVat, AUTHORING_CURRENCY)}</dd></div>
  <div><dt>Scadență</dt><dd>{orDash(dueDate)}</dd></div>
</dl>

const CardBody = ({ card, dueDate, retry }: { readonly card: TotalsCard; readonly dueDate: string; readonly retry: () => void }) => {
  switch (card.kind) {
    case "empty": return <p className="hint">Totalurile apar când ai o linie cu cantitate, preț și cota TVA.</p>
    case "loading": return <p className="hint">Se calculează totalurile…</p>
    case "refused": return <p className="status-note warning">{card.message}</p>
    case "unavailable": return <p className="status-note warning">
      Totalurile nu au putut fi calculate acum.{" "}
      <Button className="secondary small" onClick={retry}>Reîncearcă</Button>
    </p>
    case "totals": return <TotalsList totals={card.totals} dueDate={dueDate} />
  }
}

/**
 * The server's totals for the lines as typed, asked after each pause in the
 * editing. Nothing is computed here: a fiscal rounding rule lives on the
 * server only, and the card shows its answer, its refusal or its absence.
 */
export const InvoiceTotals = ({ preview, dueDate }: { readonly preview: TotalsPreviewModel; readonly dueDate: string }) =>
  <section className={`card authoring-section${preview.busy ? " opacity-60 transition-opacity" : ""}`} aria-live="polite" aria-busy={preview.busy}>
    <h2>Totaluri</h2>
    <CardBody card={preview.card} dueDate={dueDate} retry={preview.retry} />
    {preview.excludedNote === null ? null : <p className="hint">{preview.excludedNote}</p>}
  </section>
