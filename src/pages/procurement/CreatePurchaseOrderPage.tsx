import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'
import { useItemsSearch, usePurchaseOrders, useVendors } from '@/hooks/useProcurement'
import { formatCurrency, toNumber } from '@/lib/format'
import { CURRENCY_CODES } from '@/types/orders'
import type { StockItemDto } from '@/types/procurement'

interface LineDraft {
  key: string
  itemId: string
  itemCode: string
  itemName: string
  orderedQty: number
  unitPrice: number
  uom: string
}

export default function CreatePurchaseOrderPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { list: vendorList } = useVendors()
  const { data: vendorsData } = vendorList({ dropdown: true, limit: 100 })
  const { create, submit } = usePurchaseOrders()

  const [step, setStep] = useState(1)
  const [vendorId, setVendorId] = useState('')
  const [currency, setCurrency] = useState('BDT')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const debouncedItemSearch = useDebounce(itemSearch, 300)
  const { data: itemResult, isFetching: itemsLoading } = useItemsSearch(debouncedItemSearch)
  const [error, setError] = useState<string | null>(null)

  const selectedVendor = vendorsData?.data.find((v) => v.id === vendorId)
  const total = useMemo(() => lines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0), [lines])

  const addItem = (item: StockItemDto) => {
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        orderedQty: 1,
        unitPrice: 0,
        uom: item.uom ?? 'PCS',
      },
    ])
    setItemSearch('')
  }

  const canNextFrom1 = !!vendorId && !!deliveryDate && !!currency
  const canNextFrom2 = lines.length > 0 && lines.every((l) => l.orderedQty > 0 && l.itemId)

  const handleCreate = async (alsoSubmit: boolean) => {
    setError(null)
    if (selectedVendor && 'status' in selectedVendor && selectedVendor.status === 'blacklisted') {
      setError(t('procurement.po.blacklistedVendor'))
      return
    }
    try {
      const po = await create.mutateAsync({
        vendorId,
        currency,
        deliveryDate,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          orderedQty: l.orderedQty,
          unitPrice: l.unitPrice,
          uom: l.uom,
        })),
      })
      if (alsoSubmit) {
        await submit.mutateAsync(po.id)
      }
      navigate(`/procurement/purchase-orders/${po.id}`)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? t('common.error'))
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="create-po-page">
      <h1 className="text-2xl font-bold">{t('procurement.po.new')}</h1>

      <div className="flex gap-2 text-sm">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`rounded-full px-3 py-1 ${step === n ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          >
            {t(`procurement.po.step${n}`)}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('procurement.po.vendor')}</label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              data-testid="po-vendor-select"
            >
              <option value="">{t('procurement.po.selectVendor')}</option>
              {(vendorsData?.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendorCode} — {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('procurement.po.deliveryDate')}</label>
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              data-testid="po-delivery-date"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('procurement.po.currency')}</label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCY_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('procurement.po.notes')}</label>
            <textarea
              className="h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button disabled={!canNextFrom1} onClick={() => setStep(2)}>
            {t('common.next')}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {itemResult?.unavailable && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {t('procurement.po.itemsUnavailable')}
            </div>
          )}
          <div className="relative space-y-2">
            <label className="text-sm font-medium">{t('procurement.po.searchItem')}</label>
            <Input
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder={t('procurement.po.searchItemPlaceholder')}
              data-testid="po-item-search"
              disabled={itemResult?.unavailable}
            />
            {itemsLoading && <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin" />}
            {(itemResult?.items.length ?? 0) > 0 && (
              <div className="absolute z-10 w-full rounded-md border bg-popover shadow-md">
                {itemResult!.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => addItem(item)}
                  >
                    <span className="font-medium">{item.code}</span> — {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.key} className="grid grid-cols-12 items-end gap-2 rounded border p-2">
                <div className="col-span-4 text-sm">
                  <p className="font-medium">{line.itemCode}</p>
                  <p className="text-xs text-muted-foreground">{line.itemName}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs">{t('procurement.po.qty')}</label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={line.orderedQty}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, orderedQty: parseFloat(e.target.value) || 0 }
                            : l
                        )
                      )
                    }
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs">{t('procurement.po.price')}</label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, unitPrice: parseFloat(e.target.value) || 0 }
                            : l
                        )
                      )
                    }
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs">{t('procurement.po.uom')}</label>
                  <Input
                    value={line.uom}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) => (l.key === line.key ? { ...l, uom: e.target.value } : l))
                      )
                    }
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('procurement.po.noLines')}</p>
            )}
          </div>
          <p className="text-right font-medium">
            {t('procurement.po.total')}: {formatCurrency(total)}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              {t('common.back')}
            </Button>
            <Button disabled={!canNextFrom2} onClick={() => setStep(3)}>
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-md border p-4 text-sm space-y-1">
            <p>
              <strong>{t('procurement.po.vendor')}:</strong>{' '}
              {selectedVendor ? `${selectedVendor.vendorCode} — ${selectedVendor.name}` : vendorId}
            </p>
            <p>
              <strong>{t('procurement.po.deliveryDate')}:</strong> {deliveryDate}
            </p>
            <p>
              <strong>{t('procurement.po.currency')}:</strong> {currency}
            </p>
            <p>
              <strong>{t('procurement.po.lines')}:</strong> {lines.length}
            </p>
            <p>
              <strong>{t('procurement.po.total')}:</strong> {formatCurrency(toNumber(total))}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              {t('common.back')}
            </Button>
            <Button
              variant="secondary"
              disabled={create.isPending || submit.isPending}
              onClick={() => void handleCreate(false)}
            >
              {(create.isPending || submit.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Plus className="mr-2 h-4 w-4" />
              {t('procurement.po.saveDraft')}
            </Button>
            <Button
              disabled={create.isPending || submit.isPending}
              onClick={() => void handleCreate(true)}
              data-testid="po-submit-approval"
            >
              {(create.isPending || submit.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('procurement.po.submitApproval')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
