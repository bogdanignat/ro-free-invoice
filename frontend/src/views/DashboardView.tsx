import { AppLink } from "../components/ui/AppLink.tsx"
import { buttonClass } from "../components/ui/Button.tsx"
import { ErrorAlert } from "../components/AsyncState.tsx"
import { PeriodSection } from "../components/dashboard/PeriodSection.tsx"
import { SetupGapsCard } from "../components/dashboard/SetupGapsCard.tsx"
import { SituationSection } from "../components/dashboard/SituationSection.tsx"
import { Page } from "../components/Page.tsx"
import { PrivateScreen } from "../components/PrivateScreen.tsx"
import { useAuthenticatedShell } from "../hooks/use-authenticated-shell.ts"
import { useDashboard } from "../hooks/use-dashboard.ts"
import { useSetupGaps } from "../hooks/use-setup-gaps.ts"

export const DashboardView = () => {
  const shell = useAuthenticatedShell()
  const dashboard = useDashboard()
  const gaps = useSetupGaps()
  return <PrivateScreen shell={shell}>
    <Page title="Acasă" eyebrow="Tablou de bord"
      actions={<AppLink className={buttonClass()} href="/invoices/new">Factură nouă</AppLink>}>
      {shell.error === undefined ? null : <ErrorAlert error={shell.error} />}
      {/* `minmax(0,1fr)`: a wide table scrolls inside its card instead of widening the column past the screen. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <SetupGapsCard gaps={gaps} />
        <PeriodSection dashboard={dashboard} />
        <SituationSection dashboard={dashboard} />
      </div>
    </Page>
  </PrivateScreen>
}
