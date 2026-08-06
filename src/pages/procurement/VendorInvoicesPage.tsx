import { AxiosError } from 'axios'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useGoodsReceipts,
  usePurchaseOrders,
  useVendorInvoices,
  useVendors,
} from '@/hooks/useProcurement'
import { formatCurrency, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DEFAULT_MATCH_TOLERANCE_PCT } from '@/types/procurement'

export default function VendorInvoicesPage() {
  const { t } = useTranslation()
  const { list: vendorList } = useVendors()
  const { data: vendorsData } = vendorList({ limit: 100 })
  const { list: poList } = usePurchaseOrders()
  const { data: posData } = poList({ status: 'approved', limit: 50 })
  const { list: invList, create } = useVendorInvoices()
  const { data: invoices, isPending } = invList({ limit: 50 })
  const { byPo } = useGoodsReceipts()

  const [vendorId, setVendorId] = useState('')
  const [poId, setPoId] = useState('')
  const [grnId, setGrnId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [currency] = useState('BDT')
  const [grossAmount, setGrossAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const { data: grnsForPo } = byPo(poId)
  const selectedPo = posData?.data.find((p) => p.id === poId)
  const selectedGrn = (grnsForPo ?? []).find((g) => g.id === grnId)
  const poAmount = toNumber(selectedPo?.totalAmount ?? 0)
  const grnAmount = useMemo(() => {
    if (!selectedGrn?.lines?.length) return poAmount
    return selectedGrn.lines.reduce(
      (s, l) => s + toNumber(l.acceptedQty ?? 0) * toNumber(l.unitCost ?? 0),
      0
    )
  }, [selectedGrn, poAmount])
  const invoiceAmt = parseFloat(grossAmount) || 0
  const tolerancePct = DEFAULT_MATCH_TOLERANCE_PCT
  const maxAllowed = poAmount * (1 + tolerancePct / 100)
  const variancePct = poAmount > 0 ? Math.abs(((invoiceAmt - poAmount) / poAmount) * 100) : 0
  const withinTolerance = invoiceAmt <= maxAllowed || poAmount === 0

  const handleMatch = async () => {
    setError(null)
    setCreatedId(null)
    if (!vendorId || !grnId || !invoiceNo || !dueDate || !invoiceAmt) {
      setError(t('procurement.invoices.required'))
      return
    }
    try {
      const inv = await create.mutateAsync({
        vendorId,
        grnId,
        invoiceNo,
        invoiceDate,
        dueDate,
        currency,
        grossAmount: invoiceAmt,
      })
      setCreatedId(inv.id)
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.status === 422) {
        setError(
          (err.response.data as { detail?: string })?.detail ??
            t('procurement.invoices.toleranceExceeded')
        )
      } else {
        setError(t('common.error'))
      }
    }
  }

  return (
    <div className="space-y-6" data-testid="invoice-match-page">
      <div>
        <h1 className="text-2xl font-bold">{t('procurement.nav.invoices')}</h1>
        <p className="text-muted-foreground">{t('procurement.invoices.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-md border p-4">
          <h2 className="font-semibold">{t('procurement.invoices.matchForm')}</h2>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          {createdId && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
              {t('procurement.invoices.created')}{' '}
              <Link className="underline" to={`/procurement/invoices/${createdId}`}>
                {createdId.slice(0, 8)}
              </Link>
            </div>
          )}
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="">{t('procurement.po.selectVendor')}</option>
            {(vendorsData?.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.vendorCode} — {v.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={poId}
            onChange={(e) => {
              setPoId(e.target.value)
              setGrnId('')
            }}
          >
            <option value="">{t('procurement.grn.selectPo')}</option>
            {(posData?.data ?? [])
              .filter((p) => !vendorId || p.vendorId === vendorId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.poNumber}
                </option>
              ))}
          </select>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={grnId}
            onChange={(e) => setGrnId(e.target.value)}
            disabled={!poId}
          >
            <option value="">{t('procurement.invoices.selectGrn')}</option>
            {(grnsForPo ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.grnNumber}
              </option>
            ))}
          </select>
          <Input
            placeholder={t('procurement.invoices.invoiceNo')}
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder={t('procurement.invoices.grossAmount')}
            value={grossAmount}
            onChange={(e) => setGrossAmount(e.target.value)}
          />
          <Button
            disabled={!withinTolerance || create.isPending}
            onClick={() => void handleMatch()}
            data-testid="invoice-approve-match"
          >
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('procurement.invoices.approveMatch')}
          </Button>
        </div>

        <div className="space-y-4 rounded-md border p-4" data-testid="three-way-match">
          <h2 className="font-semibold">{t('procurement.invoices.threeWay')}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label={t('procurement.invoices.poAmount')} value={formatCurrency(poAmount)} />
            <Metric label={t('procurement.invoices.grnAmount')} value={formatCurrency(grnAmount)} />
            <Metric
              label={t('procurement.invoices.invoiceAmount')}
              value={formatCurrency(invoiceAmt)}
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>{t('procurement.invoices.tolerance')}</span>
              <span>
                {variancePct.toFixed(1)}% / {tolerancePct}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  withinTolerance ? 'bg-green-500' : 'bg-red-500'
                )}
                style={{
                  width: `${Math.min(100, (variancePct / Math.max(tolerancePct, 0.1)) * 50)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {withinTolerance
                ? t('procurement.invoices.withinTolerance')
                : t('procurement.invoices.toleranceExceeded')}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">{t('procurement.invoices.list')}</h2>
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (invoices?.data.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t('procurement.invoices.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left">{t('procurement.invoices.invoiceNo')}</th>
                  <th className="px-3 py-2 text-right">{t('procurement.invoices.grossAmount')}</th>
                  <th className="px-3 py-2 text-left">{t('procurement.invoices.status')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices!.data.map((inv) => (
                  <tr key={inv.id} className="border-b">
                    <td className="px-3 py-2">
                      <Link
                        className="text-primary hover:underline"
                        to={`/procurement/invoices/${inv.id}`}
                      >
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(toNumber(inv.grossAmount))}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{inv.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
