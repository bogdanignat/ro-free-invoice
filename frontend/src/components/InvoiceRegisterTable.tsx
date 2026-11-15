import { AppLink } from "./ui/AppLink.tsx"
import { Badge } from "./ui/Badge.tsx"
import { Table, Td, Th } from "./ui/Table.tsx"
import type { InvoiceRegisterPresentationRow } from "../lib/invoice-register-projection.ts"
import type { SpvUrgency } from "../lib/spv-status.ts"

const DEADLINE_CLASS: Readonly<Record<SpvUrgency, string>> = {
  ok: "text-invoice-muted",
  imminent: "font-bold text-invoice-danger-text",
  overdue: "font-bold text-invoice-danger-text",
}

interface InvoiceRegisterTableProps {
  readonly rows: ReadonlyArray<InvoiceRegisterPresentationRow>
  /** Whether the e-Factura plugin is on; decided by `useInvoiceRegister`. */
  readonly eFactura: boolean
}

/**
 * Every cell carries `data-label` so the narrow layout can turn the row into a
 * stacked card without a second markup path.
 */
export const InvoiceRegisterTable = ({ rows, eFactura }: InvoiceRegisterTableProps) =>
  <Table>
    <caption className="sr-only">Registru de facturi și storno</caption>
    <thead>
      <tr><Th>Număr</Th><Th>Client</Th><Th>Emisă</Th><Th>Scadență</Th><Th>Total</Th>{eFactura ? <Th>e-Factura</Th> : null}</tr>
    </thead>
    <tbody>
      {rows.map((row) => <tr key={row.key}>
        <Td label="Număr">
          <AppLink href={row.documentHref}><strong>{row.number}</strong></AppLink>
          {row.kindLabel === null ? null : <Badge tone="storno">{row.kindLabel}</Badge>}
          {row.originalInvoice === null
            ? null
            : <small><AppLink href={row.originalInvoice.href}>{row.originalInvoice.label}</AppLink></small>}
        </Td>
        <Td label="Client">{row.customerName}</Td>
        <Td label="Emisă">{row.issueDate}</Td>
        <Td label="Scadență">{row.dueDate}</Td>
        <Td label="Total" numeric>{row.total}</Td>
        {eFactura ? <Td label="e-Factura">
          <Badge tone={row.statusTone}>{row.status}</Badge>
          {row.deadline === null ? null : <small className={DEADLINE_CLASS[row.deadline.urgency]}>{row.deadline.text}</small>}
        </Td> : null}
      </tr>)}
    </tbody>
  </Table>
