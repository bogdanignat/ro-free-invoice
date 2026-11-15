import type { ProformaAuthoringSession } from "../../hooks/proforma-authoring-session-types.ts"
import { Button } from "../ui/Button.tsx"
import { Card } from "../ui/Card.tsx"
import { CardTitle } from "../ui/CardTitle.tsx"
import { Hint } from "../ui/Hint.tsx"

/**
 * The single write this screen makes, next to what it will produce.
 *
 * No totals are shown: the server computes them when it answers, and a proforma
 * is authored in one request, so there is no saved state to preview against.
 * A missing series never reaches this screen: the page says so before the form.
 */
export const ProformaAuthoringActions = ({ session }: { readonly session: ProformaAuthoringSession }) => {
  const { status } = session
  return <>
    <Card className="grid gap-4">
      <CardTitle>Totaluri</CardTitle>
      <Hint>Totalurile vor fi calculate la salvarea proformei.</Hint>
    </Card>
    <Card className="grid gap-4">
      <CardTitle>Acțiuni proformă</CardTitle>
      <Button fullWidth type="submit" disabled={!status.canSave}>
        {status.pending ? "Se salvează…" : "Salvează proforma"}
      </Button>
      <Hint>Proforma primește un număr la salvare și rămâne imuabilă. Nu este document fiscal și nu se trimite la e-Factura.</Hint>
    </Card>
  </>
}
