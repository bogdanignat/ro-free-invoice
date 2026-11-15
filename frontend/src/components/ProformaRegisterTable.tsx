import { AppLink } from "./ui/AppLink.tsx"
import { Badge } from "./ui/Badge.tsx"
import { Table, Td, Th } from "./ui/Table.tsx"
import type { ProformaRegisterRow } from "../lib/proforma-projection.ts"

/**
 * Every cell carries `data-label`, as the invoice register's does, so the narrow
 * layout can stack the row without a second markup path. The tone comes from the
 * projection: the list and the document must not describe the same proforma
 * differently.
 */
export const ProformaRegisterTable = ({ rows }: { readonly rows: ReadonlyArray<ProformaRegisterRow> }) =>
  <Table>
    <caption className="sr-only">Registru de proforme</caption>
    <thead>
      <tr><Th>Număr</Th><Th>Client</Th><Th>Emisă</Th><Th>Scadență</Th><Th>Total</Th><Th>Status</Th></tr>
    </thead>
    <tbody>
      {rows.map((row) => <tr key={row.key}>
        <Td label="Număr"><AppLink href={row.documentHref}><strong>{row.number}</strong></AppLink></Td>
        <Td label="Client">{row.customerName}</Td>
        <Td label="Emisă">{row.issueDate}</Td>
        <Td label="Scadență">{row.dueDate}</Td>
        <Td label="Total" numeric>{row.total}</Td>
        <Td label="Status"><Badge tone={row.status.tone}>{row.status.label}</Badge></Td>
      </tr>)}
    </tbody>
  </Table>
