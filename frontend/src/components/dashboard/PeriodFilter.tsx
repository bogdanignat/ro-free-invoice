import { Button } from "../ui/Button.tsx"
import { DateRangeFields } from "../DateRangeFields.tsx"
import { ChoiceGroup } from "../ui/ChoiceGroup.tsx"
import type { DashboardFiltersModel } from "../../hooks/use-dashboard-filters.ts"
import { PERIOD_CHOICES } from "../../lib/dashboard-query.ts"

/**
 * The period choice: five presets and a custom interval. The custom dates are
 * applied with the button, never per keystroke, so a half-typed date never
 * becomes a request.
 */
export const PeriodFilter = ({ filters }: { readonly filters: DashboardFiltersModel }) =>
  <div className="flex flex-wrap gap-x-6 gap-y-4 items-start mb-[1.2rem]">
    <ChoiceGroup legend="Perioada" choices={PERIOD_CHOICES} value={filters.periodChoice} onChange={filters.choosePeriod} />
    {filters.periodChoice === "custom"
      ? <form className="flex flex-wrap gap-x-4 gap-y-3 items-end" noValidate onSubmit={(event) => { event.preventDefault(); filters.applyCustom() }}>
        <DateRangeFields range={filters.customRange} error={filters.customError} onEdit={filters.editCustom} required>
          <Button type="submit" variant="secondary">Aplică intervalul</Button>
        </DateRangeFields>
      </form>
      : null}
  </div>
