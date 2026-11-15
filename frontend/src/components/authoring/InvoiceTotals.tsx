import { orDash } from "../../lib/format.ts"
import { money } from "../../lib/money.ts"
import { vatTreatmentLabel } from "../../lib/vat-snapshots.ts"
import type { TotalsPreview } from "../../lib/draft-totals-preview.ts"
import { AUTHORING_CURRENCY } from "../../lib/document-authoring-form-model.ts"
import type { TotalsCard, TotalsPreviewModel } from "../../hooks/use-totals-preview.ts"
import { Button } from "../ui/Button.tsx"
import { Card } from "../ui/Card.tsx"
import { CardTitle } from "../ui/CardTitle.tsx"
import { cx } from "../ui/cx.ts"
import { Hint } from "../ui/Hint.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"

const Row = ({ label, grand = false, children }: { readonly label: string; readonly grand?: boolean; readonly children: string }) =>
  <div className="flex justify-between gap-4">
    <dt className="text-invoice-muted text-[.8rem] font-invoice-emphasis">{label}</dt>
    <dd className={cx("m-0 font-bold tabular-nums", grand && "text-[1.1rem]")}>{children}</dd>
  </div>

const TotalsList = ({ totals, dueDate }: { readonly totals: TotalsPreview; readonly dueDate: string }) => <dl className="grid gap-[.55rem] m-0">
  <Row label="Total fără TVA">{money(totals.totalExcludingVat, AUTHORING_CURRENCY)}</Row>
  {totals.vatBreakdown.map((entry) => <Row key={`${entry.code}-${entry.vatBaseAmount}`} label={vatTreatmentLabel(entry)}>
    {money(entry.vatAmount, AUTHORING_CURRENCY)}
  </Row>)}
  <Row label="Total TVA">{money(totals.vatTotal, AUTHORING_CURRENCY)}</Row>
  <Row label="Total cu TVA" grand>{money(totals.totalIncludingVat, AUTHORING_CURRENCY)}</Row>
  <Row label="Scadență">{orDash(dueDate)}</Row>
</dl>

const CardBody = ({ card, dueDate, retry }: { readonly card: TotalsCard; readonly dueDate: string; readonly retry: () => void }) => {
  switch (card.kind) {
    case "empty": return <Hint>Totalurile apar când ai o linie cu cantitate, preț și cota TVA.</Hint>
    case "loading": return <Hint>Se calculează totalurile…</Hint>
    case "refused": return <StatusNote tone="warning" role={null}>{card.message}</StatusNote>
    case "unavailable": return <StatusNote tone="warning" role={null}>
      Totalurile nu au putut fi calculate acum.{" "}
      <Button variant="secondary" size="sm" onClick={retry}>Reîncearcă</Button>
    </StatusNote>
    case "totals": return <TotalsList totals={card.totals} dueDate={dueDate} />
  }
}

/**
 * The server's totals for the lines as typed, asked after each pause in the
 * editing. Nothing is computed here: a fiscal rounding rule lives on the
 * server only, and the card shows its answer, its refusal or its absence.
 */
export const InvoiceTotals = ({ preview, dueDate }: { readonly preview: TotalsPreviewModel; readonly dueDate: string }) =>
  <Card className={cx("grid gap-4", preview.busy && "opacity-60 transition-opacity")} aria-live="polite" aria-busy={preview.busy}>
    <CardTitle>Totaluri</CardTitle>
    <CardBody card={preview.card} dueDate={dueDate} retry={preview.retry} />
    {preview.excludedNote === null ? null : <Hint>{preview.excludedNote}</Hint>}
  </Card>
