const identity = "money"

export const cube = {
  manifest: {
    name: identity,
    parent: "invoicing",
    summary: "Decimal money arithmetic on bigint: parsing, formatting, half-up division and comparison",
    required: true,
    tables: [],
    requiresAuth: true,
    permissions: [],
  },
  create: () => ({ handlers: {} }),
}

export { compareDecimal, divideHalfUp, formatDecimal, isCanonicalDecimal, parseDecimal, parseUnsignedDecimal } from "./domain/money.ts"
export type { ParsedDecimal } from "./domain/money.ts"
