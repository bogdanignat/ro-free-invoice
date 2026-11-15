import type { ReactNode } from "react"

/** A value fixed by the application (the document currency), laid out like a field but not editable. */
export const StaticField = ({ label, children }: { readonly label: ReactNode; readonly children: ReactNode }) =>
  <div className="grid gap-[.42rem] text-invoice-label text-invoice-field font-invoice-label">
    <span>{label}</span>
    <span className="flex items-center min-h-[2.65rem] px-3 py-[.65rem] border border-dashed border-invoice-control-border rounded-invoice-control text-invoice-muted font-bold">{children}</span>
  </div>
