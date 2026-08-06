import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Check, Loader2, ShoppingCart } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { SizeRunInputGrid, type SizeRunMap } from '@/components/orders/SizeRunInputGrid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useArticles, useBuyers, useOrders } from '@/hooks/useOrders'
import { formatDate, formatCurrency } from '@/lib/format'
import { createOrderSchema, type CreateOrderFormData } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import { CURRENCY_CODES, type CreateOrderDto, type UpdateOrderDto } from '@/types/orders'

type WizardStep = 1 | 2 | 3

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'orders.wizard.buyerArticle',
  2: 'orders.wizard.sizeRun',
  3: 'orders.wizard.review',
}

export default function CreateOrderPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id: editOrderId } = useParams<{ id?: string }>()
  const isEditMode = Boolean(editOrderId)

  const { create: createMutation, update: updateMutation, detail: orderDetail } = useOrders()
  const { list: listBuyers } = useBuyers()
  const { list: listArticles } = useArticles()

  const [step, setStep] = useState<WizardStep>(1)
  const [buyerSearch, setBuyerSearch] = useState('')
  const [articleSearch, setArticleSearch] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [sizeRun, setSizeRun] = useState<SizeRunMap>({})
  const [hydrated, setHydrated] = useState(!isEditMode)

  const form = useForm<CreateOrderFormData>({
    resolver: zodResolver(createOrderSchema, undefined, { raw: true }),
    defaultValues: {
      buyerId: '',
      articleId: '',
      currency: 'USD',
      unitPrice: 0,
      totalQuantity: 0,
      deliveryDate: '',
      orderLines: [],
    },
    mode: 'onChange',
  })

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    trigger,
    control,
    formState: { errors },
  } = form

  const selectedBuyerId = useWatch({ control, name: 'buyerId' })
  const selectedArticleId = useWatch({ control, name: 'articleId' })
  const unitPrice = useWatch({ control, name: 'unitPrice' })
  const deliveryDate = useWatch({ control, name: 'deliveryDate' })

  const {
    data: existingOrder,
    isPending: orderLoading,
    isError: orderError,
  } = orderDetail(editOrderId ?? '', { enabled: isEditMode })

  useEffect(() => {
    if (!isEditMode || !existingOrder || hydrated) return

    if (existingOrder.status !== 'draft') {
      navigate(`/orders/${existingOrder.id}`, { replace: true })
      return
    }

    const lines = existingOrder.orderLines ?? []
    const sizeMap: SizeRunMap = {}
    for (const line of lines) {
      sizeMap[line.sizeLabel] = line.quantity
    }
    const lineUnitPrice = lines.find((l) => l.unitPrice > 0)?.unitPrice ?? 0

    reset({
      buyerId: existingOrder.buyerId,
      articleId: existingOrder.articleId,
      currency: existingOrder.currency,
      unitPrice: lineUnitPrice,
      totalQuantity: existingOrder.totalQuantity,
      deliveryDate: existingOrder.deliveryDate,
      orderLines: lines.map((l) => ({
        sizeLabel: l.sizeLabel,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    })
    setSizeRun(sizeMap)
    setHydrated(true)
  }, [isEditMode, existingOrder, hydrated, reset, navigate])

  useEffect(() => {
    const price = Number(unitPrice) || 0
    const orderLines = Object.entries(sizeRun)
      .filter(([, qty]) => qty > 0)
      .map(([sizeLabel, quantity]) => ({
        sizeLabel,
        quantity,
        unitPrice: price,
      }))
    const total = orderLines.reduce((s, l) => s + l.quantity, 0)
    // Avoid full-form validation on every keystroke in step 1 (clears selection UX).
    // Re-validate once the size run has quantities so submit can succeed.
    const shouldValidate = orderLines.length > 0 && price > 0
    setValue('orderLines', orderLines, { shouldValidate, shouldDirty: true })
    setValue('totalQuantity', total || 0, { shouldValidate, shouldDirty: true })
  }, [sizeRun, unitPrice, setValue])

  const {
    data: buyersPage,
    isPending: buyersLoading,
    isError: buyersError,
    refetch: refetchBuyers,
  } = listBuyers({
    search: buyerSearch || undefined,
    page: 1,
    limit: 50,
  })

  const {
    data: articlesPage,
    isPending: articlesLoading,
    isError: articlesError,
  } = listArticles({
    search: articleSearch || undefined,
    page: 1,
    limit: 50,
  })

  const buyers = useMemo(() => buyersPage?.data ?? [], [buyersPage?.data])
  const articles = useMemo(() => articlesPage?.data ?? [], [articlesPage?.data])

  const selectBuyer = useCallback(
    (buyer: (typeof buyers)[number]) => {
      setValue('buyerId', buyer.id, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      })
      if (buyer.currency && (CURRENCY_CODES as readonly string[]).includes(buyer.currency)) {
        setValue('currency', buyer.currency, {
          shouldValidate: true,
          shouldDirty: true,
        })
      }
    },
    [setValue]
  )

  const selectArticle = useCallback(
    (article: (typeof articles)[number]) => {
      setValue('articleId', article.id, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      })
    },
    [setValue]
  )

  const selectedBuyer = useMemo(() => {
    const fromList = buyers.find((b) => b.id === selectedBuyerId)
    if (fromList) return fromList
    if (existingOrder?.buyerId === selectedBuyerId) return existingOrder.buyer
    return undefined
  }, [buyers, selectedBuyerId, existingOrder])

  const selectedArticle = useMemo(() => {
    const fromList = articles.find((a) => a.id === selectedArticleId)
    if (fromList) return fromList
    if (existingOrder?.articleId === selectedArticleId) {
      return {
        ...existingOrder.article,
        category: undefined,
        isActive: true,
      }
    }
    return undefined
  }, [articles, selectedArticleId, existingOrder])

  const totalQty = useMemo(() => Object.values(sizeRun).reduce((s, q) => s + q, 0), [sizeRun])
  const totalValue = useMemo(() => totalQty * (unitPrice || 0), [totalQty, unitPrice])

  const step1Valid =
    !!selectedBuyerId && !!selectedArticleId && (unitPrice ?? 0) > 0 && !!deliveryDate
  const step2Valid = totalQty > 0
  const canGoNext = step === 1 ? step1Valid : step === 2 ? step2Valid : false
  // Do not gate on RHF isValid — size-run sync uses shouldValidate:false so isValid
  // stays false even when the wizard data is complete.
  const canSubmit = step1Valid && step2Valid

  const handleNext = useCallback(() => {
    if (step === 2) {
      // Re-validate once size lines exist so submit-time resolver errors stay accurate.
      void trigger()
    }
    if (step < 3) setStep((s) => (s + 1) as WizardStep)
  }, [step, trigger])

  const handleBack = useCallback(() => {
    if (step > 1) setStep((s) => (s - 1) as WizardStep)
  }, [step])

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const onSubmit = useCallback(
    (data: CreateOrderFormData) => {
      setServerError(null)
      setFieldErrors({})

      const orderLines = Object.entries(sizeRun)
        .filter(([, qty]) => qty > 0)
        .map(([sizeLabel, quantity]) => ({
          sizeLabel,
          quantity,
          unitPrice: data.unitPrice,
        }))

      const handleError = (err: unknown) => {
        const axiosErr = err as {
          response?: {
            status?: number
            data?: {
              detail?: string
              errors?: Record<string, string[]>
            }
          }
        }
        const problem = axiosErr?.response?.data
        setServerError(problem?.detail ?? t('orders.wizard.createFailed'))

        if (problem?.errors) {
          const mapped: Record<string, string> = {}
          for (const [field, msgs] of Object.entries(problem.errors)) {
            if (msgs.length > 0 && msgs[0]) mapped[field] = msgs[0]
          }
          setFieldErrors(mapped)
        }
      }

      if (isEditMode && editOrderId) {
        // OpenAPI UpdateOrderDto — no orderLines on PATCH
        const payload: UpdateOrderDto = {
          currency: data.currency as UpdateOrderDto['currency'],
          totalQuantity: totalQty,
          deliveryDate: data.deliveryDate,
        }

        updateMutation.mutate(
          { id: editOrderId, dto: payload },
          {
            onSuccess: (updated) => {
              navigate(`/orders/${updated.id}`, { replace: true })
            },
            onError: handleError,
          }
        )
        return
      }

      const payload: CreateOrderDto = {
        buyerId: data.buyerId,
        articleId: data.articleId,
        currency: data.currency as CreateOrderDto['currency'],
        totalQuantity: totalQty,
        deliveryDate: data.deliveryDate,
        orderLines,
      }

      createMutation.mutate(payload, {
        onSuccess: (created) => {
          navigate(`/orders/${created.id}`, { replace: true })
        },
        onError: handleError,
      })
    },
    [sizeRun, totalQty, createMutation, updateMutation, navigate, t, isEditMode, editOrderId]
  )

  const step1FieldErrors = [
    errors.buyerId,
    errors.articleId,
    errors.unitPrice,
    errors.deliveryDate,
    errors.currency,
  ]
    .filter(Boolean)
    .map((e) => e?.message)

  const step2FieldErrors = [errors.orderLines].filter(Boolean).map((e) => e?.message)

  if (isEditMode && orderLoading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="create-order-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isEditMode && (orderError || !existingOrder)) {
    return (
      <div className="space-y-4" data-testid="create-order-error">
        <Button variant="outline" onClick={() => navigate('/orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {t('orders.detail.notFound')}
        </div>
      </div>
    )
  }

  const buyerCode = selectedBuyer && 'code' in selectedBuyer ? selectedBuyer.code : undefined
  const articleCode = selectedArticle?.code ?? existingOrder?.article.code
  const sizeSystem = selectedArticle?.sizeSystem ?? existingOrder?.article.sizeSystem ?? 'EU'

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="create-order-wizard">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(isEditMode && editOrderId ? `/orders/${editOrderId}` : '/orders')
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold">
            {isEditMode ? t('orders.wizard.editTitle') : t('orders.wizard.title')}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                step === s && 'bg-primary text-primary-foreground',
                step > s && 'bg-green-600 text-white',
                step < s && 'bg-muted text-muted-foreground'
              )}
            >
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            <span className={cn('text-sm', step === s ? 'font-medium' : 'text-muted-foreground')}>
              {t(STEP_LABELS[s as WizardStep])}
            </span>
            {s < 3 && <div className="mx-2 h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {serverError && (
        <div
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          data-testid="wizard-server-error"
        >
          {serverError}
        </div>
      )}

      {/* Always mounted so buyer/article selection survives step changes */}
      <input type="hidden" {...register('buyerId')} />
      <input type="hidden" {...register('articleId')} />

      {step === 1 && (
        <div className="space-y-4 rounded-lg border p-6" data-testid="wizard-step-1">
          <h2 className="text-lg font-semibold">{t('orders.wizard.selectBuyerArticle')}</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('orders.wizard.buyer')}</label>
            {isEditMode ? (
              <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {selectedBuyer?.name ?? existingOrder?.buyer.name}
                {buyerCode && <span className="text-muted-foreground"> ({buyerCode})</span>}
              </p>
            ) : (
              <>
                <Input
                  placeholder={t('orders.wizard.searchBuyer')}
                  value={buyerSearch}
                  onChange={(e) => setBuyerSearch(e.target.value)}
                />
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {buyersLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : buyersError ? (
                    <div className="space-y-2 p-3">
                      <p className="text-sm text-destructive">
                        {t('orders.wizard.loadBuyersFailed')}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void refetchBuyers()}
                      >
                        {t('common.retry', { defaultValue: 'Retry' })}
                      </Button>
                    </div>
                  ) : buyers.length > 0 ? (
                    buyers.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm hover:bg-muted',
                          selectedBuyerId === b.id && 'bg-primary/10 font-medium'
                        )}
                        onClick={() => selectBuyer(b)}
                        data-testid={`wizard-buyer-${b.id}`}
                      >
                        {b.name}
                        {b.code && <span className="text-muted-foreground"> ({b.code})</span>}
                        {b.country && (
                          <span className="ml-2 text-xs text-muted-foreground">{b.country}</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-sm text-muted-foreground">{t('common.noResults')}</p>
                  )}
                </div>
              </>
            )}
            {errors.buyerId && <p className="text-sm text-destructive">{errors.buyerId.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('orders.wizard.article')}</label>
            {isEditMode ? (
              <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {articleCode} — {selectedArticle?.description ?? existingOrder?.article.description}
              </p>
            ) : (
              <>
                <Input
                  placeholder={t('orders.wizard.searchArticle')}
                  value={articleSearch}
                  onChange={(e) => setArticleSearch(e.target.value)}
                />
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {articlesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : articlesError ? (
                    <p className="p-3 text-sm text-destructive">
                      {t('orders.wizard.loadArticlesFailed')}
                    </p>
                  ) : articles.length > 0 ? (
                    articles.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm hover:bg-muted',
                          selectedArticleId === a.id && 'bg-primary/10 font-medium'
                        )}
                        onClick={() => selectArticle(a)}
                        data-testid={`wizard-article-${a.id}`}
                      >
                        {a.code} — {a.description}
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({a.sizeSystem ?? 'EU'}){a.category ? ` · ${a.category}` : ''}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-sm text-muted-foreground">{t('common.noResults')}</p>
                  )}
                </div>
              </>
            )}
            {errors.articleId && (
              <p className="text-sm text-destructive">{errors.articleId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('orders.wizard.currency')}</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('currency')}
              >
                {CURRENCY_CODES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('orders.wizard.unitPrice')}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register('unitPrice', { valueAsNumber: true })}
              />
              {errors.unitPrice && (
                <p className="text-sm text-destructive">{errors.unitPrice.message}</p>
              )}
            </div>
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium">{t('orders.wizard.deliveryDate')}</label>
              <Input type="date" {...register('deliveryDate')} />
              {errors.deliveryDate && (
                <p className="text-sm text-destructive">{errors.deliveryDate.message}</p>
              )}
            </div>
          </div>

          {step1FieldErrors.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3">
              {step1FieldErrors.map((msg, i) => (
                <p key={i} className="text-sm text-destructive">
                  {msg}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-lg border p-6" data-testid="wizard-step-2">
          <h2 className="text-lg font-semibold">{t('orders.wizard.sizeRun')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('orders.wizard.sizeRunDescription', {
              article: articleCode ?? '',
              system: sizeSystem,
            })}
          </p>

          {selectedArticle || existingOrder?.article ? (
            <SizeRunInputGrid
              sizeSystem={sizeSystem}
              value={sizeRun}
              onChange={setSizeRun}
              unitPrice={unitPrice}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('orders.wizard.selectArticleFirst')}</p>
          )}

          {step2FieldErrors.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3">
              {step2FieldErrors.map((msg, i) => (
                <p key={i} className="text-sm text-destructive">
                  {msg}
                </p>
              ))}
            </div>
          )}
          {fieldErrors.orderLines && (
            <p className="text-sm text-destructive">{fieldErrors.orderLines}</p>
          )}

          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm">
              <span className="font-medium">{t('orders.wizard.runningTotal')}: </span>
              {totalQty} {t('orders.wizard.pairs')}
              {unitPrice > 0 && (
                <span className="ml-2 text-muted-foreground">({formatCurrency(totalValue)})</span>
              )}
            </p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 rounded-lg border p-6" data-testid="wizard-step-3">
          <h2 className="text-lg font-semibold">{t('orders.wizard.review')}</h2>

          {(errors.buyerId ||
            errors.articleId ||
            errors.unitPrice ||
            errors.deliveryDate ||
            errors.orderLines ||
            errors.totalQuantity ||
            errors.currency) && (
            <div
              className="rounded-md bg-destructive/10 p-3 space-y-1"
              data-testid="wizard-review-errors"
            >
              {[
                errors.buyerId?.message,
                errors.articleId?.message,
                errors.currency?.message,
                errors.unitPrice?.message,
                errors.deliveryDate?.message,
                errors.totalQuantity?.message,
                errors.orderLines?.message,
                typeof errors.orderLines === 'object' &&
                !Array.isArray(errors.orderLines) &&
                'root' in errors.orderLines
                  ? (errors.orderLines as { root?: { message?: string } }).root?.message
                  : undefined,
              ]
                .filter(Boolean)
                .map((msg, i) => (
                  <p key={i} className="text-sm text-destructive">
                    {msg}
                  </p>
                ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <ReviewItem
              label={t('orders.wizard.buyer')}
              value={selectedBuyer?.name ?? existingOrder?.buyer.name ?? ''}
            />
            <ReviewItem
              label={t('orders.wizard.article')}
              value={`${articleCode} — ${selectedArticle?.description ?? existingOrder?.article.description}`}
            />
            <ReviewItem label={t('orders.wizard.currency')} value={getValues('currency')} />
            <ReviewItem
              label={t('orders.wizard.unitPrice')}
              value={formatCurrency(getValues('unitPrice'))}
            />
            <ReviewItem
              label={t('orders.wizard.deliveryDate')}
              value={formatDate(getValues('deliveryDate'))}
            />
            <ReviewItem label={t('orders.wizard.totalQuantity')} value={String(totalQty)} />
            <ReviewItem label={t('orders.wizard.totalValue')} value={formatCurrency(totalValue)} />
          </div>

          <div className="rounded-md border p-3">
            <h3 className="mb-2 text-sm font-medium">{t('orders.wizard.sizeBreakdown')}</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(sizeRun)
                .filter(([, qty]) => qty > 0)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([size, qty]) => (
                  <span key={size} className="rounded-md bg-muted px-2 py-1 text-xs">
                    {size}: <strong>{qty}</strong>
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={
            step === 1
              ? () => navigate(isEditMode && editOrderId ? `/orders/${editOrderId}` : '/orders')
              : handleBack
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {step === 1 ? t('common.cancel') : t('common.back')}
        </Button>

        {step < 3 ? (
          <Button onClick={handleNext} disabled={!canGoNext} data-testid="wizard-next-btn">
            {t('common.next')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting || !canSubmit}
            data-testid="wizard-submit-btn"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-4 w-4" />
            )}
            {isEditMode ? t('orders.wizard.saveOrder') : t('orders.wizard.createOrder')}
          </Button>
        )}
      </div>
    </div>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  )
}
