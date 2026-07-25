import { zodResolver } from '@hookform/resolvers/zod'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Loader2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { DataTable } from '@/components/table/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useDebounce } from '@/hooks/useDebounce'
import { useBuyers } from '@/hooks/useOrders'
import { createBuyerSchema, type CreateBuyerFormData } from '@/lib/schemas'
import { selectCan, useAuthStore } from '@/stores/authStore'
import { CURRENCY_CODES, type BuyerDto } from '@/types/orders'

const PAGE_SIZE = 20
const columnHelper = createColumnHelper<BuyerDto>()

export default function BuyersManagementPage() {
  const { t } = useTranslation()
  const canWrite = useAuthStore(selectCan('orders', 'create'))

  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingBuyer, setEditingBuyer] = useState<BuyerDto | null>(null)

  const { list, create, update } = useBuyers()

  const { data: buyersData, isPending } = list({
    search: debouncedSearch || undefined,
    page: page + 1,
    limit: PAGE_SIZE,
  })

  // ── Sheet form ─────────────────────────────────────────────────────────────
  const form = useForm<CreateBuyerFormData>({
    resolver: zodResolver(createBuyerSchema),
    defaultValues: {
      buyer_code: '',
      name: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      country: 'Bangladesh',
      payment_terms: 30,
      credit_limit: 0,
      currency: 'USD',
      notes: '',
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form

  const handleOpenCreate = useCallback(() => {
    setEditingBuyer(null)
    reset({
      buyer_code: '',
      name: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      country: 'Bangladesh',
      payment_terms: 30,
      credit_limit: 0,
      currency: 'USD',
      notes: '',
    })
    setSheetOpen(true)
  }, [reset])

  const handleOpenEdit = useCallback(
    (buyer: BuyerDto) => {
      setEditingBuyer(buyer)
      reset({
        buyer_code: buyer.buyer_code,
        name: buyer.name,
        contact_name: buyer.contact_name ?? '',
        email: buyer.email ?? '',
        phone: buyer.phone ?? '',
        address: buyer.address ?? '',
        country: buyer.country,
        payment_terms: buyer.payment_terms,
        credit_limit: buyer.credit_limit,
        currency: buyer.currency,
        notes: buyer.notes ?? '',
      })
      setSheetOpen(true)
    },
    [reset]
  )

  const handleClose = useCallback(() => {
    setSheetOpen(false)
    setEditingBuyer(null)
  }, [])

  const onSubmit = useCallback(
    (data: CreateBuyerFormData) => {
      if (editingBuyer) {
        update.mutate({ id: editingBuyer.id, dto: data }, { onSuccess: handleClose })
      } else {
        create.mutate(data, { onSuccess: handleClose })
      }
    },
    [editingBuyer, create, update, handleClose]
  )

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('buyer_code', {
          header: t('buyers.code'),
          cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
        }),
        columnHelper.accessor('name', {
          header: t('buyers.name'),
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        columnHelper.accessor('country', {
          header: t('buyers.country'),
        }),
        columnHelper.accessor('currency', {
          header: t('buyers.currency'),
          cell: (info) => <Badge variant="outline">{info.getValue()}</Badge>,
        }),
        columnHelper.accessor('payment_terms', {
          header: t('buyers.paymentTerms'),
          cell: (info) => <span className="tabular-nums">{info.getValue()}d</span>,
        }),
        columnHelper.accessor('is_active', {
          header: t('buyers.status'),
          cell: (info) => (
            <Badge variant={info.getValue() ? 'default' : 'secondary'}>
              {info.getValue() ? t('buyers.active') : t('buyers.inactive')}
            </Badge>
          ),
        }),
        columnHelper.display({
          id: 'actions',
          header: '',
          cell: (info) =>
            canWrite ? (
              <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(info.row.original)}>
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null,
        }),
      ] as ColumnDef<BuyerDto>[],
    [t, canWrite, handleOpenEdit]
  )

  const isSubmitting = create.isPending || update.isPending

  return (
    <div className="space-y-4" data-testid="buyers-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('buyers.title')}</h1>
        {canWrite && (
          <Button onClick={handleOpenCreate} data-testid="buyers-create-btn">
            <Plus className="mr-2 h-4 w-4" />
            {t('buyers.addBuyer')}
          </Button>
        )}
      </div>

      {/* Search */}
      <Input
        placeholder={t('buyers.search')}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(0)
        }}
        className="max-w-sm"
        data-testid="buyers-search"
      />

      <DataTable
        tableId="buyers"
        columns={columns}
        data={(buyersData as { data?: BuyerDto[]; meta?: { total: number } })?.data ?? []}
        rowCount={(buyersData as { data?: BuyerDto[]; meta?: { total: number } })?.meta?.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={isPending}
        onPaginationChange={(p) => setPage(p.pageIndex)}
      />

      {/* Slide‑over panel for create/edit */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingBuyer ? t('buyers.editBuyer') : t('buyers.addBuyer')}</SheetTitle>
            <SheetDescription>
              {editingBuyer ? t('buyers.editDescription') : t('buyers.createDescription')}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('buyers.code')}</label>
              <Input {...register('buyer_code')} />
              {errors.buyer_code && (
                <p className="text-sm text-destructive">{errors.buyer_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('buyers.name')}</label>
              <Input {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('buyers.contactName')}</label>
              <Input {...register('contact_name')} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('buyers.email')}</label>
              <Input {...register('email')} type="email" />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('buyers.phone')}</label>
              <Input {...register('phone')} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('buyers.address')}</label>
              <Input {...register('address')} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('buyers.country')}</label>
              <Input {...register('country')} />
              {errors.country && (
                <p className="text-sm text-destructive">{errors.country.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('buyers.paymentTerms')}</label>
                <Input type="number" {...register('payment_terms', { valueAsNumber: true })} />
                {errors.payment_terms && (
                  <p className="text-sm text-destructive">{errors.payment_terms.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('buyers.creditLimit')}</label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('credit_limit', { valueAsNumber: true })}
                />
                {errors.credit_limit && (
                  <p className="text-sm text-destructive">{errors.credit_limit.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('buyers.currency')}</label>
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
              {errors.currency && (
                <p className="text-sm text-destructive">{errors.currency.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('buyers.notes')}</label>
              <Input {...register('notes')} />
            </div>

            <SheetFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="buyers-save-btn">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
