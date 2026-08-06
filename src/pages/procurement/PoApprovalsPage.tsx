import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePurchaseOrders } from '@/hooks/useProcurement'
import { formatCurrency, formatDate, toNumber } from '@/lib/format'
import { selectCan, useAuthStore } from '@/stores/authStore'
import {
  APPROVAL_THRESHOLD_LABEL_KEY,
  approvalThresholdForAmount,
  type PurchaseOrderDto,
} from '@/types/procurement'

export default function PoApprovalsPage() {
  const { t } = useTranslation()
  const canApprove = useAuthStore(selectCan('procurement', 'update'))
  const { list, approve, reject } = usePurchaseOrders()
  const { data, isPending } = list({ status: 'pending_approval', limit: 50 })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<PurchaseOrderDto | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PurchaseOrderDto | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const rows = data?.data ?? []

  return (
    <div className="space-y-4" data-testid="po-approvals-page">
      <div>
        <h1 className="text-2xl font-bold">{t('procurement.nav.approvals')}</h1>
        <p className="text-muted-foreground">{t('procurement.approvals.subtitle')}</p>
      </div>

      {isPending ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('procurement.approvals.empty')}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((po) => {
            const tier = approvalThresholdForAmount(toNumber(po.totalAmount))
            const open = expandedId === po.id
            return (
              <div key={po.id} className="rounded-md border" data-testid={`approval-row-${po.id}`}>
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <button
                    type="button"
                    className="text-left font-medium text-primary hover:underline"
                    onClick={() => setExpandedId(open ? null : po.id)}
                  >
                    {po.poNumber}
                  </button>
                  <span className="text-sm">{po.vendor?.name ?? po.vendorId}</span>
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(toNumber(po.totalAmount))} {po.currency}
                  </span>
                  <Badge variant="secondary" data-testid="threshold-badge">
                    {t(APPROVAL_THRESHOLD_LABEL_KEY[tier])}
                  </Badge>
                  <div className="ml-auto flex gap-2">
                    {canApprove && (
                      <>
                        <Button size="sm" onClick={() => setApproveTarget(po)}>
                          {t('procurement.approvals.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRejectTarget(po)
                            setRejectReason('')
                          }}
                        >
                          {t('procurement.approvals.reject')}
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/procurement/purchase-orders/${po.id}`}>{t('common.view')}</Link>
                    </Button>
                  </div>
                </div>
                {open && (
                  <div
                    className="border-t bg-muted/20 px-3 py-3 text-sm space-y-1"
                    data-testid="email-trail"
                  >
                    <p className="font-semibold">{t('procurement.approvals.trail')}</p>
                    <p className="text-muted-foreground">{t('procurement.approvals.trailHint')}</p>
                    <p>
                      {t('procurement.po.deliveryDate')}: {formatDate(po.deliveryDate)}
                    </p>
                    {po.createdAt && (
                      <p>
                        {t('procurement.approvals.createdAt')}: {formatDate(po.createdAt)}
                      </p>
                    )}
                    {(po.lines?.length ?? 0) > 0 && (
                      <p>
                        {t('procurement.po.lines')}: {po.lines!.length}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('procurement.approvals.approveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('procurement.approvals.approveDesc', { number: approveTarget?.poNumber })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (approveTarget) approve.mutate(approveTarget.id)
                setApproveTarget(null)
              }}
            >
              {t('procurement.approvals.approve')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('procurement.approvals.rejectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('procurement.approvals.rejectDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            className="h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('procurement.approvals.reason')}
            data-testid="reject-reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!rejectReason.trim()}
              onClick={() => {
                if (rejectTarget && rejectReason.trim()) {
                  reject.mutate({ id: rejectTarget.id, dto: { reason: rejectReason.trim() } })
                }
                setRejectTarget(null)
              }}
            >
              {t('procurement.approvals.reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
