import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { useVendorInvoices } from '@/hooks/useProcurement'
import { formatCurrency, formatDate, toNumber } from '@/lib/format'
import { DEFAULT_MATCH_TOLERANCE_PCT } from '@/types/procurement'

export default function VendorInvoiceDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { detail } = useVendorInvoices()
  const { data: inv, isPending, isError } = detail(id)

  if (isPending) return <Loader2 className="h-6 w-6 animate-spin" />
  if (isError || !inv) return <p className="text-destructive">{t('common.error')}</p>

  const tolerance = inv.tolerancePct ?? DEFAULT_MATCH_TOLERANCE_PCT

  return (
    <div className="space-y-4" data-testid="invoice-detail-page">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{inv.invoiceNo}</h1>
          <p className="text-muted-foreground">
            {formatDate(inv.invoiceDate)} · {t('procurement.invoices.due')}:{' '}
            {formatDate(inv.dueDate)}
          </p>
        </div>
        <Badge variant="secondary">{inv.status}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">{t('procurement.invoices.grossAmount')}</p>
          <p className="text-lg font-semibold">{formatCurrency(toNumber(inv.grossAmount))}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">{t('procurement.invoices.tds')}</p>
          <p className="text-lg font-semibold">{formatCurrency(toNumber(inv.tdsAmount ?? 0))}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">{t('procurement.invoices.netPayable')}</p>
          <p className="text-lg font-semibold">
            {formatCurrency(toNumber(inv.netPayable ?? inv.grossAmount))}
          </p>
        </div>
      </div>
      <div className="rounded-md border p-4 text-sm space-y-1">
        <p>
          {t('procurement.invoices.poAmount')}: {formatCurrency(toNumber(inv.poAmount ?? 0))}
        </p>
        <p>
          {t('procurement.invoices.grnAmount')}: {formatCurrency(toNumber(inv.grnAmount ?? 0))}
        </p>
        <p>
          {t('procurement.invoices.tolerance')}: {tolerance}%
        </p>
        <p>
          {t('procurement.invoices.matchStatus')}: {inv.matchStatus ?? '—'}
        </p>
      </div>
    </div>
  )
}
