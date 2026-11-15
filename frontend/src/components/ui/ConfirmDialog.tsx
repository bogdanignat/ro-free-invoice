import { Button } from "./Button.tsx"
import { useConfirmDialog } from "../../hooks/use-confirm.ts"
import type { ConfirmController } from "../../lib/confirm-controller.ts"

/**
 * The one confirmation of the application, mounted once in `AppProviders`.
 * „Renunță” comes first and takes the focus, so Enter on an open question is
 * a „no”; the message keeps its blank lines as paragraphs.
 */
export const ConfirmDialog = ({ controller }: { readonly controller: ConfirmController }) => {
  const [dialog, refuse, { request, answer, closed }] = useConfirmDialog(controller)
  return <dialog ref={dialog} role="alertdialog" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message"
    onClose={closed}
    className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-invoice-panel border border-invoice-border bg-invoice-surface p-6 text-invoice-ink shadow-invoice-panel backdrop:bg-invoice-ink/45">
    <h2 id="confirm-dialog-title" className="text-lg font-bold">Confirmare</h2>
    <p id="confirm-dialog-message" className="mt-3 whitespace-pre-line leading-relaxed">{request?.message}</p>
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <Button ref={refuse} variant="secondary" onClick={() => { answer(false) }}>Renunță</Button>
      <Button variant={request?.tone === "danger" ? "danger" : "primary"} onClick={() => { answer(true) }}>
        {request?.confirmLabel}
      </Button>
    </div>
  </dialog>
}
