import { Badge } from '@/components/ui/badge'

// Maps ConversationStep + isAttending to a planner-friendly label + badge color
type StatusBadgeProps = {
  state: string
  isAttending?: boolean | null
}

const STATE_CONFIG: Record<
  string,
  { label: string; variant: 'secondary' | 'info' | 'warning' | 'success' | 'destructive' | 'outline' }
> = {
  PENDING:             { label: 'Sin contactar',           variant: 'secondary' },
  INITIAL_SENT:        { label: 'Mensaje enviado',         variant: 'info' },
  AWAITING_ATTENDANCE: { label: 'Esperando respuesta',     variant: 'warning' },
  AWAITING_COMPANIONS: { label: 'Esperando acompañantes',  variant: 'warning' },
  AWAITING_DIETARY:    { label: 'Esperando dietética',     variant: 'warning' },
  OPT_OUT:             { label: 'Baja voluntaria',         variant: 'secondary' },
  UNREACHABLE:         { label: 'No alcanzable',           variant: 'destructive' },
}

export function StatusBadge({ state, isAttending }: StatusBadgeProps) {
  if (state === 'COMPLETE') {
    return isAttending
      ? <Badge variant="success">Confirmado</Badge>
      : <Badge variant="destructive">Declinado</Badge>
  }

  const config = STATE_CONFIG[state] ?? { label: state, variant: 'outline' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
