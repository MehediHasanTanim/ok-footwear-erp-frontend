import { AxiosError } from 'axios'
import { Loader2, Plus, Send } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useQuotations } from '@/hooks/useOrderTabs'
import type { ProblemDetail } from '@/lib/api'
import { formatCurrency, formatDate, toNullableNumber } from '@/lib/format'
import { QUOTATION_STATUS_META, CURRENCY_CODES } from '@/types/orders'
import type { QuotationDto, CloseQuotationDto } from '@/types/orders'

interface Props {
  orderId: string
  orderCurrency: string
  orderNotTerminal: boolean
}

export function QuotationsTab({ orderId, orderCurrency, orderNotTerminal }: Props) {
  const { t } = useTranslation()
  const { list, create, send, close, populateFromBom } = useQuotations(orderId)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [closeTarget, setCloseTarget] = useState<QuotationDto | null>(null)
  const [closeOutcome, setCloseOutcome] = useState<'won' | 'lost'>('lost')
  const [closeReason, setCloseReason] = useState('')
  const [closeError, setCloseError] = useState<string | null>(null)
  const [bomMessage, setBomMessage] = useState<string | null>(null)
  const [bomQuotationId, setBomQuotationId] = useState<string | null>(null)

  // Create form state
  const [quotedPrice, setQuotedPrice] = useState('')
  const [currency, setCurrency] = useState(orderCurrency)
  const [winProb, setWinProb] = useState('50')

  const quotations = list.data ?? []

  const handleCreate = () => {
    create.mutate(
      {
        quotedPrice: parseFloat(quotedPrice) || 0,
        currency: currency as never,
        winProbability: parseInt(winProb) || undefined,
      },
      {
        onSuccess: () => {
          setDrawerOpen(false)
          resetCreateForm()
        },
      }
    )
  }

  const handleSend = (id: string) => send.mutate(id)

  const handleOpenClose = (q: QuotationDto) => {
    setCloseTarget(q)
    setCloseOutcome('lost')
    setCloseReason('')
    setCloseError(null)
    setCloseModalOpen(true)
  }

  const handleClose = () => {
    if (!closeTarget) return
    const dto: CloseQuotationDto = {
      outcome: closeOutcome,
      outcomeReason: closeReason,
    }
    close.mutate(
      { id: closeTarget.id, dto },
      {
        onSuccess: () => {
          setCloseModalOpen(false)
          setCloseTarget(null)
        },
        onError: (err: unknown) => {
          const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } }
          if (axiosErr?.response?.status === 409) {
            setCloseError(axiosErr.response.data?.detail ?? t('quotations.conflictError'))
          }
        },
      }
    )
  }

  const handleBomPopulate = (quotationId: string) => {
    setBomMessage(null)
    setBomQuotationId(quotationId)
    populateFromBom.mutate(
      { id: quotationId },
      {
        onSuccess: () => {
          setBomQuotationId(null)
          setBomMessage(null)
        },
        onError: (err: unknown) => {
          const status = err instanceof AxiosError ? err.response?.status : undefined
          const detail =
            err instanceof AxiosError
              ? (err.response?.data as ProblemDetail | undefined)?.detail
              : undefined
          if (status === 501) {
            setBomMessage(t('quotations.bomNotAvailable'))
          } else {
            setBomMessage(detail ?? t('quotations.bomNotAvailable'))
          }
          setBomQuotationId(null)
        },
      }
    )
  }

  const resetCreateForm = () => {
    setQuotedPrice('')
    setCurrency(orderCurrency)
    setWinProb('50')
  }

  return (
    <div className="space-y-4" data-testid="quotations-tab">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('quotations.title')}</h3>
        {orderNotTerminal && (
          <Button
            size="sm"
            onClick={() => {
              resetCreateForm()
              setDrawerOpen(true)
            }}
            data-testid="new-quotation-btn"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('quotations.newQuotation')}
          </Button>
        )}
      </div>

      {bomMessage && (
        <div
          className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          data-testid="bom-not-available"
        >
          {bomMessage}
        </div>
      )}

      {list.isPending ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : quotations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('quotations.none')}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left">{t('quotations.number')}</th>
                <th className="px-3 py-2 text-left">{t('quotations.status')}</th>
                <th className="px-3 py-2 text-right">{t('quotations.price')}</th>
                <th className="px-3 py-2 text-right">{t('quotations.winProb')}</th>
                <th className="px-3 py-2 text-left">{t('quotations.sentAt')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => {
                const meta = QUOTATION_STATUS_META[q.status]
                const canPopulateBom = q.status === 'draft' || q.status === 'sent'
                const winProbability = toNullableNumber(q.winProbability)
                return (
                  <tr key={q.id} className="border-b">
                    <td className="px-3 py-2 font-medium">{q.quotationNumber}</td>
                    <td className="px-3 py-2">
                      <Badge variant={meta.badgeVariant} className={meta.badgeClass}>
                        {t(meta.labelKey)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(q.quotedPrice)} {q.currency}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {winProbability == null ? '—' : `${winProbability}%`}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {q.sentAt ? formatDate(q.sentAt) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        {canPopulateBom && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBomPopulate(q.id)}
                            disabled={populateFromBom.isPending && bomQuotationId === q.id}
                            data-testid={`bom-populate-btn-${q.id}`}
                          >
                            {populateFromBom.isPending && bomQuotationId === q.id && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            {t('quotations.autoPopulateBom')}
                          </Button>
                        )}
                        {q.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSend(q.id)}
                            disabled={send.isPending}
                          >
                            <Send className="mr-1 h-3 w-3" />
                            {t('quotations.send')}
                          </Button>
                        )}
                        {q.status === 'sent' && (
                          <Button size="sm" variant="outline" onClick={() => handleOpenClose(q)}>
                            {t('quotations.close')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('quotations.newQuotation')}</SheetTitle>
            <SheetDescription>{t('quotations.createDescription')}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>{t('quotations.quotedPrice')}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={quotedPrice}
                onChange={(e) => setQuotedPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('quotations.currency')}</Label>
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
              <Label>
                {t('quotations.winProbability')} ({winProb}%)
              </Label>
              <Input
                type="range"
                min="0"
                max="100"
                value={winProb}
                onChange={(e) => setWinProb(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={create.isPending || !quotedPrice}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Win/loss close modal */}
      <Dialog open={closeModalOpen} onOpenChange={setCloseModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('quotations.closeQuotation')}</DialogTitle>
            <DialogDescription>{t('quotations.closeDescription')}</DialogDescription>
          </DialogHeader>
          {closeError && (
            <div
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              data-testid="close-error"
            >
              {closeError}
            </div>
          )}
          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="outcome"
                  checked={closeOutcome === 'won'}
                  onChange={() => setCloseOutcome('won')}
                />
                {t('quotations.won')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="outcome"
                  checked={closeOutcome === 'lost'}
                  onChange={() => setCloseOutcome('lost')}
                />
                {t('quotations.lost')}
              </label>
            </div>
            <div className="space-y-2">
              <Label>
                {t('quotations.outcomeReason')} <span className="text-destructive">*</span>
              </Label>
              <textarea
                className="h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                data-testid="close-reason-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseModalOpen(false)}
              disabled={close.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleClose}
              disabled={
                close.isPending || !closeReason.trim() || (closeOutcome === 'won' && !!closeError)
              }
            >
              {close.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
