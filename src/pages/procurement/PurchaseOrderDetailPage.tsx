import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePurchaseOrders } from '@/hooks/useProcurement'
import { formatCurrency, formatDate, toNumber } from '@/lib/format'
import { PO_STATUS_META, type PoStatus } from '@/types/procurement'

export default function PurchaseOrderDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { detail, submit } = usePurchaseOrders()
  const { data: po, isPending, isError } = detail(id)

  if (isPending) return <Loader2 className="h-6 w-6 animate-spin" />
  if (isError || !po) return <p className="text-destructive">{t('common.error')}</p>

  const meta = PO_STATUS_META[po.status as PoStatus]

  return (
    <div className="space-y-4" data-testid="po-detail-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tabular-nums">{po.poNumber}</h1>
          <p className="text-muted-foreground">
            {po.vendor?.name ?? po.vendorId} · {formatCurrency(toNumber(po.totalAmount))}{' '}
            {po.currency}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={meta.badgeVariant} className={meta.badgeClass}>
            {t(meta.labelKey)}
          </Badge>
          {po.status === 'draft' && (
            <Button size="sm" onClick={() => submit.mutate(po.id)} disabled={submit.isPending}>
              {t('procurement.po.submitApproval')}
            </Button>
          )}
          {po.status === 'approved' && (
            <Button size="sm" asChild>
              <Link to={`/procurement/grns/new?poId=${po.id}`}>{t('procurement.grn.create')}</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground">{t('procurement.po.deliveryDate')}: </span>
          {formatDate(po.deliveryDate)}
        </p>
        {po.approvedAt && (
          <p>
            <span className="text-muted-foreground">{t('procurement.approvals.approvedAt')}: </span>
            {formatDate(po.approvedAt)}
            {po.approvedByName ? ` · ${po.approvedByName}` : ''}
          </p>
        )}
        {po.rejectedReason && (
          <p className="text-destructive">
            <span className="text-muted-foreground">{t('procurement.approvals.reason')}: </span>
            {po.rejectedReason}
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left">{t('procurement.po.item')}</th>
              <th className="px-3 py-2 text-right">{t('procurement.po.qty')}</th>
              <th className="px-3 py-2 text-right">{t('procurement.po.price')}</th>
              <th className="px-3 py-2 text-left">{t('procurement.po.uom')}</th>
            </tr>
          </thead>
          <tbody>
            {(po.lines ?? []).map((line) => (
              <tr key={line.id ?? line.itemId} className="border-b">
                <td className="px-3 py-2">
                  {line.itemCode ?? line.itemId}
                  {line.itemName ? ` — ${line.itemName}` : ''}
                </td>
                <td className="px-3 py-2 text-right">{toNumber(line.orderedQty)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(toNumber(line.unitPrice))}</td>
                <td className="px-3 py-2">{line.uom}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
