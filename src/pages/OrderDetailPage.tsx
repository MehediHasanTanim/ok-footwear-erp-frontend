import { ArrowLeft, Pencil, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'

import { MilestoneTimeline } from '@/components/orders/MilestoneTimeline'
import { OrderStatusActions } from '@/components/orders/OrderStatusActions'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { Button } from '@/components/ui/button'
import { useOrders } from '@/hooks/useOrders'
import { formatDate, formatCurrency } from '@/lib/format'
import { selectCan, useAuthStore } from '@/stores/authStore'
import type { OrderStatus } from '@/types/orders'

// ── Component ────────────────────────────────────────────────────────────────
export default function OrderDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canWrite = useAuthStore(selectCan('orders', 'update'))

  const { detail: orderQuery, transitionStatus } = useOrders()

  const { data: order, isPending, isError, error } = orderQuery(id!)

  const isDraft = order?.status === 'draft'

  // ── Transition handler ────────────────────────────────────────────────────
  const handleTransition = (toStatus: string, cancellationReason?: string) => {
    transitionStatus.mutate({
      id: id!,
      dto: { toStatus: toStatus as OrderStatus, cancellationReason },
    })
  }

  // ── Loading / Error states ────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="order-detail-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="space-y-4" data-testid="order-detail-error">
        <Button variant="outline" onClick={() => navigate('/orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message || t('orders.detail.notFound')}
        </div>
      </div>
    )
  }

  const lineTotal = order.order_lines?.reduce((s, l) => s + l.quantity, 0) ?? 0
  const lineValue =
    order.order_lines?.reduce((s, l) => s + l.quantity * (l.unit_price ?? order.unit_price), 0) ?? 0

  return (
    <div className="space-y-6" data-testid="order-detail-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold tabular-nums">{order.order_number}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        {isDraft && canWrite && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            {t('common.edit')}
          </Button>
        )}
      </div>

      {/* Key info cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <InfoCard label={t('orders.detail.buyer')} value={order.buyer.name} />
        <InfoCard
          label={t('orders.detail.article')}
          value={`${order.article.article_code} — ${order.article.description}`}
        />
        <InfoCard label={t('orders.detail.deliveryDate')} value={formatDate(order.delivery_date)} />
        <InfoCard label={t('orders.detail.totalQuantity')} value={String(order.total_quantity)} />
        <InfoCard
          label={t('orders.detail.orderType')}
          value={t(`orders.type.${order.order_type}`)}
        />
        <InfoCard label={t('orders.detail.currency')} value={order.currency} />
        <InfoCard label={t('orders.detail.unitPrice')} value={formatCurrency(order.unit_price)} />
        {order.pi_number && <InfoCard label="PI" value={order.pi_number} />}
        {order.lc_number && <InfoCard label="LC" value={order.lc_number} />}
      </div>

      {/* Remarks */}
      {order.remarks && (
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">{t('orders.detail.remarks')}</p>
          <p className="mt-1 text-sm">{order.remarks}</p>
        </div>
      )}

      {/* Size breakdown */}
      {order.order_lines && order.order_lines.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">{t('orders.detail.sizeBreakdown')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">{t('orders.detail.size')}</th>
                  <th className="px-4 py-2 text-right font-medium">
                    {t('orders.detail.quantity')}
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    {t('orders.detail.unitPrice')}
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    {t('orders.detail.lineValue')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.order_lines.map((line) => (
                  <tr key={line.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2 tabular-nums">{line.size_label}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{line.quantity}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(line.unit_price ?? order.unit_price)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(line.quantity * (line.unit_price ?? order.unit_price))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-medium">
                  <td className="px-4 py-2">{t('orders.detail.total')}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{lineTotal}</td>
                  <td />
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(lineValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Milestone Timeline */}
      {order.milestones && order.milestones.length > 0 && (
        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-sm font-semibold">{t('orders.detail.milestones')}</h2>
          <MilestoneTimeline milestones={order.milestones} />
        </div>
      )}

      {/* Status Actions */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">{t('orders.detail.actions')}</h2>
            {!isDraft && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('orders.detail.editDisabledTooltip')}
              </p>
            )}
          </div>
          <OrderStatusActions
            nextAllowedStates={order.nextAllowedStates}
            currentStatus={order.status}
            onTransition={handleTransition}
            isTransitioning={transitionStatus.isPending}
            transitionError={
              transitionStatus.error
                ? ((transitionStatus.error as { response?: { data?: { detail?: string } } })
                    ?.response?.data?.detail ?? t('orders.detail.transitionFailed'))
                : null
            }
            disabled={!canWrite}
          />
        </div>
      </div>
    </div>
  )
}

// ── Info Card Helper ─────────────────────────────────────────────────────────
function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  )
}
