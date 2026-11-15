import { Table, Td, Th } from "../ui/Table.tsx"
import type { LineView, VatRowView } from "../../lib/received-detail-projection.ts"

/** The lines as the XML gives them: quantity and unit price at the precision it wrote. */
export const ReceivedLines = ({ lines }: { readonly lines: ReadonlyArray<LineView> }) => <Table>
  <caption className="sr-only">Linii factură primită</caption>
  <thead><tr><Th>Descriere</Th><Th>Cantitate</Th><Th>Preț unitar</Th><Th>TVA</Th><Th>Valoare fără TVA</Th></tr></thead>
  <tbody>
    {lines.map((line) => <tr key={line.key}>
      <Td label="Descriere">{line.description}</Td>
      <Td label="Cantitate" numeric>{line.quantity}</Td>
      <Td label="Preț unitar" numeric>{line.unitPrice}</Td>
      <Td label="TVA">{line.vat}</Td>
      <Td label="Valoare fără TVA" numeric>{line.net}</Td>
    </tr>)}
  </tbody>
</Table>

/** VAT by category and rate, as the document declares it. */
export const ReceivedVat = ({ rows }: { readonly rows: ReadonlyArray<VatRowView> }) => <Table>
  <caption className="sr-only">TVA pe cote</caption>
  <thead><tr><Th>Categorie și cotă</Th><Th>Bază</Th><Th>Valoare TVA</Th><Th>Motiv scutire</Th></tr></thead>
  <tbody>
    {rows.map((row) => <tr key={row.key}>
      <Td label="Categorie și cotă">{row.rate}</Td>
      <Td label="Bază" numeric>{row.base}</Td>
      <Td label="Valoare TVA" numeric>{row.amount}</Td>
      <Td label="Motiv scutire">{row.note}</Td>
    </tr>)}
  </tbody>
</Table>
