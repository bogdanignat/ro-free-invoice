import { useQuery } from "@tanstack/react-query"

import { useAuth } from "./auth-context.ts"
import { referenceDataQuery } from "./reference-queries.ts"
import { useInvoicingClients } from "./use-invoicing-clients.ts"
import type { TextLimits } from "../lib/authoring-reference-decoders.ts"
import type { RomanianCounty } from "../lib/romanian-counties.ts"

/**
 * The server's county list and text limits. Every screen that shows a form
 * waits for it like it waits for the units, so the fields below read it from
 * the cache and the empty fallbacks never reach the user.
 */
export const useReferenceData = () => {
  const { status } = useAuth()
  const clients = useInvoicingClients()
  return useQuery(referenceDataQuery(clients.reference, status === "authenticated"))
}

export const NO_COUNTIES: ReadonlyArray<RomanianCounty> = []

export const useCounties = (): ReadonlyArray<RomanianCounty> => useReferenceData().data?.counties ?? NO_COUNTIES

export const useTextLimits = (): TextLimits | undefined => useReferenceData().data?.textLimits
