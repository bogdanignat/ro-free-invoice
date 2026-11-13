import { useId } from "react"

import { PageSizeSelect } from "./PageSizeSelect.tsx"
import { RegisterPeriodFilter } from "./RegisterPeriodFilter.tsx"
import { ChoiceGroup } from "./ui/ChoiceGroup.tsx"
import { Input } from "./ui/Input.tsx"
import type { RegisterFiltersModel } from "../hooks/use-register-filters.ts"
import { SEARCH_MAX_LENGTH, type RegisterKindFilter, type RegisterSpvFilter } from "../lib/invoice-register-query.ts"

const kinds: ReadonlyArray<{ readonly value: RegisterKindFilter; readonly label: string }> = [
  { value: "all", label: "Toate" },
  { value: "invoice", label: "Facturi" },
  { value: "correction", label: "Storno" },
]

const spvChoices: ReadonlyArray<{ readonly value: RegisterSpvFilter; readonly label: string }> = [
  { value: "all", label: "Toate" },
  { value: "unresolved", label: "De rezolvat în SPV" },
]

/** `eFactura`: the SPV filter exists only with the e-Factura plugin on. */
export const RegisterFilters = ({ filters, eFactura }: { readonly filters: RegisterFiltersModel; readonly eFactura: boolean }) => {
  const searchId = useId()
  return <div className="filters">
    <RegisterPeriodFilter filters={filters} />
    <ChoiceGroup legend="Tip document" choices={kinds} value={filters.kind} onChange={filters.setKind} />
    {eFactura ? <ChoiceGroup legend="Stare SPV" choices={spvChoices} value={filters.spv} onChange={filters.setSpv} /> : null}
    <div className="filter-search">
      <label htmlFor={searchId}>Caută după număr sau client</label>
      <Input
        id={searchId}
        type="search"
        value={filters.search}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder="ex. FCT 12 sau Alpha"
        onChange={(event) => { filters.setSearch(event.target.value) }}
      />
    </div>
    <PageSizeSelect value={filters.pageSize} onChange={filters.setPageSize} />
  </div>
}
