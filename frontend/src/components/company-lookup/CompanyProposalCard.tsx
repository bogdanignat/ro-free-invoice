import { Button } from "../ui/Button.tsx"
import { CardText } from "../ui/CardText.tsx"
import { Hint } from "../ui/Hint.tsx"
import type { CompanyLookupModel } from "../../hooks/use-company-lookup.ts"
import { useCounties } from "../../hooks/use-reference-data.ts"
import type { CompanyProposal } from "../../lib/company-lookup-model.ts"
import {
  proposalAddressReference, proposalHeadline, proposalVatLine, proposalWarnings, type ProposalVatUse,
} from "../../lib/company-proposal-view.ts"

interface CompanyProposalCardProps {
  readonly lookup: CompanyLookupModel
  readonly vat: ProposalVatUse
  readonly disabled: boolean
  /** Copies the proposal into the form; the card then steps aside for this CUI. */
  readonly onApply: (proposal: CompanyProposal) => void
}

/**
 * What a CUI lookup found, offered and never applied on its own: the form
 * changes only on "Completează". The other outcomes are one discreet line, and
 * none of them stops the form from being filled in and saved by hand.
 */
export const CompanyProposalCard = ({ lookup, vat, disabled, onApply }: CompanyProposalCardProps) => {
  const counties = useCounties()
  const { outcome } = lookup
  if (outcome.kind === "idle" || outcome.kind === "applied") return null
  if (outcome.kind === "pending") return <Hint className="col-span-full" role="status">Se caută firma…</Hint>
  if (outcome.kind === "not-found") return <Hint className="col-span-full" role="status">Nu am găsit firma.</Hint>
  if (outcome.kind === "failed") return <Hint tone="warning" className="col-span-full" role="status">{outcome.message}</Hint>
  const { proposal } = outcome
  const address = proposalAddressReference(proposal)
  return <section className="col-span-full grid gap-2 rounded-invoice-control border border-invoice-border bg-invoice-primary-soft p-3"
    aria-label="Firmă găsită">
    <CardText tone="title" role="status">{proposalHeadline(proposal, counties)}</CardText>
    {proposalWarnings(proposal).map((warning) => <Hint key={warning} tone="warning">{warning}</Hint>)}
    <Hint>{proposalVatLine(proposal, vat)}</Hint>
    {address === undefined ? null : <Hint>{address}</Hint>}
    <div>
      <Button size="sm" disabled={disabled} onClick={() => { onApply(proposal); lookup.applied(proposal) }}>
        Completează
      </Button>
    </div>
  </section>
}
