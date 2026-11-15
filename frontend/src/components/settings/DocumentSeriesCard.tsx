import { Button } from "../ui/Button.tsx"
import { ButtonRow } from "../ui/ButtonRow.tsx"
import { Card } from "../ui/Card.tsx"
import { DocumentSeriesTable } from "./DocumentSeriesTable.tsx"
import { ErrorAlert, Loading } from "../AsyncState.tsx"
import { Field } from "../ui/Field.tsx"
import { FieldIssue } from "../registry/FieldIssue.tsx"
import { FormGrid } from "../ui/FormGrid.tsx"
import { Hint } from "../ui/Hint.tsx"
import { Input } from "../ui/Input.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import { Select } from "../ui/Select.tsx"
import { StatusNote } from "../ui/StatusNote.tsx"
import { useRefusedFieldFocus } from "../../hooks/use-refused-field-focus.ts"
import { SERIES_FORM, registryFieldAria } from "../../lib/registry-fields.ts"
import {
  SERIES_MAX_LENGTH, SERIES_PATTERN, documentTypeValue, seriesInputValue,
} from "../../lib/document-series-form.ts"
import type { DocumentSeriesModel } from "../../hooks/use-document-series.ts"

/** The series configured for invoices and proformas, their archive toggle, and the add form under them. */
export const DocumentSeriesCard = ({ model }: { readonly model: DocumentSeriesModel }) => {
  const { load, form, issue } = model
  useRefusedFieldFocus(SERIES_FORM, issue?.field)
  const aria = registryFieldAria(SERIES_FORM, issue?.field)
  return <Card className="grid gap-5" aria-labelledby="document-series-title">
    <SectionHeading id="document-series-title" title="Serii de documente"
      description="Adaugă separat seriile permise pentru facturi și proforme. O serie nu se redenumește și nu se șterge: o serie pe care nu o mai folosești o arhivezi, iar numerotarea ei continuă dacă o reactivezi." />
    {load.kind === "loading" ? <Loading label="Se încarcă seriile…" /> : null}
    {load.kind === "error" ? <ErrorAlert error={load.error} onRetry={model.retry} /> : null}
    {load.kind === "ready" ? <DocumentSeriesTable series={model.series} archiving={model.archiving} onToggleArchived={model.toggleArchived} /> : null}
    {model.notice === undefined ? null : <StatusNote>{model.notice}</StatusNote>}
    {model.archiveError === null || model.archiveError === undefined ? null : <ErrorAlert error={model.archiveError} />}
    {model.error === null || model.error === undefined ? null : <ErrorAlert error={model.error} />}
    <form className="grid gap-[.9rem]"
      onSubmit={(event) => { event.preventDefault(); model.submit() }}>
      <FormGrid>
        <Field label="Tip document" required>
          <Select required disabled={model.pending} value={form.documentType} {...aria("documentType")}
            onChange={(event) => { model.change({ documentType: documentTypeValue(event.currentTarget.value) }) }}>
            <option value="invoice">Factură</option>
            <option value="proforma">Proformă</option>
          </Select>
        </Field>
        <Field label="Serie" required>
          <Input required disabled={model.pending} value={form.series} {...aria("series")}
            maxLength={SERIES_MAX_LENGTH} pattern={SERIES_PATTERN} autoCapitalize="characters" spellCheck={false}
            title="1–20 caractere: litere mari, cifre, underscore sau cratimă"
            onChange={(event) => { model.change({ series: seriesInputValue(event.currentTarget.value) }) }} />
          <FieldIssue issue={issue} field="series" form={SERIES_FORM} />
        </Field>
      </FormGrid>
      <Hint>Folosește 1–20 de caractere: litere mari, cifre, „_” sau „-”. O serie arhivată nu primește documente noi.</Hint>
      <ButtonRow>
        <Button variant="secondary" type="submit" disabled={model.pending || load.kind !== "ready"}>
          {model.pending ? "Se adaugă…" : "Adaugă seria"}
        </Button>
      </ButtonRow>
    </form>
  </Card>
}
