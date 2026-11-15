import { Schema } from "effect"

import { E_FACTURA_STATUSES, maximumRegisterSearchLength } from "../../cubes/invoicing/index.ts"
import { SPV_STATES } from "../../cubes/invoicing/efactura/submissions/index.ts"
import {
  InputText, PageQuery, SourceQueryFields, allErrors, nullableString, optional, pageOf, requireCompleteSource,
} from "./schema-primitives.ts"

const SpvStatus = Schema.Struct({
  state: Schema.Literal(...SPV_STATES), deadline: Schema.String, urgency: Schema.NullOr(Schema.Literal("overdue", "imminent", "ok")),
}).annotations({
  description: "Operational SPV deadline (not the exact legal one: capped by the delivery date, weekends only, public holidays ignored); urgency is null once nothing is left to resolve (accepted, in progress).",
})
const common = {
  id: Schema.String, series: Schema.String, number: Schema.Int, issueDate: Schema.String,
  customer: Schema.Struct({ name: Schema.String }), currency: Schema.String, totalIncludingVat: Schema.String,
  spv: Schema.NullOr(SpvStatus),
}
export const EFacturaStatus = Schema.Literal(...E_FACTURA_STATUSES)
const InvoiceRegisterInvoice = Schema.Struct({
  kind: Schema.Literal("invoice"), ...common, dueDate: nullableString, eFacturaStatus: Schema.NullOr(EFacturaStatus),
})
const InvoiceRegisterCorrection = Schema.Struct({
  kind: Schema.Literal("correction"), ...common, dueDate: Schema.Null, eFacturaStatus: Schema.NullOr(EFacturaStatus),
  originalReference: Schema.Struct({ id: Schema.String, series: Schema.String, number: Schema.Int }),
})

export const InvoiceRegisterRow = Schema.Union(InvoiceRegisterInvoice, InvoiceRegisterCorrection).annotations({
  description: "kind discriminates invoice/correction. Correction totals retain their stored negative sign, dueDate is null, and originalReference is present; invoices omit originalReference. eFacturaStatus and spv (invoice and correction alike) are null when the e-Factura plugin is off.",
})
export const InvoiceRegisterPage = pageOf(InvoiceRegisterRow)

const issueDate = (description: string) =>
  optional(InputText.annotations({ description, jsonSchema: { type: "string", format: "date" } }))
const search = `${String(maximumRegisterSearchLength)} characters`

/**
 * The register's filters, as any client sends them. Every one is optional and
 * none changes the order or the cursor: a cursor pages inside the filter it was
 * issued for. The refusals (a valid date, from <= to, the length of q) are the
 * cube's (`registerFilterDetails`), so a non-HTTP caller is held to them too and
 * every client reads one message; `kind` stays a literal for the OpenAPI enum.
 */
export const InvoiceRegisterQuery = Schema.Struct({
  ...SourceQueryFields.fields, ...PageQuery.fields,
  from: issueDate("First issue date, YYYY-MM-DD, inclusive."),
  to: issueDate("Last issue date, YYYY-MM-DD, inclusive. Not before from."),
  kind: optional(Schema.Literal("invoice", "correction").annotations({
    description: "Only invoices or only corrections (storno); absent = both.",
    message: () => ({ message: "kind must be invoice or correction", override: true }),
  })),
  spv: optional(Schema.Literal("unresolved").annotations({
    description: "unresolved = only documents still to resolve in SPV: not sent, rejected/refused or unknown.",
    message: () => ({ message: "spv must be unresolved", override: true }),
  })),
  q: optional(InputText.annotations({
    description: `Case-insensitive search in series + number (spaces ignored: "FCT 12", "FCT12", "12") or in the customer name. % and _ match themselves; blank = no search; at most ${search}.`,
  })),
}).annotations(allErrors).pipe(requireCompleteSource)
