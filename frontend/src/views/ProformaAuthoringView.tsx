import { AppLink } from "../components/ui/AppLink.tsx"
import { buttonClass } from "../components/ui/Button.tsx"
import { SetupNote } from "../components/ui/SetupNote.tsx"
import { ErrorAlert, Loading } from "../components/AsyncState.tsx"
import { Page } from "../components/Page.tsx"
import { PrivateScreen } from "../components/PrivateScreen.tsx"
import { ProformaAuthoringSession } from "../components/authoring/ProformaAuthoringSession.tsx"
import { useAuthenticatedShell } from "../hooks/use-authenticated-shell.ts"
import { useProformaAuthoringPage } from "../hooks/use-proforma-authoring-page.ts"

/**
 * The proforma authoring frame: prerequisites first, then the form.
 *
 * Like the invoice screen, every missing prerequisite (the issuer, the
 * proforma series, the units) is said before the form, so the
 * link to Setări never leaves a filled-in form behind.
 */
export const ProformaAuthoringView = () => {
  const shell = useAuthenticatedShell()
  const page = useProformaAuthoringPage()
  return <PrivateScreen shell={shell}>
    <Page
      title="Proformă nouă"
      eyebrow="Document comercial"
      actions={<AppLink className={buttonClass({ variant: "secondary" })} href="/proformas">Înapoi la proforme</AppLink>}
    >
      {page.kind === "loading" ? <Loading label="Se pregătește formularul…" />
        : page.kind === "error" ? <ErrorAlert error={page.error} onRetry={page.retry} />
        : page.kind === "issuer-required" ? <SetupNote>Datele firmei emitente nu sunt completate. Completează-le în <AppLink href="/settings">Setări</AppLink>, împreună cu o serie pentru proforme, apoi revino aici.</SetupNote>
        : page.kind === "proforma-series-required" ? <SetupNote>Nu există nicio serie activă pentru proforme. Adaug-o sau reactiveaz-o în <AppLink href="/settings">Setări</AppLink>, apoi revino aici.</SetupNote>
        : page.kind === "unit-catalogue-empty" ? <SetupNote>Catalogul de unități de măsură a venit gol de la server; nu se completează din aplicație. Reîncarcă pagina, iar dacă problema rămâne, verifică instalarea serverului.</SetupNote>
        : <ProformaAuthoringSession {...page.session} />}
    </Page>
  </PrivateScreen>
}
