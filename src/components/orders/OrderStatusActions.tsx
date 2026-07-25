import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import type { OrderStatus } from '@/types/orders'
import { ORDER_STATUS_META } from '@/types/orders'

// ── Props ────────────────────────────────────────────────────────────────────
interface OrderStatusActionsProps {
  /** The `nextAllowedStates` array from the API — single source of truth */
  nextAllowedStates: OrderStatus[]
  /** The order's current status, used for UX messaging */
  currentStatus: OrderStatus
  /** Called when the user confirms a transition */
  onTransition: (toStatus: OrderStatus, cancellationReason?: string) => void
  /** True when a transition mutation is in-flight */
  isTransitioning?: boolean
  /** RFC 7807 error detail from a failed transition */
  transitionError?: string | null
  disabled?: boolean
}

// ── Which transitions need explicit confirmation text (not just OK/Cancel) ───
const IRREVERSIBLE_TRANSITIONS: OrderStatus[] = ['cancelled', 'in_production']

// ── Component ────────────────────────────────────────────────────────────────
export function OrderStatusActions({
  nextAllowedStates,
  currentStatus,
  onTransition,
  isTransitioning = false,
  transitionError,
  disabled = false,
}: OrderStatusActionsProps) {
  const { t } = useTranslation()
  const [confirmTarget, setConfirmTarget] = useState<OrderStatus | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [confirmationText, setConfirmationText] = useState('')

  const isIrreversible = confirmTarget ? IRREVERSIBLE_TRANSITIONS.includes(confirmTarget) : false
  const isCancellation = confirmTarget === 'cancelled'

  const handleConfirm = () => {
    if (!confirmTarget) return
    onTransition(confirmTarget, isCancellation ? cancellationReason : undefined)
    setConfirmTarget(null)
    setCancellationReason('')
    setConfirmationText('')
  }

  const handleOpen = (status: OrderStatus) => {
    setConfirmTarget(status)
    setCancellationReason('')
    setConfirmationText('')
  }

  const handleClose = () => {
    setConfirmTarget(null)
    setCancellationReason('')
    setConfirmationText('')
  }

  if (nextAllowedStates.length === 0) {
    return null
  }

  // Build confirmation requirements
  const requireConfirmationText = isIrreversible
  const confirmTextRequired = requireConfirmationText
    ? t('orders.actions.confirmText', {
        status: confirmTarget ? t(ORDER_STATUS_META[confirmTarget]?.labelKey ?? '') : '',
      })
    : ''
  const confirmDisabled =
    isTransitioning ||
    (requireConfirmationText &&
      confirmationText.trim().toLowerCase() !== confirmTarget?.replace('_', ' ').toLowerCase()) ||
    (isCancellation && !cancellationReason.trim())

  return (
    <div className="flex flex-wrap gap-2" data-testid="order-status-actions">
      {nextAllowedStates.map((status) => {
        const meta = ORDER_STATUS_META[status]
        const isDestructive = ['cancelled'].includes(status)
        return (
          <Button
            key={status}
            variant={isDestructive ? 'destructive' : 'default'}
            size="sm"
            disabled={disabled || isTransitioning}
            onClick={() => handleOpen(status)}
            data-testid={`transition-btn-${status}`}
          >
            {t(meta?.labelKey ?? status)}
          </Button>
        )
      })}

      {/* Confirmation Modal */}
      <Dialog open={!!confirmTarget} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('orders.actions.confirmTitle', {
                from: t(ORDER_STATUS_META[currentStatus]?.labelKey ?? currentStatus),
                to: confirmTarget
                  ? t(ORDER_STATUS_META[confirmTarget]?.labelKey ?? confirmTarget)
                  : '',
              })}
            </DialogTitle>
            <DialogDescription>
              {isIrreversible
                ? t('orders.actions.irreversibleWarning')
                : t('orders.actions.confirmDescription')}
            </DialogDescription>
          </DialogHeader>

          {/* RFC 7807 error display */}
          {transitionError && (
            <div
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              data-testid="transition-error"
            >
              {transitionError}
            </div>
          )}

          {/* Cancellation reason input */}
          {isCancellation && (
            <div className="space-y-2">
              <Label htmlFor="cancellation-reason">
                {t('orders.actions.cancellationReason')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cancellation-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder={t('orders.actions.cancellationReasonPlaceholder')}
                data-testid="cancellation-reason-input"
              />
            </div>
          )}

          {/* Explicit confirmation text for irreversible transitions */}
          {requireConfirmationText && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('orders.actions.typeToConfirm', { text: confirmTextRequired })}
              </p>
              <Input
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder={confirmTextRequired}
                data-testid="confirm-text-input"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isTransitioning}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={isCancellation ? 'destructive' : 'default'}
              onClick={handleConfirm}
              disabled={confirmDisabled}
              data-testid="confirm-transition-btn"
            >
              {isTransitioning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
