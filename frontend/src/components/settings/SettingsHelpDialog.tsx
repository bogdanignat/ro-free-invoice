import { Button } from "../ui/Button.tsx"
import { Eyebrow } from "../ui/Eyebrow.tsx"
import { SettingsHelpIdentity } from "./SettingsHelpIdentity.tsx"
import { SettingsHelpVat } from "./SettingsHelpVat.tsx"
import { useHelpDialog } from "../../hooks/use-help-dialog.ts"

/**
 * The field guide, in a native modal dialog.
 *
 * `<dialog>` with `showModal` is what makes the keyboard behave: the browser
 * keeps Tab inside the dialog, marks the page behind it inert and closes on
 * Escape, none of which a hand-written trap does as reliably. The two closing
 * controls are `form method="dialog"` submits for the same reason — the browser
 * closes the dialog, so there is no state to keep in sync — and the focus is
 * handed back to the button that opened it on the dialog's own `close` event,
 * which Escape fires too.
 */
export const SettingsHelpDialog = () => {
  const [dialog, help] = useHelpDialog()
  return <>
    <Button variant="secondary" aria-haspopup="dialog" onClick={help.open}>
      <span aria-hidden="true">ⓘ</span> Ajutor pentru câmpuri
    </Button>
    <dialog ref={dialog} aria-labelledby="settings-help-title" onClose={help.restoreFocus}
      className="w-[min(46rem,92vw)] max-h-[86vh] p-0 border border-invoice-border rounded-invoice-panel text-invoice-ink bg-invoice-surface backdrop:bg-invoice-ink/45">
      <header className="flex gap-4 items-start justify-between px-6 py-5 border-b border-invoice-border">
        <div><Eyebrow>Ghid de completare</Eyebrow>
          <h2 id="settings-help-title" className="mt-[.2rem] text-[1.15rem]">Ce înseamnă câmpurile din „Date firmă”</h2></div>
        <form method="dialog">
          <button type="submit" aria-label="Închide ghidul"
            className="min-w-[2.2rem] min-h-[2.2rem] border border-invoice-control-border rounded-invoice-control text-invoice-label bg-invoice-surface text-[1.1rem] cursor-pointer hover:border-invoice-control-border-hover">×</button>
        </form>
      </header>
      <div className="grid gap-[1.4rem] max-h-[60vh] px-6 py-5 overflow-y-auto"><SettingsHelpIdentity /><SettingsHelpVat /></div>
      <form className="flex justify-end px-6 py-4 border-t border-invoice-border" method="dialog"><Button type="submit">Am înțeles</Button></form>
    </dialog>
  </>
}
