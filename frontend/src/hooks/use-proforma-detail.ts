import { useQuery } from "@tanstack/react-query"

import { useAuth } from "./auth-context.ts"
import { proformaQueryKey } from "./proforma-query-keys.ts"
import { documentRead, type DocumentDetailModel } from "./use-document-detail.ts"
import { useDocumentDownload } from "./use-document-download.ts"
import { useInvoicingClients } from "./use-invoicing-clients.ts"
import { useProformaConversion, type ProformaConversionModel } from "./use-proforma-conversion.ts"
import { useReferenceData } from "./use-reference-data.ts"
import { documentFilename } from "../lib/browser-download.ts"
import { projectProforma } from "../lib/proforma-projection.ts"
import { requireCsrf } from "../lib/require-csrf.ts"

export interface ProformaDetailModel {
  /** The document itself, in the shape every document screen renders. */
  readonly detail: DocumentDetailModel
  readonly conversion: ProformaConversionModel
}

/**
 * A proforma, with the one download it has and the conversion it may still
 * allow.
 *
 * Only the PDF is offered: a proforma is not a fiscal document, so the backend
 * renders no e-Factura XML for one and a button for it would 404. The PDF is a
 * render-then-fetch, which is why it needs the CSRF token the plain reads do
 * not.
 */
export const useProformaDetail = (id: string): ProformaDetailModel => {
  const { status } = useAuth()
  const clients = useInvoicingClients()
  const query = useQuery({
    queryKey: proformaQueryKey(id),
    enabled: status === "authenticated",
    queryFn: ({ signal }) => clients.proformas.getProforma(id, signal),
  })
  const reference = useReferenceData()
  const proforma = query.data
  const pdf = useDocumentDownload({
    key: "pdf",
    label: "Descarcă PDF",
    pendingLabel: "Se generează…",
    request: (csrfToken) => clients.proformas.downloadProformaPdf(id, requireCsrf(csrfToken)),
    filename: proforma === undefined ? undefined : documentFilename("proforma", proforma, "pdf"),
  })
  const conversion = useProformaConversion(proforma)
  return {
    detail: {
      ...documentRead(query, projectProforma, reference),
      downloads: [pdf],
      reference: proforma,
    },
    conversion,
  }
}
