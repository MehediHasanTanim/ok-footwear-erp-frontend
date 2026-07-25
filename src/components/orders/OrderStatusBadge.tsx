import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ORDER_STATUS_META, type OrderStatus } from '@/types/orders'

// ── Props ────────────────────────────────────────────────────────────────────
interface OrderStatusBadgeProps {
  status: OrderStatus
  /** If true, renders a tooltip with the status description */
  showTooltip?: boolean
  className?: string
}

// ── Component ────────────────────────────────────────────────────────────────
export function OrderStatusBadge({ status, showTooltip = true, className }: OrderStatusBadgeProps) {
  const { t } = useTranslation()
  const meta = ORDER_STATUS_META[status]

  if (!meta) {
    return (
      <Badge variant="outline" className={cn('text-muted-foreground', className)}>
        {status}
      </Badge>
    )
  }

  return (
    <span
      role="status"
      title={showTooltip ? t(meta.descriptionKey) : undefined}
      className={cn('inline-block', className)}
    >
      <Badge variant={meta.badgeVariant} className={cn(meta.badgeClass, className)}>
        {t(meta.labelKey)}
      </Badge>
    </span>
  )
}
