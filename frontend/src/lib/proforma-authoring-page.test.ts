import assert from "node:assert/strict"
import test from "node:test"

import { ApiFailure } from "./api-errors.ts"
import type { DocumentSeries, Issuer, UnitOfMeasure } from "./draft-models.ts"
import { proformaAuthoringPageState, type ProformaAuthoringPageInput } from "./proforma-authoring-page.ts"
import type { ResourceSnapshot } from "./async-resource.ts"
import type { ReferenceData } from "./authoring-reference-decoders.ts"

const answered = <T>(data: T): ResourceSnapshot<T> => ({ data, isPending: false, error: null })
const pending = <T>(): ResourceSnapshot<T> => ({ data: undefined, isPending: true, error: null })
const failed = <T>(error: unknown): ResourceSnapshot<T> => ({ data: undefined, isPending: false, error })

const issuer: Issuer = {
  organizationId: "org", name: "RFI Software SRL", fiscalIdentifier: "12345674",
  address: { countryCode: "RO", city: "București", street: "Str. Lungă 1", county: "RO-B", sector: 3 },
  legalForm: "srl", tradeRegistryNumber: "J40/1234/2020", iban: "RO49AAAA1B31007593840000",
  bankName: "Banca Transilvania", socialCapital: "200.00", defaultCurrency: "RON", defaultPaymentTermDays: 14,
  vatConfigurations: [], currentVat: null, vatPeriods: [], branding: null,
}

const series: ReadonlyArray<DocumentSeries> = [
  { organizationId: "org", documentType: "proforma", series: "PRO", archived: false },
  { organizationId: "org", documentType: "invoice", series: "FCT", archived: false },
]

const units: ReadonlyArray<UnitOfMeasure> = [{ code: "H87", name: "bucată" }]

const reference: ReferenceData = {
  counties: [{ code: "RO-B", name: "București" }],
  textLimits: { partyName: 200, street: 150, city: 50, postalCode: 20, lineDescription: 100, documentNotes: 300 },
}

const ready: ProformaAuthoringPageInput = {
  issuer: answered<Issuer | null>(issuer),
  series: answered(series), units: answered(units), reference: answered(reference),
}

void test("every blocking read answered gives the form, with only the proforma series", () => {
  const state = proformaAuthoringPageState(ready)

  assert.equal(state.kind, "ready")
  assert.deepEqual(state.proformaSeries, ["PRO"])
  assert.deepEqual(state.unitOfMeasures, units)
})

void test("a blocking read still in flight keeps the screen loading", () => {
  for (const partial of [
    { issuer: pending<Issuer | null>() },
    { series: pending<ReadonlyArray<DocumentSeries>>() }, { units: pending<ReadonlyArray<UnitOfMeasure>>() },
    { reference: pending<ReferenceData>() },
  ]) {
    assert.equal(proformaAuthoringPageState({ ...ready, ...partial }).kind, "loading")
  }
})

/**
 * The refetch a failed screen offers must not re-ask what already answered: the
 * failure names the resources that are still missing, and nothing else.
 */
void test("a failed read becomes an error that names only what is still missing", () => {
  const state = proformaAuthoringPageState({
    ...ready, units: failed<ReadonlyArray<UnitOfMeasure>>(new ApiFailure({ message: "gateway", status: 502 })),
  })

  assert.equal(state.kind, "error")
  assert.equal(state.error.message, "gateway")
  assert.deepEqual(state.reload, ["units"])
  const noReference = proformaAuthoringPageState({ ...ready, reference: failed<ReferenceData>(new Error("reference")) })
  assert.equal(noReference.kind, "error")
  assert.deepEqual(noReference.reload, ["reference"])
})

void test("a rejection that is not an Error still reaches the screen as a sentence", () => {
  const state = proformaAuthoringPageState({ ...ready, issuer: failed<Issuer | null>({ weird: true }) })

  assert.equal(state.kind, "error")
  assert.equal(state.error.message, "Încărcarea datelor a eșuat.")
  assert.equal(state.error.message.includes("object"), false)
})

void test("a background refetch of data already held does not blank the form", () => {
  const state = proformaAuthoringPageState({
    ...ready, series: { data: series, isPending: false, error: new Error("stale refetch failed") },
  })

  assert.equal(state.kind, "ready")
})

void test("the missing prerequisites are refused in order: issuer, then series, then units", () => {
  const noIssuer = { ...ready, issuer: answered<Issuer | null>(null) }

  assert.equal(proformaAuthoringPageState(noIssuer).kind, "issuer-required")
  // The issuer wins even when the units are empty too: it is the first thing to set up.
  assert.equal(proformaAuthoringPageState({ ...noIssuer, units: answered<ReadonlyArray<UnitOfMeasure>>([]) }).kind, "issuer-required")
  assert.equal(proformaAuthoringPageState({ ...ready, units: answered<ReadonlyArray<UnitOfMeasure>>([]) }).kind, "unit-catalogue-empty")
  const noSeries = { ...ready, series: answered<ReadonlyArray<DocumentSeries>>([]) }
  assert.equal(proformaAuthoringPageState({ ...noSeries, units: answered<ReadonlyArray<UnitOfMeasure>>([]) }).kind, "proforma-series-required")
  assert.equal(proformaAuthoringPageState({ ...noSeries, issuer: answered<Issuer | null>(null) }).kind, "issuer-required")
})

/**
 * A missing series blocks before the form, as on the invoice screen: the note
 * links to Setări, and nothing typed is left behind on the way there.
 */
void test("no proforma series is its own state before the form; an invoice series does not stand for one", () => {
  const state = proformaAuthoringPageState({
    ...ready, series: answered<ReadonlyArray<DocumentSeries>>([{ organizationId: "org", documentType: "invoice", series: "FCT", archived: false }]),
  })

  assert.equal(state.kind, "proforma-series-required")
})
