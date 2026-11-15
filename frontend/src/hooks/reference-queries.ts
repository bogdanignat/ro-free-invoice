import { queryOptions } from "@tanstack/react-query"

import type { AuthoringReferenceClient } from "../lib/authoring-reference-client.ts"

/**
 * The issuer profile and the document series, read by the settings screen, the
 * authoring screens, the proforma conversion and the dashboard's setup card.
 * One definition and one key each, so every screen shares the same cache entry
 * and a save invalidates what all of them read.
 */
export const referenceQueryKeys = {
  issuer: ["issuer"],
  documentSeries: ["document-series"],
  referenceData: ["reference-data"],
} as const

/** `null` while the issuer profile has never been saved (the reference client turns that `404` into a state). */
export const issuerQuery = (client: AuthoringReferenceClient, enabled: boolean) => queryOptions({
  queryKey: referenceQueryKeys.issuer,
  enabled,
  queryFn: ({ signal }) => client.getIssuer(signal),
})

export const documentSeriesQuery = (client: AuthoringReferenceClient, enabled: boolean) => queryOptions({
  queryKey: referenceQueryKeys.documentSeries,
  enabled,
  queryFn: ({ signal }) => client.listDocumentSeries(signal),
})

/** Fixed for the server's lifetime (cube constants), so it is read once per session. */
export const referenceDataQuery = (client: AuthoringReferenceClient, enabled: boolean) => queryOptions({
  queryKey: referenceQueryKeys.referenceData,
  enabled,
  staleTime: Infinity,
  queryFn: ({ signal }) => client.getReferenceData(signal),
})
