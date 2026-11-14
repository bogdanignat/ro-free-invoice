import { Effect, type Schema } from "effect"

import { bucharestDay, spvDeadline, spvNeedsAction, spvState, spvUrgency } from "../../cubes/invoicing/efactura/submissions/index.ts"
import {
  spvFilterUnavailable, validationFailure, type ValidationFailure, type InvoiceRegisterFilter, type InvoiceRegisterRow, type IssuedInvoice, type IssuedInvoiceSummary, type Page,
} from "../../cubes/invoicing/index.ts"
import type { InvoiceRegisterPage } from "./schema-invoice-register.ts"
import type { IssuedInvoice as IssuedInvoiceResponse, IssuedInvoicePage } from "./schema-issuance.ts"

/**
 * What an invoice response says about e-Factura. With the plugin off there is
 * no XML and no transmission, so the status is `null` everywhere an invoice is
 * returned: register, list, detail, issuance and conversion. The field stays in
 * the response, the stored snapshot is not touched, and nothing fiscal reads
 * this projection.
 */
export interface EFacturaStatusView {
  readonly invoice: (invoice: IssuedInvoice) => Schema.Schema.Type<typeof IssuedInvoiceResponse>
  readonly invoices: (page: Page<IssuedInvoiceSummary>) => Schema.Schema.Type<typeof IssuedInvoicePage>
  readonly register: (page: Page<InvoiceRegisterRow>) => Schema.Schema.Type<typeof InvoiceRegisterPage>
  /** With the plugin off the register hides the status, so a filter on it is refused rather than leaking it. */
  readonly spvFilter: (spv: InvoiceRegisterFilter["spv"]) => Effect.Effect<InvoiceRegisterFilter["spv"], ValidationFailure>
}

const registerSpv = (row: InvoiceRegisterRow, today: string) => {
  const deadline = spvDeadline(row.issueDate, row.kind === "invoice" ? row.supplyDate : undefined)
  return { state: spvState(row.eFacturaStatus), deadline, urgency: spvNeedsAction(row.eFacturaStatus) ? spvUrgency(deadline, today) : null }
}

/** `now` is the register's "today" (Europe/Bucharest) for the urgency of each deadline. */
export const eFacturaStatusView = (active: boolean, now: () => Date = () => new Date()): EFacturaStatusView => active
  ? {
    invoice: (invoice) => invoice, invoices: (page) => page,
    register: (page) => {
      const today = bucharestDay(now())
      return { ...page, items: page.items.map((row) => ({ ...row, spv: registerSpv(row, today) })) }
    },
    spvFilter: Effect.succeed,
  }
  : {
    invoice: (invoice) => ({ ...invoice, eFacturaStatus: null }),
    invoices: (page) => ({ ...page, items: page.items.map((invoice) => ({ ...invoice, eFacturaStatus: null })) }),
    register: (page) => ({ ...page, items: page.items.map((row) => ({ ...row, eFacturaStatus: null, spv: null })) }),
    spvFilter: (spv) => spv === undefined
      ? Effect.succeed(undefined)
      : Effect.fail(validationFailure([spvFilterUnavailable()])),
  }
