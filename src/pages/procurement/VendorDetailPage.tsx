import { Loader2, Pencil } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useVendors } from '@/hooks/useProcurement'
import type { CreateVendorFormData } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import { VendorFormSheet, vendorToFormValues } from '@/pages/procurement/VendorFormSheet'
import { selectCan, useAuthStore } from '@/stores/authStore'
import { VENDOR_STATUS_META, type VendorStatus } from '@/types/procurement'

function PerformanceGauge({ rating }: { rating: number | null | undefined }) {
  const { t } = useTranslation()
  if (rating == null) {
    return <p className="text-sm text-muted-foreground">—</p>
  }
  const pct = Math.min(100, Math.max(0, (rating / 5) * 100))
  return (
    <div className="space-y-2" data-testid="performance-gauge">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{rating.toFixed(1)}</span>
        <span className="text-sm text-muted-foreground">/ 5</span>
      </div>
      <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('procurement.vendors.performanceHint')}</p>
    </div>
  )
}

export default function VendorDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const canUpdate = useAuthStore(selectCan('procurement', 'update'))
  const { detail, update, categories } = useVendors()
  const { data: vendor, isPending, isError } = detail(id)
  const { data: categoryOptions = [] } = categories()
  const [tab, setTab] = useState('overview')
  const [sheetOpen, setSheetOpen] = useState(false)

  const onSubmit = useCallback(
    (values: CreateVendorFormData) => {
      if (!vendor) return
      update.mutate({ id: vendor.id, dto: values }, { onSuccess: () => setSheetOpen(false) })
    },
    [update, vendor]
  )

  if (isPending) {
    return <Loader2 className="h-6 w-6 animate-spin" />
  }
  if (isError || !vendor) {
    return <p className="text-destructive">{t('common.error')}</p>
  }

  const meta = VENDOR_STATUS_META[vendor.status as VendorStatus]

  return (
    <div className="space-y-4" data-testid="vendor-detail-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{vendor.name}</h1>
          <p className="font-mono text-sm text-muted-foreground">{vendor.vendorCode}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={meta.badgeVariant} className={meta.badgeClass}>
            {t(meta.labelKey)}
          </Badge>
          {canUpdate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="edit-vendor-detail-btn"
              onClick={() => setSheetOpen(true)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {t('procurement.vendors.edit')}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">{t('procurement.vendors.overview')}</TabsTrigger>
          <TabsTrigger value="certs">{t('procurement.vendors.certs')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">{t('procurement.vendors.type')}: </span>
                {t(`procurement.vendorType.${vendor.type}`)}
              </p>
              <p>
                <span className="text-muted-foreground">{t('procurement.vendors.contact')}: </span>
                {vendor.contactName ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('procurement.vendors.email')}: </span>
                {vendor.email ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('procurement.vendors.phone')}: </span>
                {vendor.phone ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t('procurement.vendors.paymentTerms')}:{' '}
                </span>
                {vendor.paymentTerms ?? '—'} {t('procurement.vendors.days')}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t('procurement.vendors.creditLimit')}:{' '}
                </span>
                {vendor.creditLimit ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('procurement.vendors.bank')}: </span>
                {vendor.bankName ?? '—'} {vendor.bankAccount ? `(${vendor.bankAccount})` : ''}
              </p>
              <p>
                <span className="text-muted-foreground">{t('procurement.vendors.notes')}: </span>
                {vendor.notes ?? '—'}
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t('procurement.vendors.performance')}</h3>
              <PerformanceGauge rating={vendor.rating} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="certs" className="space-y-3">
          <div className="rounded-md border p-4 text-sm">
            <p>
              <span className="text-muted-foreground">
                {t('procurement.vendors.tradeLicense')}:{' '}
              </span>
              {vendor.tradeLicense ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">{t('procurement.vendors.tin')}: </span>
              {vendor.tinNumber ?? '—'}
            </p>
            <p className="mt-2">
              <span className="text-muted-foreground">{t('procurement.vendors.address')}: </span>
              {vendor.address ?? '—'}
            </p>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="certs-unavailable">
            {t('procurement.vendors.certsUnavailable')}
          </p>
        </TabsContent>
      </Tabs>

      <VendorFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={t('procurement.vendors.edit')}
        formKey={vendor.id}
        categories={categoryOptions}
        initialValues={vendorToFormValues(vendor)}
        saving={update.isPending}
        onSubmit={onSubmit}
      />
    </div>
  )
}
