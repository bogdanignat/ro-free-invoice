import { AppLink } from "./ui/AppLink.tsx"
import { Badge } from "./ui/Badge.tsx"
import { Button, buttonClass } from "./ui/Button.tsx"
import { ButtonRow } from "./ui/ButtonRow.tsx"
import { Card } from "./ui/Card.tsx"
import { Field } from "./ui/Field.tsx"
import { SectionHeading } from "./ui/SectionHeading.tsx"
import { Select } from "./ui/Select.tsx"
import { StatusNote } from "./ui/StatusNote.tsx"
import type { ProformaConversionModel } from "../hooks/use-proforma-conversion.ts"
import { CONVERSION_SERIES_MISSING } from "../lib/proforma-conversion.ts"

/**
 * The conversion, rendered from the model and nothing else: which of the two
 * buttons may be pressed, whether a series still has to be chosen and what a
 * proforma already converted links to are all decided in the hook, so this file
 * never asks a question of its own.
 */
const SERIES_NOTE = "proforma-conversion-series-note"
const DUE_DATE_NOTE = "proforma-conversion-due-date-note"

export const ProformaConversionSection = ({ conversion }: { readonly conversion: ProformaConversionModel }) => {
  const { outcome } = conversion
  if (outcome.kind === "unknown") return null
  // Why the buttons are inert, said where a screen reader reaches it: a disabled
  // button is not focusable, so the notes are attached to the control that is.
  const describedBy = [
    conversion.seriesMissing ? SERIES_NOTE : undefined,
    conversion.dueDateIssue === null ? undefined : DUE_DATE_NOTE,
  ].filter((id) => id !== undefined).join(" ")
  return <Card>
    <SectionHeading title="Emitere factură"
      description="Factura preia exact datele și totalurile acestei proforme și primește propriul număr fiscal. O proformă se convertește o singură dată." />
    {conversion.unconfirmedMessage === undefined
      ? null
      : <StatusNote tone="warning" role={null}>{conversion.unconfirmedMessage}</StatusNote>}
    {conversion.alreadyConverted === undefined
      ? null
      : <StatusNote tone="warning">{conversion.alreadyConverted}</StatusNote>}
    {outcome.kind === "available"
      ? <>
        <Field label="Serie factură" required>
          <Select
            value={conversion.selectedSeries}
            disabled={conversion.pending || conversion.seriesOptions.length === 0}
            aria-describedby={describedBy === "" ? undefined : describedBy}
            onChange={(event) => { conversion.selectSeries(event.currentTarget.value) }}
          >
            <option value="" disabled>Alege seria facturii</option>
            {conversion.seriesOptions.map((series) => <option key={series} value={series}>{series}</option>)}
          </Select>
        </Field>
        {conversion.seriesMissing
          ? <StatusNote tone="warning" role={null} id={SERIES_NOTE}>{CONVERSION_SERIES_MISSING} <AppLink href="/settings">Deschide Setări</AppLink></StatusNote>
          : null}
        {conversion.dueDateIssue === null ? null : <StatusNote tone="warning" role={null} id={DUE_DATE_NOTE}>{conversion.dueDateIssue}</StatusNote>}
        <ButtonRow>
          <Button
            disabled={!conversion.canIssueInvoice} onClick={conversion.issueInvoice}
            aria-describedby={conversion.dueDateIssue === null ? undefined : DUE_DATE_NOTE}
          >
            {conversion.pending ? "Operație în curs…" : "Emite factura"}
          </Button>
          <Button variant="secondary" disabled={!conversion.canCreateDraft} onClick={conversion.createDraft}>
            Creează draft de factură
          </Button>
        </ButtonRow>
      </>
      : <>
        <p className="flex flex-wrap gap-[.6rem] items-center mb-4 in-data-[card]:leading-[1.6]">
          <Badge tone={outcome.status.tone}>{outcome.status.label}</Badge>
        </p>
        <AppLink className={buttonClass({ variant: "secondary" })} href={outcome.href}>{outcome.label}</AppLink>
      </>}
  </Card>
}
