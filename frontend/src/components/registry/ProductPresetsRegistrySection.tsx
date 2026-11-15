import { Button } from "../ui/Button.tsx"
import { Card } from "../ui/Card.tsx"
import { Count } from "../ui/Count.tsx"
import { EmptyState } from "../AsyncState.tsx"
import { LoadMore } from "../LoadMore.tsx"
import { SectionHeading } from "../ui/SectionHeading.tsx"
import { Table, Td, Th } from "../ui/Table.tsx"
import { money } from "../../lib/money.ts"
import { productKindLabels } from "../../lib/product-preset-form.ts"
import type { ProductPresetRow } from "../../hooks/use-product-presets.ts"

interface ProductPresetsRegistrySectionProps {
  readonly rows: ReadonlyArray<ProductPresetRow>
  readonly editingId: string | undefined
  readonly disabled: boolean
  readonly hasMore: boolean
  readonly loadingMore: boolean
  readonly onLoadMore: () => void
  readonly onEdit: (row: ProductPresetRow) => void
  readonly onDelete: (row: ProductPresetRow) => void
}

/**
 * The saved products, as they are reused on a document: article code, kind,
 * description, EAN, unit, price and the VAT rate the product prefers.
 *
 * The rate is a label the model already resolved — an expired preference reads
 * as such instead of as the issuer's default — so the table decides nothing.
 */
export const ProductPresetsRegistrySection = (props: ProductPresetsRegistrySectionProps) =>
  <Card>
    <SectionHeading title="Produse salvate"
      description="Completează o linie de document dintr-un singur clic. Liniile deja scrise pe documente nu se schimbă când produsul se modifică."
      aside={<Count>{props.rows.length}</Count>} />
    {props.rows.length === 0
      ? <EmptyState>Nu există încă produse salvate.</EmptyState>
      : <Table>
        <thead><tr>
          <Th scope="col">Cod</Th><Th scope="col">Tip</Th><Th scope="col">Descriere</Th>
          <Th scope="col">EAN</Th><Th scope="col">UM</Th>
          <Th scope="col" numeric>Preț unitar</Th><Th scope="col">TVA</Th>
          <Th scope="col"><span className="sr-only">Acțiuni</span></Th>
        </tr></thead>
        <tbody>
          {props.rows.map((row) => <tr key={row.preset.id}>
            <Td label="Cod">{row.preset.code}</Td>
            <Td label="Tip">{productKindLabels[row.preset.kind]}</Td>
            <Td label="Descriere">{row.preset.description}</Td>
            <Td label="EAN">{row.preset.barcode ?? "—"}</Td>
            <Td label="UM">{row.preset.unitOfMeasure.name}</Td>
            <Td label="Preț unitar" numeric>{money(row.preset.unitPrice, "RON")}</Td>
            <Td label="TVA">{row.vatLabel}</Td>
            <Td><div className="flex gap-2 ml-auto">
              <Button variant="secondary" disabled={props.disabled}
                aria-current={props.editingId === row.preset.id ? "true" : undefined}
                onClick={() => { props.onEdit(row) }}>
                Editează<span className="sr-only"> {row.preset.code} {row.preset.description}</span>
              </Button>
              <Button variant="danger" disabled={props.disabled} onClick={() => { props.onDelete(row) }}>
                Șterge<span className="sr-only"> {row.preset.code} {row.preset.description}</span>
              </Button>
            </div></Td>
          </tr>)}
        </tbody>
      </Table>}
    <LoadMore visible={props.hasMore} pending={props.loadingMore} onClick={props.onLoadMore} />
  </Card>
