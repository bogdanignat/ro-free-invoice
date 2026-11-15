import type { ReactNode } from "react"

/**
 * The narrow panel of the sign-in and session screens. It is not a `Card`: only
 * its own paragraphs read muted (`UnlockText`), never those of an alert inside it.
 */
export const UnlockCard = ({ children }: { readonly children: ReactNode }) =>
  <section className="w-[min(430px,100%)] mt-[5vh] mx-auto p-8 border border-invoice-border rounded-invoice-panel bg-invoice-surface shadow-invoice-panel">
    {children}
  </section>

export const UnlockText = ({ children }: { readonly children: ReactNode }) =>
  <p className="text-invoice-muted leading-[1.6]">{children}</p>
