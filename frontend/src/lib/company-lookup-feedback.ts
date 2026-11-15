import { ApiFailure, isTransientFailure } from "./api-errors.ts"
import type { ResourceSnapshot } from "./async-resource.ts"
import type { CompanyLookupSettings } from "./company-lookup-settings.ts"

/**
 * What Integrări says when the backend refuses, in Romanian.
 *
 * The settings routes answer `settings.manage` with a `403`, whose shared
 * wording names a document, so this screen says its own. A `400` carries coded
 * details (`cubes/invoicing/company-lookup/domain/settings.ts`) and the `409` of a
 * missing master key a code: both arrive already localized by `api-errors.ts`.
 * The browser never checks the permission itself: the `403` is the answer.
 */
export const INTEGRATIONS_DENIED = "Nu ai permisiunea de a administra integrările. Cere-i administratorului aplicației acest drept."

export const companyLookupFailureMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return "A apărut o eroare neașteptată."
  if (!(error instanceof ApiFailure)) return error.message
  if (error.status === 403) return INTEGRATIONS_DENIED
  return error.message
}

/** What the screen shows before it can show switches. `off`: the plugin is not running, nothing is asked. */
export type IntegrationsLoad =
  | { readonly kind: "off" }
  | { readonly kind: "loading" }
  | { readonly kind: "denied"; readonly message: string }
  | { readonly kind: "error"; readonly message: string; readonly transient: boolean }
  | { readonly kind: "ready"; readonly settings: CompanyLookupSettings }

export const integrationsLoad = (enabled: boolean, read: ResourceSnapshot<CompanyLookupSettings>): IntegrationsLoad => {
  if (!enabled) return { kind: "off" }
  // Data wins over a later failed refetch: the switches stay while a refresh fails.
  if (read.data !== undefined) return { kind: "ready", settings: read.data }
  if (read.error === null || read.error === undefined) return { kind: "loading" }
  if (read.error instanceof ApiFailure && read.error.status === 403) return { kind: "denied", message: INTEGRATIONS_DENIED }
  return { kind: "error", message: companyLookupFailureMessage(read.error), transient: isTransientFailure(read.error) }
}
