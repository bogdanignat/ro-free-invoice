import { authoringSeriesOptions } from "./document-authoring-options.ts"
import { resourceFailure, type ResourceSnapshot } from "./async-resource.ts"
import type { DocumentSeries, Issuer, UnitOfMeasure } from "./draft-models.ts"
import type { ReferenceData } from "./authoring-reference-decoders.ts"

/**
 * Whether the proforma authoring screen may show a form at all, decided as a
 * plain function over what the four blocking reads answered.
 *
 * It is pure so the order of the refusals is a tested fact rather than a
 * reading of hook code: the issuer first (without it there is no document at
 * all; its VAT timeline gives the rates), then the proforma series, then the
 * units — the invoice screen's order. A missing series blocks before the form,
 * like the invoice's: its note links to Setări, and a form already filled in
 * would be lost on the way there.
 */
export type ProformaAuthoringResource = "issuer" | "series" | "units" | "reference"

export interface ProformaAuthoringPageInput {
  readonly issuer: ResourceSnapshot<Issuer | null>
  readonly series: ResourceSnapshot<ReadonlyArray<DocumentSeries>>
  readonly units: ResourceSnapshot<ReadonlyArray<UnitOfMeasure>>
  /** The county list and text limits the form's fields read. */
  readonly reference: ResourceSnapshot<ReferenceData>
}

export type ProformaAuthoringPageState =
  | { readonly kind: "loading" }
  /**
   * A blocking read failed. `reload` names the resources that are still missing,
   * so the retry the screen offers refetches exactly those instead of every
   * read — a resource that answered is not asked again.
   */
  | { readonly kind: "error"; readonly error: Error; readonly reload: ReadonlyArray<ProformaAuthoringResource> }
  | { readonly kind: "issuer-required" }
  | { readonly kind: "proforma-series-required" }
  | { readonly kind: "unit-catalogue-empty" }
  | {
    readonly kind: "ready"
    readonly issuer: Issuer
    readonly proformaSeries: ReadonlyArray<string>
    readonly unitOfMeasures: ReadonlyArray<UnitOfMeasure>
    readonly notesMaxLength: number
  }

const missing = (input: ProformaAuthoringPageInput): ReadonlyArray<ProformaAuthoringResource> => ([
  ["issuer", input.issuer], ["series", input.series], ["units", input.units], ["reference", input.reference],
] as ReadonlyArray<readonly [ProformaAuthoringResource, ResourceSnapshot<unknown>]>)
  .filter(([, snapshot]) => snapshot.data === undefined)
  .map(([resource]) => resource)

export const proformaAuthoringPageState = (input: ProformaAuthoringPageInput): ProformaAuthoringPageState => {
  const absent = missing(input)
  // Pending only counts while the resource has nothing to show: a background
  // refetch of data already held must not blank the form.
  const reads = [input.issuer, input.series, input.units, input.reference]
  if (absent.length > 0 && reads
    .some((snapshot) => snapshot.data === undefined && snapshot.isPending)) return { kind: "loading" }
  const failure = reads
    .find((snapshot) => snapshot.data === undefined && snapshot.error !== null && snapshot.error !== undefined)
  if (failure !== undefined) return { kind: "error", error: resourceFailure(failure.error), reload: absent }
  const issuer = input.issuer.data
  // `null` is the answer for an organization with no issuer profile yet;
  // `undefined` here means a read that neither failed nor pends, which is the
  // same missing prerequisite as far as the form is concerned.
  if (issuer === null || issuer === undefined) return { kind: "issuer-required" }
  const proformaSeries = authoringSeriesOptions(input.series.data ?? [], "proforma")
  if (proformaSeries.length === 0) return { kind: "proforma-series-required" }
  const unitOfMeasures = input.units.data ?? []
  if (unitOfMeasures.length === 0) return { kind: "unit-catalogue-empty" }
  // Answered or failed above; a read still disabled (signed out) has nothing to show yet.
  const reference = input.reference.data
  if (reference === undefined) return { kind: "loading" }
  return {
    kind: "ready",
    issuer,
    proformaSeries,
    unitOfMeasures,
    notesMaxLength: reference.textLimits.documentNotes,
  }
}
