import { money } from "./money.ts"
import type { EFacturaStatus, InvoiceRegisterRow } from "./invoice-register.ts"
import { spvDeadlineNote, spvLabel, type SpvDeadlineNote, type SpvStatus } from "./spv-status.ts"

/**
 * The register row as a table renders it: every field already a string.
 *
 * Keeping the shaping here rather than in the table means the labels, the
 * dashes for absent fields and the detail links are all testable without
 * rendering anything, and the component is left with markup only.
 */
export interface InvoiceRegisterPresentationRow {
  readonly key: string
  readonly number: string
  readonly kindLabel: "Storno" | null
  readonly documentHref: string
  readonly customerName: string
  readonly issueDate: string
  readonly dueDate: string
  readonly total: string
  readonly status: string
  readonly statusClass: string
  /** The SPV deadline of a document still to resolve, with its tone; `null` when nothing is left to do. */
  readonly deadline: SpvDeadlineNote | null
  readonly originalInvoice: { readonly label: string; readonly href: string } | null
}

const statusLabels: Readonly<Record<EFacturaStatus, string>> = {
  not_sent: "Netrimisă",
  queued: "În procesare",
  processing: "În procesare",
  accepted: "Acceptată",
  rejected: "Respinsă",
  refused: "Refuzată",
  unknown: "Necunoscut",
}

/**
 * One label per status, for the register row and the document head alike.
 *
 * The same invoice is named in both places; localizing it here and in the
 * detail projection separately is how `Netrimisă` in the list and `not_sent`
 * on the document came to be two answers to the same question.
 */
export const eFacturaStatusLabel = (status: EFacturaStatus): string => statusLabels[status]

export type BadgeTone = "muted" | "info" | "positive" | "danger"

/** The badge class of a status: what needs a person's attention reads in the danger colour. */
export const eFacturaStatusTone = (status: EFacturaStatus): BadgeTone => {
  if (status === "accepted") return "positive"
  if (status === "queued" || status === "processing") return "info"
  return status === "not_sent" ? "muted" : "danger"
}

/** The register's SPV group in the same tones: failed and unknown need a person. */
const spvTone = (spv: SpvStatus | null): BadgeTone => {
  if (spv === null || spv.state === "not_sent") return "muted"
  if (spv.state === "in_progress") return "info"
  return spv.state === "accepted" ? "positive" : "danger"
}

/** `.badge` paints its own background, so the danger tone only colours the text. */
export const badgeClass = (tone: BadgeTone): string => tone === "danger" ? "badge text-invoice-danger-text" : `badge ${tone}`

export const invoiceDetailHref = (id: string): string => `/invoices/${encodeURIComponent(id)}`
export const correctionDetailHref = (id: string): string => `/corrections/${encodeURIComponent(id)}`

export const projectInvoiceRegisterRow = (row: InvoiceRegisterRow): InvoiceRegisterPresentationRow => ({
  key: `${row.kind}:${row.id}`,
  number: `${row.series} ${String(row.number)}`,
  kindLabel: row.kind === "correction" ? "Storno" : null,
  documentHref: row.kind === "invoice" ? invoiceDetailHref(row.id) : correctionDetailHref(row.id),
  customerName: row.customer.name,
  issueDate: row.issueDate,
  dueDate: row.dueDate ?? "—",
  total: money(row.totalIncludingVat, row.currency),
  status: spvLabel(row.spv),
  statusClass: badgeClass(spvTone(row.spv)),
  deadline: spvDeadlineNote(row.spv),
  originalInvoice: row.kind === "correction"
    ? {
      label: `Factura inițială ${row.originalReference.series} ${String(row.originalReference.number)}`,
      href: invoiceDetailHref(row.originalReference.id),
    }
    : null,
})
