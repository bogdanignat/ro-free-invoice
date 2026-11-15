import { AppLink } from "../ui/AppLink.tsx"
import { Badge } from "../ui/Badge.tsx"
import { Table, Td, Th } from "../ui/Table.tsx"
import type { ReceivedRow } from "../../lib/received-projection.ts"

/**
 * The received invoices, newest first in the SPV. Every cell carries
 * `data-label` so the narrow layout stacks the row into a card.
 */
export const ReceivedTable = ({ rows }: { readonly rows: ReadonlyArray<ReceivedRow> }) =>
  <Table>
    <caption className="sr-only">Facturi primite din SPV</caption>
    <thead>
      <tr>
        <Th>Număr</Th><Th>Furnizor</Th><Th>CIF</Th><Th>Data</Th><Th>Scadență</Th>
        <Th>Total</Th><Th>TVA</Th><Th>Monedă</Th><Th>Citire</Th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => <tr key={row.key}>
        <Td label="Număr">
          <AppLink href={row.href} aria-label={row.linkName}><strong>{row.label}</strong></AppLink>
          {row.kindLabel === null ? null : <Badge tone="storno">{row.kindLabel}</Badge>}
        </Td>
        <Td label="Furnizor">{row.supplierName}</Td>
        <Td label="CIF">{row.supplierCif}</Td>
        <Td label="Data">{row.issueDate}</Td>
        <Td label="Scadență">{row.dueDate}</Td>
        <Td label="Total" numeric>{row.total}</Td>
        <Td label="TVA" numeric>{row.vat}</Td>
        <Td label="Monedă">{row.currency}</Td>
        <Td label="Citire">
          <Badge tone={row.readable ? "positive" : "danger"}>{row.readLabel}</Badge>
          {row.notes.map((note) => <small key={note} className="block">{note}</small>)}
        </Td>
      </tr>)}
    </tbody>
  </Table>
