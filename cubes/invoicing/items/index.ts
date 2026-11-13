const identity = "items"

export const cube = {
  manifest: {
    name: identity,
    parent: "invoicing",
    summary: "Article code, GTIN (EAN) and unit-of-measure rules shared by the product nomenclature and every document line",
    required: true,
    tables: [],
    requiresAuth: true,
    permissions: [],
  },
  create: () => ({ handlers: {} }),
}

export { itemIdentifiers, normalizeItemCode, validateBarcode } from "./domain/item-identifiers.ts"
export { normalizeUnitOfMeasure, unitOfMeasures } from "./domain/unit-of-measures.ts"
export type { ItemIdentifiers } from "./domain/item-identifiers.ts"
export type { UnitOfMeasure } from "./domain/unit-of-measures.ts"
