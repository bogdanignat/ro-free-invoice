import { Button } from "../ui/Button.tsx"
import { ButtonRow } from "../ui/ButtonRow.tsx"
import { Card } from "../ui/Card.tsx"
import { Divider } from "../ui/Divider.tsx"
import { ErrorAlert } from "../AsyncState.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"
import { IssuerAddressFields } from "./IssuerAddressFields.tsx"
import { IssuerBrandingFields } from "./IssuerBrandingFields.tsx"
import { IssuerIdentityFields } from "./IssuerIdentityFields.tsx"
import { IssuerVatFields } from "./IssuerVatFields.tsx"
import { IssuerVatHistory } from "./IssuerVatHistory.tsx"
import { useRefusedFieldFocus } from "../../hooks/use-refused-field-focus.ts"
import { ISSUER_FORM, registryFieldAria } from "../../lib/registry-fields.ts"
import type { IssuerSettingsModel } from "../../hooks/use-issuer-settings.ts"

/**
 * The issuer profile as one form: identity, address, brand, VAT, and the
 * read-only history under it.
 *
 * The sections are rendered in the order the model validates them, so the field
 * a refusal names is always the first wrong one reading down the screen — the
 * focus move `useRefusedFieldFocus` performs then lands where the eye already is.
 */
export const IssuerSettingsCard = ({ model }: { readonly model: IssuerSettingsModel }) => {
  const { form, issue, pending } = model
  useRefusedFieldFocus(ISSUER_FORM, issue?.field)
  const aria = registryFieldAria(ISSUER_FORM, issue?.field)
  return <Card className="grid gap-5" aria-labelledby="issuer-settings-title">
    <SectionHeading id="issuer-settings-title" title="Date firmă"
      description="Datele sunt copiate pe fiecare document în momentul emiterii." />
    {model.notice === undefined ? null : <StatusNote>{model.notice}</StatusNote>}
    {model.warning === undefined ? null : <StatusNote tone="warning">{model.warning}</StatusNote>}
    {model.error === null || model.error === undefined ? null : <ErrorAlert error={model.error} />}
    <form onSubmit={(event) => { event.preventDefault(); model.submit() }}>
      <IssuerIdentityFields form={form} disabled={pending} issue={issue} aria={aria}
        onChange={model.change} onIdentifierChange={model.changeIdentifier} />
      <Divider />
      <IssuerAddressFields form={form} disabled={pending} issue={issue} aria={aria}
        sectorRequired={model.sectorRequired} onChange={model.change} onCountyChange={model.changeCounty} />
      <Divider />
      <IssuerBrandingFields form={form} disabled={pending} issue={issue} aria={aria}
        branding={model.branding} onChange={model.change} onClearBranding={model.clearBranding} />
      <Divider />
      <IssuerVatFields form={form} disabled={pending} issue={issue} aria={aria}
        vatStatus={model.vatStatus} onChange={model.change} onVatRegisteredChange={model.changeVatRegistered} />
      <IssuerVatHistory history={model.vatHistory} />
      <ButtonRow>
        <Button type="submit" disabled={pending || model.branding.pending}>
          {pending ? "Se salvează…" : "Salvează datele firmei"}
        </Button>
      </ButtonRow>
    </form>
  </Card>
}
