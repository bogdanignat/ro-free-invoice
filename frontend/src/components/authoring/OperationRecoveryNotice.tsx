import { AppLink } from "../ui/AppLink.tsx"
import { Button } from "../ui/Button.tsx"
import { Card } from "../ui/Card.tsx"
import { CardText } from "../ui/CardText.tsx"
import { CardTitle } from "../ui/CardTitle.tsx"
import { DISMISS_LABEL, REPLAY_LABEL, type RecoveryNoticeModel } from "../../lib/operation-recovery-view.ts"
import type { RecoveryRecord } from "../../lib/operation-recovery-types.ts"

interface OperationRecoveryNoticeProps {
  readonly notice: RecoveryNoticeModel | undefined
  readonly pending: boolean
  readonly onReplay: (record: RecoveryRecord) => void
  readonly onDismiss: () => void
}

/**
 * The unresolved write, shown. Nothing is sent from here on its own: the replay
 * is a button, and the warning closes only when the user states they checked
 * the registry.
 */
export const OperationRecoveryNotice = ({ notice, pending, onReplay, onDismiss }: OperationRecoveryNoticeProps) => {
  if (notice === undefined) return null
  const record = notice.replay
  return <Card tone="warning" className="grid gap-4" role="alert">
    <CardTitle>{notice.title}</CardTitle>
    <CardText>{notice.message}</CardText>
    {notice.details.length === 0
      ? null
      : <dl>
        {notice.details.map((detail) => <div key={detail.label}>
          <dt>{detail.label}</dt><dd>{detail.value}</dd>
        </div>)}
      </dl>}
    <CardText><AppLink href={notice.link?.href ?? "/invoices"}>{notice.link?.label ?? "Deschide registrul de facturi"}</AppLink></CardText>
    {record === undefined
      ? null
      : <Button fullWidth disabled={pending} onClick={() => { onReplay(record) }}>
        {pending ? "Se retrimite…" : REPLAY_LABEL}
      </Button>}
    {notice.dismissible
      ? <Button variant="secondary" fullWidth onClick={onDismiss}>{DISMISS_LABEL}</Button>
      : null}
  </Card>
}
