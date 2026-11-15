import { Button } from "../ui/Button.tsx"
import { Card } from "../ui/Card.tsx"
import { Count } from "../ui/Count.tsx"
import { EmptyState } from "../AsyncState.tsx"
import { LoadMore } from "../LoadMore.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import { Table, Td, Th } from "../ui/Table.tsx"
import { identifierLabel } from "../../lib/document-authoring-transitions.ts"
import { orDash } from "../../lib/format.ts"
import type { Customer } from "../../lib/draft-models.ts"

interface CustomersRegistrySectionProps {
  readonly customers: ReadonlyArray<Customer>
  readonly editingId: string | undefined
  readonly disabled: boolean
  readonly hasMore: boolean
  readonly loadingMore: boolean
  readonly onLoadMore: () => void
  readonly onEdit: (customer: Customer) => void
  readonly onDelete: (customer: Customer) => void
}

const addressLine = (customer: Customer): string => {
  const { address } = customer
  const sector = address.sector === undefined ? "" : `, sector ${String(address.sector)}`
  return `${address.street}, ${address.city}${sector}`
}

/** The saved parties, as they are reused on a document. */
export const CustomersRegistrySection = (props: CustomersRegistrySectionProps) =>
  <Card>
    <SectionHeading title="Clienți salvați"
      description="Documentele deja emise păstrează copia proprie a cumpărătorului: o modificare aici nu le schimbă."
      aside={<Count>{props.customers.length}</Count>} />
    {props.customers.length === 0
      ? <EmptyState>Nu există încă clienți salvați.</EmptyState>
      : <Table>
        <thead><tr>
          <Th scope="col">Client</Th><Th scope="col">Identificator fiscal</Th>
          <Th scope="col">Adresă</Th><Th scope="col" numeric>Termen</Th>
          <Th scope="col"><span className="sr-only">Acțiuni</span></Th>
        </tr></thead>
        <tbody>
          {props.customers.map((customer) => <tr key={customer.id}>
            <Td label="Client">
              <span className="mb-[.35rem] text-invoice-ink font-bold">{customer.name}</span>
              <small>{customer.partyType === "company" ? "Persoană juridică" : "Persoană fizică"}{customer.vatRegistered ? " · plătitor de TVA" : ""}</small>
            </Td>
            <Td label="Identificator fiscal">{orDash(customer.fiscalIdentifier)}<small>{identifierLabel(customer.partyType)}</small></Td>
            <Td label="Adresă">{addressLine(customer)}<small>{customer.address.county}{customer.address.postalCode === undefined ? "" : ` · ${customer.address.postalCode}`}</small></Td>
            <Td label="Termen" numeric>{customer.defaultPaymentTermDays === undefined ? "—" : `${String(customer.defaultPaymentTermDays)} zile`}</Td>
            <Td><div className="flex gap-2 ml-auto">
              <Button variant="secondary" disabled={props.disabled}
                aria-current={props.editingId === customer.id ? "true" : undefined}
                onClick={() => { props.onEdit(customer) }}>
                Editează<span className="sr-only"> {customer.name}</span>
              </Button>
              <Button variant="danger" disabled={props.disabled} onClick={() => { props.onDelete(customer) }}>
                Șterge<span className="sr-only"> {customer.name}</span>
              </Button>
            </div></Td>
          </tr>)}
        </tbody>
      </Table>}
    <LoadMore visible={props.hasMore} pending={props.loadingMore} onClick={props.onLoadMore} />
  </Card>
