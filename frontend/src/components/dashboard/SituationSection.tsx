import { useId } from "react"

import { CollectionsTable } from "./CollectionsTable.tsx"
import { ReportFrame } from "./ReportFrame.tsx"
import { StatCards } from "./StatCards.tsx"
import { EmptyState } from "../AsyncState.tsx"
import { Card } from "../ui/Card.tsx"
import { ChoiceGroup } from "../ui/ChoiceGroup.tsx"
import { Count } from "../ui/Count.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import type { DashboardModel } from "../../hooks/use-dashboard.ts"
import { COLLECTIONS_STATUS_FILTERS } from "../../lib/dashboard-query.ts"

/**
 * The invoices issued in the period, filtered by today's payment status. Only
 * rendered with the payments plugin on; the status and balances are the backend's.
 */
export const SituationSection = ({ dashboard }: { readonly dashboard: DashboardModel }) => {
  const headingId = useId()
  const { filters, situation } = dashboard
  if (situation === undefined) return null
  return <Card aria-labelledby={headingId} aria-busy={situation.state.refreshing}>
    <SectionHeading id={headingId} title="Facturile emise în perioadă"
      description="Status și sold la zi, cu toate plățile facturii, indiferent de data lor."
      aside={situation.state.refreshing
        ? <Count role="status">Se actualizează…</Count>
        : situation.view === undefined ? null : <Count>{situation.view.count}</Count>} />
    <div className="flex flex-wrap gap-x-6 gap-y-4 items-end mb-[1.2rem]">
      <ChoiceGroup legend="Status încasare" choices={COLLECTIONS_STATUS_FILTERS}
        value={filters.query.status} onChange={filters.chooseStatus} />
    </div>
    <ReportFrame block={situation} loading="Se încarcă facturile perioadei…">
      {(view) => <>
        <StatCards label="Situația facturilor filtrate" cards={view.cards} />
        {view.rows.length === 0
          ? <EmptyState>Nicio factură din perioadă nu corespunde filtrului.</EmptyState>
          : <CollectionsTable rows={view.rows} />}
      </>}
    </ReportFrame>
  </Card>
}
