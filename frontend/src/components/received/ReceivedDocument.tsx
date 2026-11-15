import { StatusNote } from "../ui/StatusNote.tsx"
import { Card } from "../ui/Card.tsx"
import { DocumentHead, DocumentNotes, DocumentParties, DocumentTotals } from "../DocumentParts.tsx"
import { ReceivedLines, ReceivedVat } from "./ReceivedTables.tsx"
import type { ReceivedDocumentView } from "../../lib/received-detail-projection.ts"

/** A read received invoice: its head, the two parties, the lines, VAT by rate, the totals, the notes and the warnings. */
export const ReceivedDocument = ({ view }: { readonly view: ReceivedDocumentView }) => <Card as="article" className="grid gap-[1.6rem]">
  <DocumentHead heading={view.heading} facts={view.facts} />
  {view.warnings.length === 0
    ? null
    : <div className="grid gap-2">{view.warnings.map((warning) => <StatusNote key={warning} tone="warning">{warning}</StatusNote>)}</div>}
  <DocumentParties parties={view.parties} />
  <ReceivedLines lines={view.lines} />
  <ReceivedVat rows={view.vatRows} />
  <DocumentTotals totals={view.totals} />
  <DocumentNotes notes={view.notes} />
</Card>
