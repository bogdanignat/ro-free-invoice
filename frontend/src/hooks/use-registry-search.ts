import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent, type RefObject } from "react"

import { useAuth } from "./auth-context.ts"
import { useDebouncedValue } from "./use-debounced-value.ts"
import { useInvoicingClients } from "./use-invoicing-clients.ts"
import type { Customer, ProductPreset } from "../lib/draft-models.ts"
import type { Page } from "../lib/model-decoder.ts"

type Registry = "customers" | "product-presets"

const SEARCH_DELAY_MS = 250
/** The server's `maximumSearchLength`: longer text is cut here instead of refused there. */
const SEARCH_MAX_LENGTH = 100
const NO_ITEMS: ReadonlyArray<never> = []
const FAILED = "Căutarea a eșuat. Încearcă din nou."
const MORE = "Sunt mai multe rezultate, rafinează căutarea."

/** The text sent as `q`: no control characters (the server refuses them), trimmed, capped; "" is no search. */
export const searchText = (typed: string | undefined): string =>
  (typed ?? "").replace(/\p{Cc}/gu, " ").trim().slice(0, SEARCH_MAX_LENGTH).trim()

/** Under the registry's prefix, so its writes invalidate it, and apart from the infinite list at the bare prefix. */
export const registrySearchKey = (registry: Registry, q: string) => [registry, "search", q] as const

/** Closed: nothing. Open with nothing typed: the pages already loaded. Otherwise: what the server found. */
export const searchOptions = <Item>(
  expanded: boolean,
  text: string | undefined,
  loaded: ReadonlyArray<Item>,
  found: ReadonlyArray<Item> | undefined,
): ReadonlyArray<Item> => !expanded ? NO_ITEMS : searchText(text) === "" ? loaded : found ?? NO_ITEMS

export interface SearchAnswer {
  readonly failed: boolean
  /** The server answered this `q` (not a placeholder kept from the previous one). */
  readonly fresh: boolean
  readonly count: number
  readonly more: boolean
}

export type SearchHint = "failed" | "noMatch" | "more" | undefined

/** Said only once the answer is for the text typed now (not mid-debounce): failed, nothing found, or a cut first page. */
export const searchHint = (typed: string | undefined, q: string, answer: SearchAnswer): SearchHint => {
  if (q === "" || searchText(typed) !== q) return undefined
  if (answer.failed) return "failed"
  if (!answer.fresh) return undefined
  if (answer.count === 0) return "noMatch"
  return answer.more ? "more" : undefined
}

export interface SearchField {
  readonly ref: RefObject<HTMLInputElement | null>
  readonly onFocus: (event: FocusEvent<HTMLInputElement>) => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export interface RegistrySearch<Item> {
  /** What the user typed since the last pick or close; `undefined` while the field shows its own value. */
  readonly text: string | undefined
  readonly options: ReadonlyArray<Item>
  /** The status line under the field, if any. */
  readonly hint: string | undefined
  /** Focus selects the shown value, typing or ArrowDown opens the list, Escape restores the value. */
  readonly field: SearchField
  /** Leaving the field: closes the list and drops what was typed. */
  readonly close: () => void
  /** After a pick: closes the list and selects the shown value, so the next key replaces it. */
  readonly restore: () => void
}

const useRegistrySearch = <Item>(
  registry: Registry,
  loaded: ReadonlyArray<Item>,
  search: (q: string, signal: AbortSignal) => Promise<Page<Item>>,
  noMatch: string,
): RegistrySearch<Item> => {
  const { status } = useAuth()
  const [text, setText] = useState<string | undefined>(undefined)
  const [expanded, setExpanded] = useState(false)
  const [selectRequest, setSelectRequest] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const q = useDebouncedValue(searchText(text), SEARCH_DELAY_MS)
  const query = useQuery({
    queryKey: registrySearchKey(registry, q),
    enabled: status === "authenticated" && q !== "",
    queryFn: ({ signal }) => search(q, signal),
    placeholderData: keepPreviousData,
  })
  // The restored value is rendered only after the handler, so it is selected here.
  useEffect(() => {
    if (selectRequest > 0 && document.activeElement === input.current) input.current?.select()
  }, [selectRequest])
  const close = () => { setExpanded(false); setText(undefined) }
  const restore = () => { close(); setSelectRequest((count) => count + 1) }
  const hint = searchHint(text, q, {
    failed: query.isError, fresh: query.isSuccess && !query.isPlaceholderData,
    count: query.data?.items.length ?? 0, more: (query.data?.nextCursor ?? null) !== null,
  })
  return {
    text,
    options: searchOptions(expanded, text, loaded, q === "" ? undefined : query.data?.items),
    hint: hint === "failed" ? FAILED : hint === "noMatch" ? noMatch : hint === "more" ? MORE : undefined,
    field: {
      ref: input,
      onFocus: (event) => { event.currentTarget.select() },
      onKeyDown: (event) => {
        if (event.key === "Escape") restore()
        if (event.key !== "ArrowDown") return
        if (query.isError) void query.refetch()
        if (expanded) return
        // Opening keeps the value selected (no caret move), so typing still replaces it.
        event.preventDefault()
        setExpanded(true)
      },
      onChange: (event) => { setText(event.currentTarget.value); setExpanded(true) },
    },
    close,
    restore,
  }
}

export const useCustomerSearch = (loaded: ReadonlyArray<Customer>): RegistrySearch<Customer> => {
  const clients = useInvoicingClients()
  return useRegistrySearch("customers", loaded, clients.reference.searchCustomers, "Niciun client găsit.")
}

export const useProductPresetSearch = (loaded: ReadonlyArray<ProductPreset>): RegistrySearch<ProductPreset> => {
  const clients = useInvoicingClients()
  return useRegistrySearch("product-presets", loaded, clients.reference.searchProductPresets, "Niciun produs găsit.")
}
