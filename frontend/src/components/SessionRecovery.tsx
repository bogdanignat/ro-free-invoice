import { ErrorAlert } from "./AsyncState.tsx"
import { Button } from "./ui/Button.tsx"
import { Page } from "./Page.tsx"
import { UnlockCard, UnlockText } from "./UnlockCard.tsx"

export const SessionRecovery = ({ error, onRetry }: { readonly error: unknown; readonly onRetry: () => void }) =>
  <Page title="Sesiunea nu a putut fi verificată" eyebrow="RO Free Invoice">
    <UnlockCard>
      <ErrorAlert error={error} />
      <UnlockText>Conținutul privat rămâne ascuns până când serverul confirmă sesiunea.</UnlockText>
      <Button type="button" onClick={onRetry}>Reîncearcă verificarea</Button>
    </UnlockCard>
  </Page>
