import { AppLink } from "../ui/AppLink.tsx"
import { Badge } from "../ui/Badge.tsx"
import { Table, Td, Th } from "../ui/Table.tsx"
import type { CollectionRow } from "../../lib/dashboard-situation.ts"

/** The listed invoices with today's status and balance; `label` stacks each row on a narrow screen. */
export const CollectionsTable = ({ rows }: { readonly rows: ReadonlyArray<CollectionRow> }) =>
  <Table>
    <caption className="sr-only">Facturile emise în perioadă, după scadență</caption>
    <thead>
      <tr>
        <Th scope="col">Număr</Th><Th scope="col">Client</Th><Th scope="col">Emisă</Th><Th scope="col">Scadență</Th>
        <Th scope="col" numeric>Total</Th><Th scope="col" numeric>Încasat</Th><Th scope="col" numeric>Stornat</Th>
        <Th scope="col" numeric>Sold</Th><Th scope="col">Status</Th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => <tr key={row.id}>
        <Td label="Număr"><AppLink href={row.href}><strong>{row.number}</strong></AppLink></Td>
        <Td label="Client">{row.customerName}</Td>
        <Td label="Emisă">{row.issueDate}</Td>
        <Td label="Scadență">{row.dueDate}</Td>
        <Td label="Total" numeric>{row.total}</Td>
        <Td label="Încasat" numeric>{row.paid}</Td>
        <Td label="Stornat" numeric>{row.credited}</Td>
        <Td label="Sold" numeric>{row.remaining}</Td>
        <Td label="Status"><Badge tone={row.statusTone}>{row.statusLabel}</Badge></Td>
      </tr>)}
    </tbody>
  </Table>
