import { Badge } from "../ui/Badge.tsx"
import { Button } from "../ui/Button.tsx"
import { ButtonRow } from "../ui/ButtonRow.tsx"
import { Card } from "../ui/Card.tsx"
import { CardText } from "../ui/CardText.tsx"
import { ErrorAlert } from "../AsyncState.tsx"
import { Hint } from "../ui/Hint.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"
import type { EFacturaConnectionModel } from "../../hooks/use-efactura-connection.ts"

/**
 * The ANAF e-Factura connection: the environment (set on the server, never
 * here), the state, who connected and until when, and the two actions. Every
 * sentence comes from `lib/efactura-connection.ts`.
 */
export const EFacturaCard = ({ model }: { readonly model: EFacturaConnectionModel }) => {
  const { view } = model
  return <Card className="grid gap-5" aria-labelledby="efactura-title">
    <SectionHeading id="efactura-title" title="ANAF e-Factura"
      description="Conexiunea prin care aplicația trimite facturile și documentele storno în SPV, cu certificatul firmei."
      aside={view === undefined ? null : <Badge tone="info">Mediu: {view.environment}</Badge>} />
    {model.notice === undefined
      ? null
      : <StatusNote tone={model.notice.tone === "warning" ? "warning" : "info"}>{model.notice.message}</StatusNote>}
    {model.failure === undefined ? null : <ErrorAlert error={model.failure} />}
    {view === undefined
      ? model.isPending ? <Hint role="status">Se încarcă conexiunea ANAF…</Hint> : <ErrorAlert error={model.error} onRetry={model.retry} />
      : <>
        <CardText><Badge tone={view.tone}>{view.statusLabel}</Badge></CardText>
        <Hint>{view.explanation}</Hint>
        {view.facts.length === 0 ? null : <dl className="flex flex-wrap gap-x-8 gap-y-[.6rem] m-0">
          {view.facts.map((fact) => <div key={fact.label}>
            <dt className="text-invoice-muted text-invoice-caption font-extrabold tracking-invoice-caps uppercase">{fact.label}</dt>
            <dd className="mt-[.15rem] font-invoice-emphasis">{fact.value}</dd>
          </div>)}
        </dl>}
        {view.expiryWarning === undefined ? null : <StatusNote tone="warning">{view.expiryWarning}</StatusNote>}
        {view.attemptNote === undefined ? null : <StatusNote>{view.attemptNote}</StatusNote>}
        <ButtonRow>
          {view.connectLabel === undefined ? null : <Button disabled={model.pending} onClick={model.connect}>{view.connectLabel}</Button>}
          {view.canDisconnect
            ? <Button variant="danger" disabled={model.pending} onClick={model.disconnect}>Deconectează</Button>
            : null}
        </ButtonRow>
      </>}
  </Card>
}
