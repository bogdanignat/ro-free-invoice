import { Badge } from "../ui/Badge.tsx"
import { Button } from "../ui/Button.tsx"
import { EmptyState } from "../AsyncState.tsx"
import { Table, Td, Th } from "../ui/Table.tsx"
import { DOCUMENT_TYPE_LABELS } from "../../lib/document-series-form.ts"
import {
  archiveActionLabel, archiveActionText, seriesKey, seriesStateLabel,
} from "../../lib/document-series-archive.ts"
import type { DocumentSeries } from "../../lib/draft-models.ts"

/**
 * The series already configured, each with its state and the one action it
 * allows: archive or reactivate. A series is never renamed or removed, since
 * that would break the numbering it guarantees. The button stays enabled while
 * a toggle is in flight (the hook ignores the click), so the focus is kept.
 */
export const DocumentSeriesTable = ({ series, archiving, onToggleArchived }: {
  readonly series: ReadonlyArray<DocumentSeries>
  readonly archiving: string | undefined
  readonly onToggleArchived: (series: DocumentSeries) => void
}) =>
  series.length === 0
    ? <EmptyState>Nu există încă serii configurate. Adaugă cel puțin o serie de factură pentru a putea crea drafturi.</EmptyState>
    : <Table>
      <caption className="sr-only">Seriile de documente configurate</caption>
      <thead><tr>
        <Th scope="col">Tip document</Th><Th scope="col">Serie</Th><Th scope="col">Stare</Th><Th scope="col">Acțiune</Th>
      </tr></thead>
      <tbody>
        {series.map((item) => {
          const busy = archiving === seriesKey(item)
          return <tr key={seriesKey(item)}>
            <Td label="Tip document">{DOCUMENT_TYPE_LABELS[item.documentType]}</Td>
            <Td label="Serie"><strong>{item.series}</strong></Td>
            <Td label="Stare">
              <Badge tone={item.archived ? "muted" : "positive"}>{seriesStateLabel(item)}</Badge>
            </Td>
            <Td label="Acțiune">
              <Button variant="secondary" size="sm" aria-label={archiveActionLabel(item, busy)} aria-busy={busy}
                onClick={() => { onToggleArchived(item) }}>
                {busy ? "Se salvează…" : archiveActionText(item)}
              </Button>
            </Td>
          </tr>
        })}
      </tbody>
    </Table>
