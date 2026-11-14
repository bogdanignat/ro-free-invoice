import { useCustomerSearch, type RegistrySearch } from "./use-registry-search.ts"
import type { SavedBuyer } from "./invoice-authoring-session-types.ts"
import { identifierLabel } from "../lib/document-authoring-transitions.ts"
import type { BuyerSnapshot, Customer } from "../lib/draft-models.ts"
import type { InvoiceAuthoringForm } from "../lib/invoice-authoring-model.ts"

export const partyLabel = (party: Pick<BuyerSnapshot, "name" | "fiscalIdentifier" | "partyType">): string =>
  party.fiscalIdentifier === "" ? party.name : `${party.name} — ${identifierLabel(party.partyType)} ${party.fiscalIdentifier}`

/**
 * What the client field shows when the user is not typing: the customer last
 * picked or loaded, else the draft's own snapshot (its customer may be on no
 * loaded page and in no search result), else nothing.
 */
export const chosenCustomerLabel = (
  form: Pick<InvoiceAuthoringForm, "buyerMode" | "customerId">,
  known: ReadonlyArray<Customer>,
  savedBuyer: SavedBuyer | undefined,
): string => {
  const customer = known.find(({ id }) => id === form.customerId)
  if (customer !== undefined) return partyLabel(customer)
  return draftOwnBuyer(form, known, savedBuyer) ? `${partyLabel(savedBuyer.customer)} (clientul din acest draft)` : ""
}

const draftOwnBuyer = (
  form: Pick<InvoiceAuthoringForm, "buyerMode" | "customerId">,
  loaded: ReadonlyArray<Customer>,
  savedBuyer: SavedBuyer | undefined,
): savedBuyer is SavedBuyer => form.buyerMode === "saved" && savedBuyer !== undefined
  && form.customerId === savedBuyer.customerId && !loaded.some(({ id }) => id === form.customerId)

export interface CustomerPicker {
  readonly search: RegistrySearch<Customer>
  /** The input's text: what is typed while searching, the chosen customer otherwise. */
  readonly value: string
  /** Saved mode has something to offer: a loaded customer or the draft's own. */
  readonly usable: boolean
  readonly pick: (customer: Customer) => void
}

export const useCustomerPicker = (
  form: InvoiceAuthoringForm,
  customers: ReadonlyArray<Customer>,
  savedBuyer: SavedBuyer | undefined,
  /** The session's last pick: the one place it is held, so a remount keeps the label. */
  chosenCustomer: Customer | undefined,
  onChoose: (customer: Customer) => void,
): CustomerPicker => {
  const search = useCustomerSearch(customers)
  const known = chosenCustomer === undefined ? customers : [chosenCustomer, ...customers]
  return {
    search,
    value: search.text ?? chosenCustomerLabel(form, known, savedBuyer),
    usable: customers.length > 0 || draftOwnBuyer(form, customers, savedBuyer),
    pick: (customer) => { search.restore(); onChoose(customer) },
  }
}
