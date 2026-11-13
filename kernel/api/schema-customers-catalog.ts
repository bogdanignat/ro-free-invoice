import { Schema } from "effect"

import { maximumSearchLength } from "../../cubes/invoicing/index.ts"
import {
  allErrors, bodyObject, Buyer, BuyerInput, InputText, optional, optionalInput, optionalString, PageQuery, pageOf, UnitOfMeasure,
  UnitOfMeasureInput,
} from "./schema-primitives.ts"

// The text limit is the cube's (`searchTextDetails`), so every client reads one message.
export const SearchPageQuery = Schema.Struct({
  ...PageQuery.fields,
  q: optional(InputText.annotations({
    description: `Case-insensitive search; % and _ match themselves; blank = no search; at most ${String(maximumSearchLength)} characters.`,
  })),
}).annotations(allErrors)

export const CustomerInput = Schema.Struct({
  ...BuyerInput.fields, defaultPaymentTermDays: optional(Schema.Int),
}).annotations(bodyObject)
export const Customer = Schema.Struct({
  id: Schema.String, organizationId: Schema.String, ...Buyer.fields,
  defaultPaymentTermDays: optional(Schema.Int), deletedAt: optionalString,
})
export const CustomerPage = pageOf(Customer)
// The article code is printable ASCII, unique in the organization whatever its case; the barcode is a GTIN kept as text.
const ProductIdentity = { code: Schema.String, kind: Schema.Literal("goods", "service"), barcode: optionalString }
export const ProductPresetInput = Schema.Struct({
  ...ProductIdentity, code: InputText, barcode: optionalInput, description: InputText, unitPrice: InputText,
  unitOfMeasure: UnitOfMeasureInput, preferredVatRateCode: optionalInput,
}).annotations(bodyObject)
export const ProductPreset = Schema.Struct({
  id: Schema.String, organizationId: Schema.String, ...ProductIdentity, description: Schema.String,
  unitPrice: Schema.String, unitOfMeasure: UnitOfMeasure, preferredVatRateCode: optionalString,
})
export const ProductPresetPage = pageOf(ProductPreset)
