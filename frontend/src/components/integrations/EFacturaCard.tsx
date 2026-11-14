import { Badge } from "../ui/Badge.tsx"
import { Button } from "../ui/Button.tsx"
import { ErrorAlert } from "../AsyncState.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"
import type { EFacturaConnectionModel } from "../../hooks/use-efactura-connection.ts"

/**
 * The ANAF e-Factura connection: the environment (set on the server, never
 * here), the state, who connected and until when, and the two actions. Every
 * sentence comes from `lib/efactura-connection.ts`.
 */
export const EFacturaCard = ({ model }: { readonly model: EFacturaConnectionModel }) => {
  const { view } = model
  return <section className="card form-card" aria-labelledby="efactura-title">
    <div className="section-heading"><div>
      <h2 id="efactura-title">ANAF e-Factura</h2>
      <p>Conexiunea prin care aplicația trimite facturile și documentele storno în SPV, cu certificatul firmei.</p>
    </div>
    {view === undefined ? null : <Badge tone="info">Mediu: {view.environment}</Badge>}
    </div>
    {model.notice === undefined
      ? null
      : <StatusNote tone={model.notice.tone === "warning" ? "warning" : "info"}>{model.notice.message}</StatusNote>}
    {model.failure === undefined ? null : <ErrorAlert error={model.failure} />}
    {view === undefined
      ? model.isPending ? <p className="hint" role="status">Se încarcă conexiunea ANAF…</p> : <ErrorAlert error={model.error} onRetry={model.retry} />
      : <>
        <p className="m-0"><Badge tone={view.tone}>{view.statusLabel}</Badge></p>
        <p className="hint">{view.explanation}</p>
        {view.facts.length === 0 ? null : <dl className="facts">
          {view.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
        </dl>}
        {view.expiryWarning === undefined ? null : <StatusNote tone="warning">{view.expiryWarning}</StatusNote>}
        {view.attemptNote === undefined ? null : <StatusNote>{view.attemptNote}</StatusNote>}
        <div className="button-row">
          {view.connectLabel === undefined ? null : <Button disabled={model.pending} onClick={model.connect}>{view.connectLabel}</Button>}
          {view.canDisconnect
            ? <Button variant="danger" disabled={model.pending} onClick={model.disconnect}>Deconectează</Button>
            : null}
        </div>
      </>}
  </section>
}
