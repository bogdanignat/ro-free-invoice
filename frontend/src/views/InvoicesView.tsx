import { AppLink } from "../components/ui/AppLink.tsx"
import { buttonClass } from "../components/ui/Button.tsx"
import { Card } from "../components/ui/Card.tsx"
import { Count } from "../components/ui/Count.tsx"
import { SectionHeading } from "../components/ui/SectionHeading.tsx"
import { ErrorAlert } from "../components/AsyncState.tsx"
import { DraftsSection } from "../components/DraftsSection.tsx"
import { Page } from "../components/Page.tsx"
import { PrivateScreen } from "../components/PrivateScreen.tsx"
import { RegisterFilters } from "../components/RegisterFilters.tsx"
import { RegisterResults } from "../components/RegisterResults.tsx"
import { useAuthenticatedShell } from "../hooks/use-authenticated-shell.ts"
import { useDrafts } from "../hooks/use-drafts.ts"
import { useInvoiceRegister } from "../hooks/use-invoice-register.ts"

export const InvoicesView = () => {
  const shell = useAuthenticatedShell()
  const register = useInvoiceRegister()
  const drafts = useDrafts()
  return <PrivateScreen shell={shell}>
    <Page title="Registru de facturi" eyebrow="Documente emise"
      actions={<AppLink className={buttonClass()} href="/invoices/new">Factură nouă</AppLink>}>
      {shell.error === undefined ? null : <ErrorAlert error={shell.error} />}
      <div className="grid gap-6">
        <Card>
          <SectionHeading title="Facturi și storno" description="Snapshot-uri fiscale imuabile, ordonate după emitere."
            aside={register.rows === undefined ? undefined : <Count aria-live="polite">{register.rows.length} încărcate</Count>} />
          <RegisterFilters filters={register.filters} eFactura={register.eFacturaColumn} />
          <RegisterResults register={register} />
        </Card>
        <DraftsSection drafts={drafts} />
      </div>
    </Page>
  </PrivateScreen>
}
