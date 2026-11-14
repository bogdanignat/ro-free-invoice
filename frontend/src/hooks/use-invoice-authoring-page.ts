import { useQuery } from "@tanstack/react-query"

import { useAuth } from "./auth-context.ts"
import { documentSeriesQuery, issuerQuery } from "./reference-queries.ts"
import { useInvoicingClients } from "./use-invoicing-clients.ts"
import { useReferenceData } from "./use-reference-data.ts"
import { useAuthoringPagedList } from "./use-authoring-paged-list.ts"
import type { InvoiceAuthoringPageState } from "./invoice-authoring-page-types.ts"
import type { BackgroundError } from "./invoice-authoring-session-types.ts"
import type { Customer, ProductPreset } from "../lib/draft-models.ts"
import { draftQueryKey } from "./use-drafts.ts"
import { authoringAccess } from "../lib/invoice-authoring-readiness.ts"
import { authoringSeriesOptions } from "../lib/document-authoring-options.ts"

/**
 * A rejection turned into something the screen can show. Query rejections are
 * `unknown`: an `Error` is kept as it is and a plain string becomes its own
 * message, while anything else gets a written message instead of the
 * `[object Object]` a bare `String(...)` would put in front of the user.
 */
const normalizedFailure = (cause: unknown): Error =>
  cause instanceof Error
    ? cause
    : new Error(typeof cause === "string" ? cause : "Încărcarea datelor a eșuat.")

/**
 * Everything an authoring screen needs before a form can be filled, with the
 * session asked once per concern and every missing prerequisite named as its
 * own state, shown before the form: the screen says what is missing and links
 * to Setări where the user can set it up, so nothing typed is lost on the way.
 */
export const useInvoiceAuthoringPage = (id: string | undefined): InvoiceAuthoringPageState => {
  const { status } = useAuth()
  const clients = useInvoicingClients()
  const enabled = status === "authenticated"
  const issuer = useQuery(issuerQuery(clients.reference, enabled))
  const series = useQuery(documentSeriesQuery(clients.reference, enabled))
  const unitOfMeasures = useQuery({
    queryKey: ["unit-of-measures"],
    enabled,
    queryFn: ({ signal }) => clients.reference.listUnitOfMeasures(signal),
  })
  const reference = useReferenceData()
  const customers = useAuthoringPagedList<Customer>(["customers"], (page, signal) => clients.reference.listCustomers(page, signal))
  const presets = useAuthoringPagedList<ProductPreset>(["product-presets"], (page, signal) => clients.reference.listProductPresets(page, signal))
  // A reference list that fails is background, not blocking: the form stays
  // usable and each failure carries its own scoped retry, so a transient
  // gateway fault never costs the user their work on a reload-only path.
  const backgroundIssue = (error: unknown, retry: (() => void) | undefined): BackgroundError | undefined =>
    error === null || error === undefined
      ? undefined
      : { error: normalizedFailure(error), retry }
  const backgroundErrors = [
    backgroundIssue(customers.error, customers.retry),
    backgroundIssue(presets.error, presets.retry),
  ].filter((issue): issue is BackgroundError => issue !== undefined)
  const draft = useQuery({
    queryKey: draftQueryKey(id ?? "new"),
    enabled: enabled && id !== undefined,
    queryFn: ({ signal }) => (id === undefined
      ? Promise.reject(new Error("Lipsește identificatorul draftului."))
      : clients.drafts.getDraft(id, signal)),
  })

  if (id !== undefined && draft.data === undefined && draft.isPending) return { kind: "loading" }
  const loadedDraft = draft.data
  if (loadedDraft !== undefined) {
    const access = authoringAccess(loadedDraft.status)
    if (!access.editable) return {
      kind: "locked",
      title: `Draft ${loadedDraft.series}`,
      notice: access.notice,
      registryHref: access.registryHref,
      registryLabel: access.registryLabel,
    }
  }
  const issuerData = issuer.data
  const seriesData = series.data
  const unitsData = unitOfMeasures.data
  const referenceData = reference.data
  const requiredPending = (issuerData === undefined && issuer.isPending)
    || (seriesData === undefined && series.isPending)
    || (unitsData === undefined && unitOfMeasures.isPending)
    || (referenceData === undefined && reference.isPending)
    || (id === undefined && customers.items === undefined && customers.isPending)
  if (requiredPending) return { kind: "loading" }
  const blockingError = issuerData === undefined
    ? issuer.error
    : seriesData === undefined
      ? series.error
      : unitsData === undefined
        ? unitOfMeasures.error
        : referenceData === undefined
          ? reference.error
          : id !== undefined && draft.data === undefined
            ? draft.error
            : null
  if (blockingError !== null) {
    const retry = () => {
      if (issuerData === undefined) void issuer.refetch()
      if (seriesData === undefined) void series.refetch()
      if (unitsData === undefined) void unitOfMeasures.refetch()
      if (referenceData === undefined) void reference.refetch()
      if (id !== undefined && draft.data === undefined) void draft.refetch()
    }
    return { kind: "error", error: normalizedFailure(blockingError), retry }
  }
  if (issuerData == null) return { kind: "issuer-required" }
  const seriesOptions = authoringSeriesOptions(seriesData ?? [], "invoice")
  // A saved draft still opens when no series is active: it can be read, edited or deleted, only not issued.
  if (seriesOptions.length === 0 && id === undefined) return { kind: "invoice-series-required" }
  if ((unitsData ?? []).length === 0) return { kind: "unit-catalogue-empty" }
  if (id !== undefined && draft.data === undefined) return { kind: "draft-missing" }
  // Answered or failed above; a read still disabled (signed out) has nothing to show yet.
  if (referenceData === undefined) return { kind: "loading" }
  return {
    kind: "ready",
    sessionKey: draft.data?.id ?? "new",
    initialDraft: draft.data,
    issuer: issuerData,
    customers: customers.items ?? [],
    customersHasMore: customers.hasMore,
    customersLoadingMore: customers.loadingMore,
    customersLoadMore: customers.loadMore,
    invoiceSeries: seriesOptions,
    unitOfMeasures: unitsData ?? [],
    notesMaxLength: referenceData.textLimits.documentNotes,
    productPresets: presets.items ?? [],
    presetsHasMore: presets.hasMore,
    presetsLoadingMore: presets.loadingMore,
    presetsLoadMore: presets.loadMore,
    backgroundErrors,
  }
}
