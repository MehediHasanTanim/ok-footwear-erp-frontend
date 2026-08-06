import { ArrowLeft, Pencil, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'

import { ComplaintsTab } from '@/components/orders/ComplaintsTab'
import { MilestoneTimeline } from '@/components/orders/MilestoneTimeline'
import { OrderStatusActions } from '@/components/orders/OrderStatusActions'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { QuotationsTab } from '@/components/orders/QuotationsTab'
import { SamplesTab } from '@/components/orders/SamplesTab'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOrders } from '@/hooks/useOrders'
import { useQuotations, useComplaints } from '@/hooks/useOrderTabs'
import { formatDate, formatCurrency } from '@/lib/format'
import { selectCan, useAuthStore } from '@/stores/authStore'
import type { OrderStatus } from '@/types/orders'

export default function OrderDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canWrite = useAuthStore(selectCan('orders', 'update'))

  const { detail: orderQuery, transitionStatus } = useOrders()

  const { data: order, isPending, isError, error } = orderQuery(id!)

  const isDraft = order?.status === 'draft'
  const orderNotTerminal = order ? !['cancelled', 'delivered'].includes(order.status) : false

  const { list: quotationList } = useQuotations(id!)
  const quotationCount = quotationList.data?.length ?? 0
  const { list: complaintList } = useComplaints(id!)
  const openComplaintCount = (complaintList.data ?? []).filter(
    (c) => c.status !== 'resolved'
  ).length

  const handleTransition = (toStatus: string, cancellationReason?: string) => {
    transitionStatus.mutate({
      id: id!,
      dto: { toStatus: toStatus as OrderStatus, cancellationReason },
    })
  }

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

  const lines = order.orderLines ?? []
  const lineTotal = lines.reduce((s, l) => s + l.quantity, 0)
  const lineValue = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const displayUnitPrice = lines.find((l) => l.unitPrice > 0)?.unitPrice

  return (
    <div className="space-y-6" data-testid="order-detail-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold tabular-nums">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        {isDraft && canWrite && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            {t('common.edit')}
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">{t('orders.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="quotations">
            {t('orders.tabs.quotations')}
            {quotationCount > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 text-xs">
                {quotationCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="samples">
            {t('orders.tabs.samples')}
            {order.sampleApproved ? (
              <span className="ml-1.5 text-green-600 text-xs">✓</span>
            ) : (
              <span className="ml-1.5 text-amber-500 text-xs">●</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="complaints">
            {t('orders.tabs.complaints')}
            {openComplaintCount > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 px-1.5 text-xs text-red-700">
                {openComplaintCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <InfoCard label={t('orders.detail.buyer')} value={order.buyer.name} />
            <InfoCard
              label={t('orders.detail.article')}
              value={`${order.article.code} — ${order.article.description}`}
            />
            <InfoCard
              label={t('orders.detail.deliveryDate')}
              value={formatDate(order.deliveryDate)}
            />
            <InfoCard
              label={t('orders.detail.totalQuantity')}
              value={String(order.totalQuantity)}
            />
            <InfoCard label={t('orders.detail.currency')} value={order.currency} />
            {displayUnitPrice != null && (
              <InfoCard
                label={t('orders.detail.unitPrice')}
                value={formatCurrency(displayUnitPrice)}
              />
            )}
          </div>

          {lines.length > 0 && (
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
                    {lines.map((line) => (
                      <tr key={line.id ?? line.sizeLabel} className="border-b last:border-b-0">
                        <td className="px-4 py-2 tabular-nums">{line.sizeLabel}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{line.quantity}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatCurrency(line.unitPrice)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatCurrency(line.quantity * line.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30 font-medium">
                      <td className="px-4 py-2">{t('orders.detail.total')}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{lineTotal}</td>
                      <td />
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatCurrency(lineValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {order.milestones && order.milestones.length > 0 && (
            <div className="rounded-lg border p-4">
              <h2 className="mb-4 text-sm font-semibold">{t('orders.detail.milestones')}</h2>
              <MilestoneTimeline milestones={order.milestones} />
            </div>
          )}

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
        </TabsContent>

        <TabsContent value="quotations">
          <QuotationsTab
            orderId={id!}
            orderCurrency={order.currency}
            orderNotTerminal={orderNotTerminal}
          />
        </TabsContent>

        <TabsContent value="samples">
          <SamplesTab orderId={id!} sampleApproved={order.sampleApproved} />
        </TabsContent>

        <TabsContent value="complaints">
          <ComplaintsTab orderId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}
