import { useId } from "react"

import { PeriodFilter } from "./PeriodFilter.tsx"
import { ReportFrame } from "./ReportFrame.tsx"
import { RevenueChart } from "./RevenueChart.tsx"
import { StatCards } from "./StatCards.tsx"
import { Card } from "../ui/Card.tsx"
import { Count } from "../ui/Count.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import type { DashboardModel } from "../../hooks/use-dashboard.ts"

/** The period block: its figures and chart follow the period only, never the status filter below. */
export const PeriodSection = ({ dashboard }: { readonly dashboard: DashboardModel }) => {
  const headingId = useId()
  const { filters, period } = dashboard
  return <Card aria-labelledby={headingId} aria-busy={period.state.refreshing}>
    <SectionHeading id={headingId} title="Perioada" description={dashboard.caption}
      aside={period.state.refreshing ? <Count role="status">Se actualizează…</Count> : null} />
    <PeriodFilter filters={filters} />
    <ReportFrame block={period} loading="Se încarcă cifrele perioadei…">
      {(view) => <>
        <StatCards label="Cifrele perioadei" cards={view.cards} />
        <RevenueChart months={view.months} currency={view.currency} />
      </>}
    </ReportFrame>
  </Card>
}
