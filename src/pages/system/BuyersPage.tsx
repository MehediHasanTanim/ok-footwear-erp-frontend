import { zodResolver } from '@hookform/resolvers/zod'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { DataTable } from '@/components/table/DataTable'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { BUYER_COUNTRIES } from '@/lib/countries'
import { createBuyerSchema, type CreateBuyerFormData } from '@/lib/schemas'
import { selectCan, useAuthStore } from '@/stores/authStore'
import { CURRENCY_CODES, PAYMENT_TERMS, type BuyerDto } from '@/types/orders'

const PAGE_SIZE = 20
const columnHelper = createColumnHelper<BuyerDto>()

const emptyForm: CreateBuyerFormData = {
  name: '',
  currency: 'USD',
  paymentTerms: 'LC_SIGHT',
  creditLimit: 0,
  country: '',
}

export default function BuyersManagementPage() {
  const { t } = useTranslation()
  const canWrite = useAuthStore(selectCan('orders', 'create'))

  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingBuyer, setEditingBuyer] = useState<BuyerDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BuyerDto | null>(null)

  const { list, create, update, remove } = useBuyers()

  const { data: buyersData, isPending } = list({
    search: debouncedSearch || undefined,
    page: page + 1,
    limit: PAGE_SIZE,
  })

  const form = useForm<CreateBuyerFormData>({
    resolver: zodResolver(createBuyerSchema),
    defaultValues: emptyForm,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form

  const handleOpenCreate = useCallback(() => {
    setEditingBuyer(null)
    reset(emptyForm)
    setSheetOpen(true)
  }, [reset])

  const handleOpenEdit = useCallback(
    (buyer: BuyerDto) => {
      setEditingBuyer(buyer)
      reset({
        name: buyer.name,
        currency: buyer.currency,
        paymentTerms: buyer.paymentTerms,
        creditLimit: buyer.creditLimit ?? 0,
        country: buyer.country ?? '',
      })
      setSheetOpen(true)
    },
    [reset]
  )

  const handleClose = useCallback(() => {
    setSheetOpen(false)
    setEditingBuyer(null)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return
    remove.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }, [deleteTarget, remove])

  const onSubmit = useCallback(
    (data: CreateBuyerFormData) => {
      const payload = {
        name: data.name,
        currency: data.currency,
        paymentTerms: data.paymentTerms,
        creditLimit: data.creditLimit,
        country: data.country || undefined,
      }
      if (editingBuyer) {
        update.mutate({ id: editingBuyer.id, dto: payload }, { onSuccess: handleClose })
      } else {
        create.mutate(payload, { onSuccess: handleClose })
      }
    },
    [editingBuyer, create, update, handleClose]
  )

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('name', {
          header: t('buyers.name'),
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        columnHelper.accessor('country', {
          header: t('buyers.country'),
          cell: (info) => info.getValue() ?? '—',
        }),
        columnHelper.accessor('currency', {
          header: t('buyers.currency'),
          cell: (info) => <Badge variant="outline">{info.getValue()}</Badge>,
        }),
        columnHelper.accessor('paymentTerms', {
          header: t('buyers.paymentTerms'),
          cell: (info) => t(`buyers.paymentTermsOptions.${info.getValue()}`),
        }),
        columnHelper.accessor('creditLimit', {
          header: t('buyers.creditLimit'),
          cell: (info) => (
            <span className="tabular-nums">{info.getValue()?.toLocaleString() ?? '—'}</span>
          ),
        }),
        columnHelper.accessor('isActive', {
          header: t('buyers.status'),
          cell: (info) => (
            <Badge variant={info.getValue() !== false ? 'default' : 'secondary'}>
              {info.getValue() !== false ? t('buyers.active') : t('buyers.inactive')}
            </Badge>
          ),
        }),
        columnHelper.display({
          id: 'actions',
          header: '',
          cell: (info) => {
            const buyer = info.row.original
            if (!canWrite) return null
            return (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenEdit(buyer)}
                  aria-label={t('common.edit')}
                  data-testid="buyers-edit-btn"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {buyer.isActive !== false && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(buyer)}
                    aria-label={t('common.delete')}
                    data-testid="buyers-delete-btn"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            )
          },
        }),
      ] as ColumnDef<BuyerDto>[],
    [t, canWrite, handleOpenEdit]
  )

  const isSubmitting = create.isPending || update.isPending

  const countryOptions = useMemo(() => {
    const current = editingBuyer?.country
    if (current && !(BUYER_COUNTRIES as readonly string[]).includes(current)) {
      return [current, ...BUYER_COUNTRIES]
    }
    return [...BUYER_COUNTRIES]
  }, [editingBuyer])

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
        data={buyersData?.data ?? []}
        rowCount={buyersData?.meta?.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={isPending}
        onPaginationChange={(p) => setPage(p.pageIndex)}
      />

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
              <label className="text-sm font-medium">{t('buyers.name')}</label>
              <Input {...register('name')} data-testid="buyers-name" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('buyers.country')}</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('country')}
                data-testid="buyers-country"
              >
                <option value="">{t('buyers.selectCountry')}</option>
                {countryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
              <label className="text-sm font-medium">{t('buyers.paymentTerms')}</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('paymentTerms')}
                data-testid="buyers-payment-terms"
              >
                {PAYMENT_TERMS.map((pt) => (
                  <option key={pt} value={pt}>
                    {t(`buyers.paymentTermsOptions.${pt}`)}
                  </option>
                ))}
              </select>
              {errors.paymentTerms && (
                <p className="text-sm text-destructive">{errors.paymentTerms.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('buyers.creditLimit')}</label>
              <Input
                type="number"
                step="1"
                min="0"
                {...register('creditLimit', { valueAsNumber: true })}
              />
              {errors.creditLimit && (
                <p className="text-sm text-destructive">{errors.creditLimit.message}</p>
              )}
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

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('buyers.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('buyers.deleteDescription', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending} onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={remove.isPending}
              data-testid="buyers-delete-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
