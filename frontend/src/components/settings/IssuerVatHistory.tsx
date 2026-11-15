import { Table, Td, Th } from "../ui/Table.tsx"
import { orDash } from "../../lib/format.ts"
import type { VatHistoryItem } from "../../lib/issuer-vat-regime.ts"

/**
 * The regimes the issuer has been in, read-only.
 *
 * A past period is a fiscal fact: the documents issued under it keep its rates,
 * so there is nothing here to edit — the current regime is moved by the form
 * above, which writes a new period rather than rewriting an old one. A period
 * whose stored rates name no regime this app knows says so instead of being
 * shown as "scutit", which would be a claim about someone's taxes.
 *
 * The heading belongs here rather than to the card above, so a profile with no
 * regime yet does not show a title over nothing.
 */
export const IssuerVatHistory = ({ history }: { readonly history: ReadonlyArray<VatHistoryItem> }) =>
  history.length === 0
    ? null
    : <>
      <h3 className="m-0 text-invoice-muted text-invoice-field font-extrabold tracking-[.1em] uppercase">Istoric regim TVA</h3>
      <Table>
        <caption className="sr-only">Istoricul regimurilor TVA înregistrate</caption>
        <thead><tr><Th scope="col">Regim</Th><Th scope="col">Cote</Th><Th scope="col">De la</Th><Th scope="col">Până la</Th></tr></thead>
        <tbody>
          {history.map((item) => <tr key={`${item.effectiveFrom}-${item.effectiveTo ?? "prezent"}`}>
            <Td label="Regim">{item.registered === undefined
              ? "Regim nerecunoscut"
              : item.registered ? "Plătitor TVA" : "Scutit TVA — art. 310"}</Td>
            <Td label="Cote">{item.rates}</Td>
            <Td label="De la">{item.effectiveFrom}</Td>
            <Td label="Până la">{orDash(item.effectiveTo)}</Td>
          </tr>)}
        </tbody>
      </Table>
    </>
