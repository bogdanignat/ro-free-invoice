import type { EditableInvoiceLine } from "../../lib/invoice-authoring-model.ts"
import type { ProductPreset, UnitOfMeasure, VatCatalogue } from "../../lib/draft-models.ts"
import type { LineTotals } from "../../lib/draft-totals-preview.ts"
import { InvoiceLineRow } from "./InvoiceLineRow.tsx"
import { Button } from "../Button.tsx"
import { useFocusAfterRender } from "../../hooks/use-focus-after-render.ts"

interface InvoiceLinesEditorProps {
  readonly lines: ReadonlyArray<EditableInvoiceLine>
  /** The server's preview per line key; the proforma editor shows none. */
  readonly lineTotals?: ReadonlyMap<string, LineTotals>
  readonly productPresets: ReadonlyArray<ProductPreset>
  readonly presetsHasMore: boolean
  readonly presetsLoadingMore: boolean
  readonly onPresetsLoadMore: () => void
  readonly vatRates: ReadonlyArray<VatCatalogue["rates"][number]>
  readonly unitOfMeasures: ReadonlyArray<UnitOfMeasure>
  readonly pending: boolean
  /** Returns the new line's key. */
  readonly onAdd: () => string
  readonly onChange: (key: string, patch: Partial<EditableInvoiceLine>) => void
  readonly onApplyPreset: (lineKey: string, preset: ProductPreset) => void
  readonly onDelete: (line: EditableInvoiceLine) => void
}

/** The lines of the document, and the product presets that prefill them, one cursor page at a time. */
export const InvoiceLinesEditor = (props: InvoiceLinesEditorProps) => {
  const focusAfterRender = useFocusAfterRender()
  const add = () => { focusAfterRender(`line-${props.onAdd()}-description`) }
  return <section className="card authoring-section">
    <div className="section-heading">
      <div><h2>Produse și servicii</h2><p>Alege un produs predefinit sau completează linia manual.</p></div>
      <Button className="secondary small" disabled={props.pending} onClick={add}>Adaugă linie</Button>
    </div>
    {props.presetsHasMore
      ? <p className="hint">
        Se afișează primele produse predefinite.{" "}
        <Button className="secondary small" disabled={props.presetsLoadingMore} onClick={props.onPresetsLoadMore}>
          {props.presetsLoadingMore ? "Se încarcă…" : "Încarcă mai multe produse"}
        </Button>
      </p>
      : null}
    <div className="line-editor-list">
      {props.lines.map((line, index) => <InvoiceLineRow key={line.key} line={line} index={index} totals={props.lineTotals?.get(line.key)}
        productPresets={props.productPresets} vatRates={props.vatRates} unitOfMeasures={props.unitOfMeasures}
        pending={props.pending} onChange={props.onChange} onApplyPreset={props.onApplyPreset} onDelete={props.onDelete}
      />)}
    </div>
    {props.lines.length === 0
      ? <Button className="secondary" disabled={props.pending} onClick={add}>Adaugă prima linie manuală</Button>
      : null}
  </section>
}
