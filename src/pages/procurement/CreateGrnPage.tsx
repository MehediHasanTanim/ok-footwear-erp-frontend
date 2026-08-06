import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGoodsReceipts, usePurchaseOrders } from '@/hooks/useProcurement'
import { toNumber } from '@/lib/format'
import { isValidGrnQtySplit } from '@/types/procurement'

interface LineEdit {
  poLineId: string
  itemLabel: string
  orderedQty: number
  receivedQty: number
  acceptedQty: number
  rejectedQty: number
  rejectionReason: string
  unitCost: number
  file?: File | null
}

export default function CreateGrnPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const poIdParam = params.get('poId') ?? ''
  const [poId, setPoId] = useState(poIdParam)
  const { list: poList, detail: poDetail } = usePurchaseOrders()
  const { data: approvedPos } = poList({ status: 'approved', limit: 50 })
  const { data: po, isPending: poLoading } = poDetail(poId, { enabled: !!poId })
  const { create, uploadPhoto, submitQc } = useGoodsReceipts()

  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10))
  const [vehicleNo, setVehicleNo] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineEdit[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!po?.lines) return
    setLines(
      po.lines.map((l) => ({
        poLineId: l.id ?? l.itemId,
        itemLabel: `${l.itemCode ?? l.itemId}${l.itemName ? ` — ${l.itemName}` : ''}`,
        orderedQty: toNumber(l.orderedQty),
        receivedQty: toNumber(l.orderedQty),
        acceptedQty: toNumber(l.orderedQty),
        rejectedQty: 0,
        rejectionReason: '',
        unitCost: toNumber(l.unitPrice),
        file: null,
      }))
    )
  }, [po])

  const qtyValid = useMemo(
    () => lines.every((l) => isValidGrnQtySplit(l.receivedQty, l.acceptedQty, l.rejectedQty)),
    [lines]
  )

  const handleSubmit = async (alsoQc: boolean) => {
    setError(null)
    if (!poId || lines.length === 0) {
      setError(t('procurement.grn.selectPo'))
      return
    }
    if (!qtyValid) {
      setError(t('procurement.grn.qtyInvalid'))
      return
    }
    try {
      const grn = await create.mutateAsync({
        poId,
        receiptDate,
        vehicleNo: vehicleNo || undefined,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          poLineId: l.poLineId,
          receivedQty: l.receivedQty,
          acceptedQty: l.acceptedQty,
          rejectedQty: l.rejectedQty,
          rejectionReason: l.rejectionReason || undefined,
          unitCost: l.unitCost,
          qcStatus: l.rejectedQty > 0 ? 'rejected' : 'accepted',
        })),
      })
      for (const line of lines) {
        if (line.file && grn.lines) {
          const created = grn.lines.find((gl) => gl.poLineId === line.poLineId)
          if (created?.id) {
            await uploadPhoto.mutateAsync({
              grnId: grn.id,
              lineId: created.id,
              file: line.file,
            })
          }
        }
      }
      if (alsoQc) {
        await submitQc.mutateAsync(grn.id)
      }
      navigate(`/procurement/invoices`)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? t('common.error'))
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4" data-testid="grn-entry-page">
      <h1 className="text-2xl font-bold">{t('procurement.grn.title')}</h1>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('procurement.grn.po')}</label>
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={poId}
          onChange={(e) => setPoId(e.target.value)}
          data-testid="grn-po-select"
        >
          <option value="">{t('procurement.grn.selectPo')}</option>
          {(approvedPos?.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.poNumber} — {p.vendor?.name ?? p.vendorId}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium">{t('procurement.grn.receiptDate')}</label>
          <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">{t('procurement.grn.vehicle')}</label>
          <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">{t('procurement.grn.notes')}</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {poLoading && poId ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={line.poLineId} className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">
                {line.itemLabel}{' '}
                <span className="text-muted-foreground">
                  ({t('procurement.po.qty')}: {line.orderedQty})
                </span>
              </p>
              <div className="grid gap-2 sm:grid-cols-4">
                <div>
                  <label className="text-xs">{t('procurement.grn.received')}</label>
                  <Input
                    type="number"
                    min={0}
                    value={line.receivedQty}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, receivedQty: parseFloat(e.target.value) || 0 } : l
                        )
                      )
                    }
                  />
                </div>
                <div>
                  <label className="text-xs">{t('procurement.grn.accepted')}</label>
                  <Input
                    type="number"
                    min={0}
                    value={line.acceptedQty}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, acceptedQty: parseFloat(e.target.value) || 0 } : l
                        )
                      )
                    }
                  />
                </div>
                <div>
                  <label className="text-xs">{t('procurement.grn.rejected')}</label>
                  <Input
                    type="number"
                    min={0}
                    value={line.rejectedQty}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, rejectedQty: parseFloat(e.target.value) || 0 } : l
                        )
                      )
                    }
                  />
                </div>
                <div>
                  <label className="text-xs">{t('procurement.grn.photo')}</label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, file: e.target.files?.[0] ?? null } : l
                        )
                      )
                    }
                  />
                </div>
              </div>
              <Input
                placeholder={t('procurement.grn.qcNote')}
                value={line.rejectionReason}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, rejectionReason: e.target.value } : l))
                  )
                }
              />
              {!isValidGrnQtySplit(line.receivedQty, line.acceptedQty, line.rejectedQty) && (
                <p className="text-xs text-destructive">{t('procurement.grn.qtyInvalid')}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={!qtyValid || create.isPending || lines.length === 0}
          onClick={() => void handleSubmit(false)}
        >
          {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('procurement.grn.saveDraft')}
        </Button>
        <Button
          disabled={!qtyValid || create.isPending || submitQc.isPending || lines.length === 0}
          onClick={() => void handleSubmit(true)}
          data-testid="grn-submit-qc"
        >
          {(create.isPending || submitQc.isPending) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {t('procurement.grn.submitQc')}
        </Button>
      </div>
    </div>
  )
}
