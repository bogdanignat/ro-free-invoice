import { OpenapiKeyField } from "./OpenapiKeyField.tsx"
import { ProviderSwitches } from "./ProviderSwitches.tsx"
import { Card } from "../ui/Card.tsx"
import { Divider } from "../ui/Divider.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"
import type { CompanyLookupSettingsModel } from "../../hooks/use-company-lookup-settings.ts"
import type { CompanyLookupSettings } from "../../lib/company-lookup-settings.ts"

interface CompanyLookupCardProps {
  readonly model: CompanyLookupSettingsModel
  readonly settings: CompanyLookupSettings
}

/** Completing companies from a CUI: the provider switches, then the openapi.ro key they may need. */
export const CompanyLookupCard = ({ model, settings }: CompanyLookupCardProps) =>
  <Card className="grid gap-5" aria-labelledby="company-lookup-title">
    <SectionHeading id="company-lookup-title" title="Completarea datelor firmelor"
      description="Furnizorul pornit completează denumirea, adresa și datele fiscale ale unei firme după CUI, în fișa clientului și în datele emitentului. Fiecare schimbare se salvează imediat." />
    {model.notice === undefined ? null : <StatusNote>{model.notice}</StatusNote>}
    {model.failure === undefined ? null : <StatusNote tone="warning">{model.failure}</StatusNote>}
    <ProviderSwitches settings={settings} disabled={model.pending} onToggle={model.toggle} />
    <Divider />
    <OpenapiKeyField settings={settings} editor={model.key} disabled={model.pending} />
  </Card>
