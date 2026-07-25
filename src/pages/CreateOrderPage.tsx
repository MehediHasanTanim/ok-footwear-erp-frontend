import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Loader2, ShoppingCart } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { SizeRunInputGrid, type SizeRunMap } from '@/components/orders/SizeRunInputGrid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOrders } from '@/hooks/useOrders'
import api from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/format'
import { createOrderSchema, type CreateOrderFormData } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import {
  CURRENCY_CODES,
  ORDER_TYPES,
  type BuyerDropdownDto,
  type ArticleDto,
  type CreateOrderDto,
} from '@/types/orders'

// ── Steps ────────────────────────────────────────────────────────────────────
type WizardStep = 1 | 2 | 3

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'orders.wizard.buyerArticle',
  2: 'orders.wizard.sizeRun',
  3: 'orders.wizard.review',
}

// ── Component ────────────────────────────────────────────────────────────────
export default function CreateOrderPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { create: createMutation } = useOrders()

  const [step, setStep] = useState<WizardStep>(1)
  const [buyerSearch, setBuyerSearch] = useState('')
  const [articleSearch, setArticleSearch] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // ── React Hook Form ────────────────────────────────────────────────────────
  const form = useForm<CreateOrderFormData>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      buyer_id: '',
      article_id: '',
      order_type: 'bulk',
      currency: 'USD',
      unit_price: 0,
      total_quantity: 0,
      delivery_date: '',
      order_lines: [],
    },
    mode: 'onChange',
  })

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors, isValid },
  } = form

  const selectedBuyerId = useWatch({ control, name: 'buyer_id' })
  const selectedArticleId = useWatch({ control, name: 'article_id' })
  const unitPrice = useWatch({ control, name: 'unit_price' })
  const deliveryDate = useWatch({ control, name: 'delivery_date' })

  // ── Fetch buyers for searchable dropdown ────────────────────────────────────
  const { data: buyers, isPending: buyersLoading } = useQuery({
    queryKey: ['buyers', 'dropdown', buyerSearch],
    queryFn: async () => {
      const { data } = await api.get<{ data: BuyerDropdownDto[] }>('/buyers', {
        params: { dropdown: 'true', search: buyerSearch || undefined },
      })
      return data.data
    },
    staleTime: 30_000,
  })

  // ── Fetch articles for searchable dropdown ──────────────────────────────────
  const { data: articles, isPending: articlesLoading } = useQuery({
    queryKey: ['articles', 'list', articleSearch],
    queryFn: async () => {
      const { data } = await api.get<{ data: ArticleDto[] }>('/articles', {
        params: { search: articleSearch || undefined, limit: 50 },
      })
      return data.data
    },
    staleTime: 30_000,
  })

  const selectedBuyer = useMemo(
    () => buyers?.find((b) => b.id === selectedBuyerId),
    [buyers, selectedBuyerId]
  )

  const selectedArticle = useMemo(
    () => articles?.find((a) => a.id === selectedArticleId),
    [articles, selectedArticleId]
  )

  // ── Size run state ─────────────────────────────────────────────────────────
  const [sizeRun, setSizeRun] = useState<SizeRunMap>({})

  const totalQty = useMemo(() => Object.values(sizeRun).reduce((s, q) => s + q, 0), [sizeRun])

  const totalValue = useMemo(() => totalQty * (unitPrice || 0), [totalQty, unitPrice])

  // ── Step validation ────────────────────────────────────────────────────────
  const step1Valid =
    !!selectedBuyerId && !!selectedArticleId && (unitPrice ?? 0) > 0 && !!deliveryDate
  const step2Valid = totalQty > 0

  const canGoNext = step === 1 ? step1Valid : step === 2 ? step2Valid : false

  const handleNext = useCallback(() => {
    if (step < 3) {
      setStep((s) => (s + 1) as WizardStep)
    }
  }, [step])

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((s) => (s - 1) as WizardStep)
    }
  }, [step])

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = useCallback(
    (data: CreateOrderFormData) => {
      setServerError(null)
      setFieldErrors({})

      const orderLines = Object.entries(sizeRun)
        .filter(([, qty]) => qty > 0)
        .map(([size_label, quantity]) => ({ size_label, quantity }))

      const payload: CreateOrderDto = {
        ...data,
        currency: data.currency as CreateOrderDto['currency'],
        total_quantity: totalQty,
        order_lines: orderLines,
      }

      createMutation.mutate(payload, {
        onSuccess: (created) => {
          navigate(`/orders/${created.id}`, { replace: true })
        },
        onError: (err: unknown) => {
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

          // Map server errors back to fields
          if (problem?.errors) {
            const mapped: Record<string, string> = {}
            for (const [field, msgs] of Object.entries(problem.errors)) {
              if (msgs.length > 0 && msgs[0]) mapped[field] = msgs[0]
            }
            setFieldErrors(mapped)
          }
        },
      })
    },
    [sizeRun, totalQty, createMutation, navigate, t]
  )

  // ── Shared Zod error messages ──────────────────────────────────────────────
  const step1FieldErrors = [
    errors.buyer_id,
    errors.article_id,
    errors.unit_price,
    errors.delivery_date,
    errors.currency,
  ]
    .filter(Boolean)
    .map((e) => e?.message)

  const step2FieldErrors = [errors.order_lines].filter(Boolean).map((e) => e?.message)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="create-order-wizard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold">{t('orders.wizard.title')}</h1>
        </div>
      </div>

      {/* Step indicator */}
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

      {/* Server error */}
      {serverError && (
        <div
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          data-testid="wizard-server-error"
        >
          {serverError}
        </div>
      )}

      {/* Step 1: Buyer & Article */}
      {step === 1 && (
        <div className="space-y-4 rounded-lg border p-6" data-testid="wizard-step-1">
          <h2 className="text-lg font-semibold">{t('orders.wizard.selectBuyerArticle')}</h2>

          {/* Buyer selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('orders.wizard.buyer')}</label>
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
              ) : (
                (buyers?.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-muted',
                      selectedBuyerId === b.id && 'bg-primary/10 font-medium'
                    )}
                    onClick={() => {
                      setValue('buyer_id', b.id)
                      // Pre-fill currency from buyer
                      // We fetch buyer detail to get currency — for now set default
                    }}
                  >
                    {b.name} <span className="text-muted-foreground">({b.buyer_code})</span>
                    <span className="ml-2 text-xs text-muted-foreground">{b.country}</span>
                  </button>
                )) ?? <p className="p-3 text-sm text-muted-foreground">{t('common.noResults')}</p>)
              )}
            </div>
            {errors.buyer_id && (
              <p className="text-sm text-destructive">{errors.buyer_id.message}</p>
            )}
          </div>

          {/* Article selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('orders.wizard.article')}</label>
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
              ) : (
                (articles?.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-muted',
                      selectedArticleId === a.id && 'bg-primary/10 font-medium'
                    )}
                    onClick={() => setValue('article_id', a.id)}
                  >
                    {a.article_code} — {a.description}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({a.size_system}) · {a.category}
                    </span>
                  </button>
                )) ?? <p className="p-3 text-sm text-muted-foreground">{t('common.noResults')}</p>)
              )}
            </div>
            {errors.article_id && (
              <p className="text-sm text-destructive">{errors.article_id.message}</p>
            )}
          </div>

          {/* Order type, currency, dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('orders.wizard.orderType')}</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('order_type')}
              >
                {ORDER_TYPES.map((ot) => (
                  <option key={ot} value={ot}>
                    {t(`orders.type.${ot}`)}
                  </option>
                ))}
              </select>
            </div>
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
                {...register('unit_price', { valueAsNumber: true })}
              />
              {errors.unit_price && (
                <p className="text-sm text-destructive">{errors.unit_price.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('orders.wizard.deliveryDate')}</label>
              <Input type="date" {...register('delivery_date')} />
              {errors.delivery_date && (
                <p className="text-sm text-destructive">{errors.delivery_date.message}</p>
              )}
            </div>
          </div>

          {/* Step 1 validation errors */}
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

      {/* Step 2: Size Run Input Grid */}
      {step === 2 && (
        <div className="space-y-4 rounded-lg border p-6" data-testid="wizard-step-2">
          <h2 className="text-lg font-semibold">{t('orders.wizard.sizeRun')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('orders.wizard.sizeRunDescription', {
              article: selectedArticle?.article_code ?? '',
              system: selectedArticle?.size_system ?? 'EU',
            })}
          </p>

          {selectedArticle ? (
            <SizeRunInputGrid
              sizeSystem={selectedArticle.size_system}
              value={sizeRun}
              onChange={setSizeRun}
              unitPrice={unitPrice}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('orders.wizard.selectArticleFirst')}</p>
          )}

          {/* Step 2 validation */}
          {step2FieldErrors.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3">
              {step2FieldErrors.map((msg, i) => (
                <p key={i} className="text-sm text-destructive">
                  {msg}
                </p>
              ))}
            </div>
          )}
          {fieldErrors.order_lines && (
            <p className="text-sm text-destructive">{fieldErrors.order_lines}</p>
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

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-4 rounded-lg border p-6" data-testid="wizard-step-3">
          <h2 className="text-lg font-semibold">{t('orders.wizard.review')}</h2>

          <div className="grid grid-cols-2 gap-3">
            <ReviewItem label={t('orders.wizard.buyer')} value={selectedBuyer?.name ?? ''} />
            <ReviewItem
              label={t('orders.wizard.article')}
              value={`${selectedArticle?.article_code} — ${selectedArticle?.description}`}
            />
            <ReviewItem
              label={t('orders.wizard.orderType')}
              value={t(`orders.type.${getValues('order_type')}`)}
            />
            <ReviewItem label={t('orders.wizard.currency')} value={getValues('currency')} />
            <ReviewItem
              label={t('orders.wizard.unitPrice')}
              value={formatCurrency(getValues('unit_price'))}
            />
            <ReviewItem
              label={t('orders.wizard.deliveryDate')}
              value={formatDate(getValues('delivery_date'))}
            />
            <ReviewItem label={t('orders.wizard.totalQuantity')} value={String(totalQty)} />
            <ReviewItem label={t('orders.wizard.totalValue')} value={formatCurrency(totalValue)} />
          </div>

          {/* Size breakdown summary */}
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

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={step === 1 ? () => navigate('/orders') : handleBack}>
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
            disabled={createMutation.isPending || !isValid}
            data-testid="wizard-submit-btn"
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-4 w-4" />
            )}
            {t('orders.wizard.createOrder')}
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Review Item Helper ───────────────────────────────────────────────────────
function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  )
}
