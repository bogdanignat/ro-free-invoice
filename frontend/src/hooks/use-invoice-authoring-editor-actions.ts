import { useState, type Dispatch, type SetStateAction } from "react"

import type { Customer, Issuer, ProductPreset, UnitOfMeasure, VatCatalogue } from "../lib/draft-models.ts"
import { newEditableInvoiceLine, preferredUnitOfMeasure } from "../lib/invoice-authoring-model.ts"
import type { BuyerMode, EditableInvoiceLine, InvoiceAuthoringForm, PartyType } from "../lib/invoice-authoring-model.ts"
import {
  editBuyerFiscalIdentifier, editDueDate, selectBuyerCounty, selectBuyerMode, selectBuyerSector,
  selectIssueDate, selectSavedCustomer, selectedSavedCustomer, switchPartyType,
} from "../lib/document-authoring-transitions.ts"
import { choosePresetForLine } from "../lib/document-authoring-options.ts"
import { defaultVatCode, presetVatCode } from "../lib/vat-defaults.ts"

export interface EditorActionsInput {
  readonly issuer: Issuer
  readonly vatCatalogue: VatCatalogue
  readonly unitOfMeasures: ReadonlyArray<UnitOfMeasure>
  /** The unfiltered pages loaded for the screen; a customer found by search may be on none of them. */
  readonly customers: ReadonlyArray<Customer>
  /** The customer last chosen in the picker, so a later due-date proposal still knows its payment term. */
  readonly chosenCustomer: Customer | undefined
  readonly rememberCustomer: (customer: Customer) => void
  /** The date new lines take their VAT on: an invoice's supply date (`effectiveSupplyDate`), a proforma's issue date. */
  readonly vatDate: string
  /** A draft saved with a due date owns it; anything else still derives it from the payment terms. */
  readonly deriveDueDate: boolean
  readonly setForm: Dispatch<SetStateAction<InvoiceAuthoringForm>>
  readonly setLines: Dispatch<SetStateAction<ReadonlyArray<EditableInvoiceLine>>>
}

/**
 * Every form and line edit the authoring screen offers, as pure state
 * transitions over the two states the session holds. Nothing here talks to the
 * network; saving and issuing are the draft and issuance controllers' work.
 */
export const createInvoiceAuthoringEditorActions = (input: EditorActionsInput) => {
  const knownCustomers = input.chosenCustomer === undefined ? input.customers : [input.chosenCustomer, ...input.customers]
  return {
    changeForm: (patch: Partial<InvoiceAuthoringForm>): void => {
      input.setForm((current) => ({ ...current, ...patch }))
    },
    chooseBuyerMode: (buyerMode: BuyerMode): void => {
      input.setForm((current) => selectBuyerMode(current, buyerMode, knownCustomers, input.issuer, input.deriveDueDate))
    },
    chooseCustomer: (customer: Customer): void => {
      input.rememberCustomer(customer)
      input.setForm((current) => selectSavedCustomer(current, customer.id, customer, input.issuer, input.deriveDueDate))
    },
    chooseIssueDate: (issueDate: string): void => {
      input.setForm((current) => selectIssueDate(
        current, issueDate, selectedSavedCustomer(current, knownCustomers), input.issuer, input.deriveDueDate,
      ))
    },
    chooseDueDate: (dueDate: string): void => {
      input.setForm((current) => editDueDate(current, dueDate))
    },
    choosePartyType: (partyType: PartyType): void => {
      input.setForm((current) => switchPartyType(current, partyType))
    },
    chooseCounty: (county: string): void => {
      input.setForm((current) => selectBuyerCounty(current, county))
    },
    changeFiscalIdentifier: (value: string): void => {
      input.setForm((current) => editBuyerFiscalIdentifier(current, value))
    },
    chooseSector: (sector: string): void => {
      input.setForm((current) => selectBuyerSector(current, sector))
    },
    /** Returns the new line's key, so the screen can move the focus to it. */
    addLine: (): string => {
      const key = crypto.randomUUID()
      input.setLines((current) => [...current, newEditableInvoiceLine(
        key,
        defaultVatCode(input.vatCatalogue, input.issuer, input.vatDate),
        preferredUnitOfMeasure(input.unitOfMeasures),
      )])
      return key
    },
    changeLine: (key: string, patch: Partial<EditableInvoiceLine>): void => {
      input.setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
    },
    choosePreset: (lineKey: string, preset: ProductPreset): void => {
      input.setLines((current) => choosePresetForLine(
        current, lineKey, preset,
        presetVatCode(preset.preferredVatRateCode, input.vatCatalogue, input.issuer, input.vatDate),
      ))
    },
  }
}

/** The actions and the picker's last chosen customer, held here once for the actions and the client field. */
export const useInvoiceAuthoringEditorActions = (input: Omit<EditorActionsInput, "chosenCustomer" | "rememberCustomer">) => {
  const [chosenCustomer, setChosenCustomer] = useState<Customer | undefined>(undefined)
  return {
    chosenCustomer,
    actions: createInvoiceAuthoringEditorActions({ ...input, chosenCustomer, rememberCustomer: setChosenCustomer }),
  }
}
