import { ErrorAlert } from "../AsyncState.tsx"
import { Badge } from "../ui/Badge.tsx"
import { Card } from "../ui/Card.tsx"
import { CardText } from "../ui/CardText.tsx"
import { Hint } from "../ui/Hint.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"
import { EFACTURA_REASON_ID } from "./EFacturaAction.tsx"
import { EFacturaErrors } from "./EFacturaErrors.tsx"
import { EFacturaFiles } from "./EFacturaFiles.tsx"
import { EFacturaHistory } from "./EFacturaHistory.tsx"
import { EFacturaReconciliation } from "./EFacturaReconciliation.tsx"
import type { EFacturaDocumentModel } from "../../hooks/use-efactura-document.ts"
import { useFocusOnReturn } from "../../hooks/use-focus-on-return.ts"

/**
 * A document's e-Factura panel: where it is at ANAF and why, ANAF's errors on
 * the current submission, the reconciliation of an `unknown` one, and every
 * submission so far. The send button itself is in the document head. A
 * settled link or resubmit removes the reconciliation it was pressed in, so the
 * keyboard goes back to the panel's heading instead of `document.body`.
 */
export const EFacturaSection = ({ model }: { readonly model: EFacturaDocumentModel }) => {
  const { view } = model
  const heading = useFocusOnReturn<HTMLHeadingElement>(view?.reconcile !== true, true)
  return <Card className="grid gap-4" aria-labelledby="efactura-section-title">
    <SectionHeading eyebrow="ANAF" title="e-Factura" id="efactura-section-title" titleRef={heading}
      aside={view === undefined ? null : <Badge tone={view.badgeTone}>{view.badgeLabel}</Badge>} />
    {view === undefined
      ? model.isPending ? <Hint role="status">Se încarcă starea e-Factura…</Hint> : <ErrorAlert error={model.error} onRetry={model.retry} />
      : <>
        {view.reason === undefined ? null : <CardText id={EFACTURA_REASON_ID}>{view.reason}</CardText>}
        {view.detail === undefined ? null : <CardText>{view.detail}</CardText>}
        {model.connectionError === undefined ? null : <ErrorAlert error={model.connectionError} onRetry={model.connectionRetry} />}
        {view.current === null
          ? null
          : <EFacturaFiles submissionId={view.current.id} files={model.files} response={view.responseStored} />}
        {model.notice === undefined ? null : <StatusNote>{model.notice}</StatusNote>}
        {model.failure === undefined ? null : <ErrorAlert error={model.failure} />}
        <EFacturaErrors errors={view.errors} title={view.errorsTitle} />
        {view.reconcile ? <EFacturaReconciliation model={model.reconciliation} /> : null}
        <EFacturaHistory rows={model.rows} files={model.files} />
      </>}
  </Card>
}
