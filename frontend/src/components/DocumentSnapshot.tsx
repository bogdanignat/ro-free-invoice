import { DocumentHead, DocumentNotes, DocumentParties, DocumentTotals } from "./DocumentParts.tsx"
import { AppLink } from "./ui/AppLink.tsx"
import { Card } from "./ui/Card.tsx"
import { CardText } from "./ui/CardText.tsx"
import { Table, Td, Th } from "./ui/Table.tsx"
import type { DocumentSnapshotView } from "../lib/document-projection.ts"

export const DocumentSnapshot = ({ view }: { readonly view: DocumentSnapshotView }) => <Card as="article" className="grid gap-[1.6rem]">
  <DocumentHead heading={view.heading} facts={view.facts} />
  {view.originalInvoice === null
    ? null
    : <CardText size="small"><AppLink href={view.originalInvoice.href}>{view.originalInvoice.label}</AppLink></CardText>}
  <DocumentParties parties={view.parties} />
  <Table>
    <caption className="sr-only">Linii document</caption>
    <thead>
      <tr><Th>Descriere</Th><Th>Cantitate</Th><Th>Preț unitar</Th><Th>Cotă TVA</Th><Th>Fără TVA</Th><Th>Valoare TVA</Th><Th>Cu TVA</Th></tr>
    </thead>
    <tbody>
      {view.lines.map((line) => <tr key={line.key}>
        <Td label="Descriere">
          {line.description}
          {line.identifiers === "" ? null : <small className="block text-xs text-invoice-muted">{line.identifiers}</small>}
        </Td>
        <Td label="Cantitate">{line.quantity}</Td>
        <Td label="Preț unitar" numeric>{line.unitPrice}</Td>
        <Td label="Cotă TVA">{line.vat}</Td>
        <Td label="Fără TVA" numeric>{line.totalExcludingVat}</Td>
        <Td label="Valoare TVA" numeric>{line.vatAmount}</Td>
        <Td label="Cu TVA" numeric>{line.totalIncludingVat}</Td>
      </tr>)}
    </tbody>
  </Table>
  <Table>
    <caption className="sr-only">Defalcare TVA</caption>
    <thead><tr><Th>Tratament TVA</Th><Th>Bază</Th><Th>Valoare TVA</Th><Th>Motiv scutire</Th></tr></thead>
    <tbody>
      {view.vatRows.map((row) => <tr key={row.key}>
        <Td label="Tratament TVA">{row.rate}</Td>
        <Td label="Bază" numeric>{row.base}</Td>
        <Td label="Valoare TVA" numeric>{row.amount}</Td>
        <Td label="Motiv scutire">{row.note}</Td>
      </tr>)}
    </tbody>
  </Table>
  <DocumentTotals totals={view.totals} />
  <DocumentNotes notes={view.notes === null ? [] : [view.notes]} />
</Card>
