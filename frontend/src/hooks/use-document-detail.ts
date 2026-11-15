import { queryOptions, useQuery } from "@tanstack/react-query"

import { useAuth } from "./auth-context.ts"
import { useDocumentDownload, type DocumentDownloadAction } from "./use-document-download.ts"
import { useInvoicingClients, type InvoicingClients } from "./use-invoicing-clients.ts"
import { useReferenceData } from "./use-reference-data.ts"
import type { ReferenceData } from "../lib/authoring-reference-decoders.ts"
import { isTransientFailure } from "../lib/api-errors.ts"
import { documentFilename } from "../lib/browser-download.ts"
import { projectCorrectionDocument, projectIssuedInvoice, type DocumentSnapshotView } from "../lib/document-projection.ts"
import { requireCsrf } from "../lib/require-csrf.ts"
import type { RomanianCounty } from "../lib/romanian-counties.ts"

export interface DocumentDetailModel {
  readonly view: DocumentSnapshotView | undefined
  readonly isPending: boolean
  readonly error: unknown
  /** Present only when asking again could plausibly answer differently. */
  readonly retry: (() => void) | undefined
  readonly downloads: ReadonlyArray<DocumentDownloadAction>
  /** Series and number, once loaded: what a file of this document is named after. */
  readonly reference: { readonly series: string; readonly number: number } | undefined
}

/**
 * Whether to offer a retry, decided here rather than in the alert.
 *
 * The query client runs with `retry: false`, so nothing asks again on its own;
 * offering the button for a `404` would invite the reader to keep pressing it
 * at a document that does not exist, which is why the classification lives with
 * the model and the component only renders what it is handed.
 */
export const retryAction = (error: unknown, refetch: () => void): (() => void) | undefined =>
  isTransientFailure(error) ? refetch : undefined

/** What `documentRead` needs of a query: a `UseQueryResult` fits it. */
export interface QueryRead<Data> {
  readonly data: Data | undefined
  readonly isPending: boolean
  readonly error: unknown
  readonly refetch: () => unknown
}

/**
 * A document's read, shown once the county names are there too: an address
 * waits for them like a form does, instead of printing a bare code it could name.
 */
export const documentRead = <Document>(
  query: QueryRead<Document>,
  project: (document: Document, counties: ReadonlyArray<RomanianCounty>) => DocumentSnapshotView,
  reference: QueryRead<ReferenceData>,
): Pick<DocumentDetailModel, "view" | "isPending" | "error" | "retry"> => {
  const counties = reference.data?.counties
  const error = query.error ?? (counties === undefined ? reference.error : null)
  return {
    view: query.data === undefined || counties === undefined ? undefined : project(query.data, counties),
    isPending: query.isPending || (counties === undefined && reference.isPending),
    error,
    retry: retryAction(error, () => {
      if (query.data === undefined) void query.refetch()
      if (counties === undefined) void reference.refetch()
    }),
  }
}

/** One definition of the invoice read, shared by the detail and the payments panel that needs its currency. */
export const invoiceQueryOptions = (
  clients: Pick<InvoicingClients, "documents">, id: string, enabled: boolean,
) => queryOptions({
  queryKey: ["invoice", id],
  enabled,
  queryFn: ({ signal }) => clients.documents.getInvoice(id, signal),
})

/** One definition of the corrections read, shared by the storno section and the payments panel. */
export const correctionsQueryOptions = (
  clients: Pick<InvoicingClients, "documents">, invoiceId: string, enabled: boolean,
) => queryOptions({
  queryKey: ["invoice", invoiceId, "corrections"],
  enabled,
  queryFn: ({ signal }) => clients.documents.listCorrections(invoiceId, signal),
})

export const useInvoiceDetail = (id: string): DocumentDetailModel => {
  const { status } = useAuth()
  const clients = useInvoicingClients()
  const query = useQuery(invoiceQueryOptions(clients, id, status === "authenticated"))
  const reference = useReferenceData()
  const invoice = query.data
  const pdf = useDocumentDownload({
    key: "pdf",
    label: "Descarcă PDF",
    pendingLabel: "Se generează…",
    request: (csrfToken) => clients.documents.downloadInvoicePdf(id, requireCsrf(csrfToken)),
    filename: invoice === undefined ? undefined : documentFilename("factura", invoice, "pdf"),
  })
  return {
    ...documentRead(query, projectIssuedInvoice, reference),
    downloads: [pdf],
    reference: invoice,
  }
}

/**
 * A correction's PDF is a plain read: the backend renders the storno PDF on
 * request from the immutable correction, so unlike an invoice's there is no
 * render step and no CSRF token. Its e-Factura submission is `use-efactura-document.ts`.
 */
export const useCorrectionDetail = (id: string): DocumentDetailModel => {
  const { status } = useAuth()
  const clients = useInvoicingClients()
  const query = useQuery({
    queryKey: ["correction", id],
    enabled: status === "authenticated",
    queryFn: ({ signal }) => clients.documents.getCorrection(id, signal),
  })
  const reference = useReferenceData()
  const correction = query.data
  const pdf = useDocumentDownload({
    key: "pdf",
    label: "Descarcă PDF",
    pendingLabel: "Se generează…",
    request: () => clients.documents.downloadCorrectionPdf(id),
    filename: correction === undefined ? undefined : documentFilename("storno", correction, "pdf"),
  })
  return {
    ...documentRead(query, projectCorrectionDocument, reference),
    downloads: [pdf],
    reference: correction,
  }
}
