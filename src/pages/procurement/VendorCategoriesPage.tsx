import { zodResolver } from '@hookform/resolvers/zod'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { AxiosError } from 'axios'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useVendors } from '@/hooks/useProcurement'
import type { ProblemDetail } from '@/lib/api'
import { selectCan, useAuthStore } from '@/stores/authStore'
import type { VendorCategoryDto } from '@/types/procurement'

const PAGE_SIZE = 50
const columnHelper = createColumnHelper<VendorCategoryDto>()

const categorySchema = z.object({
  code: z.string().min(1, 'Code is required').max(32),
  name: z.string().min(1, 'Name is required').max(120),
})
type CategoryFormData = z.infer<typeof categorySchema>

export default function VendorCategoriesPage() {
  const { t } = useTranslation()
  const canCreate = useAuthStore(selectCan('procurement', 'create'))
  const canUpdate = useAuthStore(selectCan('procurement', 'update'))
  const canDelete = useAuthStore(selectCan('procurement', 'delete'))
  const [page, setPage] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<VendorCategoryDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VendorCategoryDto | null>(null)

  const { categories, createCategory, updateCategory, deleteCategory } = useVendors()
  const { data: rows = [], isPending } = categories()

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { code: '', name: '' },
  })

  const handleClose = useCallback(() => {
    setSheetOpen(false)
    setEditing(null)
    form.reset({ code: '', name: '' })
  }, [form])

  const handleOpenCreate = useCallback(() => {
    setEditing(null)
    form.reset({ code: '', name: '' })
    setSheetOpen(true)
  }, [form])

  const handleOpenEdit = useCallback(
    (cat: VendorCategoryDto) => {
      setEditing(cat)
      form.reset({ code: cat.code, name: cat.name })
      setSheetOpen(true)
    },
    [form]
  )

  const onSubmit = useCallback(
    (values: CategoryFormData) => {
      const dto = { code: values.code.trim().toUpperCase(), name: values.name.trim() }
      if (editing) {
        updateCategory.mutate({ id: editing.id, dto }, { onSuccess: handleClose })
      } else {
        createCategory.mutate(dto, { onSuccess: handleClose })
      }
    },
    [editing, createCategory, updateCategory, handleClose]
  )

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return
    deleteCategory.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (err: unknown) => {
        const detail =
          err instanceof AxiosError
            ? (err.response?.data as ProblemDetail | undefined)?.detail
            : undefined
        toast.error(detail ?? t('procurement.categories.deleteBlocked'))
      },
    })
  }, [deleteTarget, deleteCategory, t])

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('code', {
          header: t('procurement.categories.code'),
          cell: (info) => <span className="font-mono font-medium">{info.getValue()}</span>,
        }),
        columnHelper.accessor('name', {
          header: t('procurement.categories.name'),
        }),
        columnHelper.display({
          id: 'actions',
          header: t('common.actions'),
          cell: ({ row }) => (
            <div className="flex justify-end gap-1">
              {canUpdate && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => handleOpenEdit(row.original)}
                  data-testid={`edit-category-${row.original.id}`}
                  aria-label={t('common.edit')}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {canDelete && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleteTarget(row.original)}
                  data-testid={`delete-category-${row.original.id}`}
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ),
        }),
      ] as ColumnDef<VendorCategoryDto, unknown>[],
    [t, canUpdate, canDelete, handleOpenEdit]
  )

  const paged = useMemo(() => {
    const start = page * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, page])

  const saving = createCategory.isPending || updateCategory.isPending

  return (
    <div className="space-y-4" data-testid="vendor-categories-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('procurement.nav.categories')}</h1>
          <p className="text-muted-foreground">{t('procurement.categories.subtitle')}</p>
        </div>
        {canCreate && (
          <Button onClick={handleOpenCreate} data-testid="new-category-btn">
            <Plus className="mr-2 h-4 w-4" />
            {t('procurement.categories.new')}
          </Button>
        )}
      </div>

      <DataTable
        tableId="vendor-categories"
        columns={columns}
        data={paged}
        rowCount={rows.length}
        pageSize={PAGE_SIZE}
        loading={isPending}
        onPaginationChange={(p) => setPage(p.pageIndex)}
      />

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editing ? t('procurement.categories.edit') : t('procurement.categories.new')}
            </SheetTitle>
          </SheetHeader>
          <form className="mt-4 space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('procurement.categories.code')}</label>
              <Input
                placeholder="RM"
                {...form.register('code')}
                data-testid="category-code-input"
              />
              {form.formState.errors.code && (
                <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('procurement.categories.name')}</label>
              <Input
                placeholder="Raw Materials"
                {...form.register('name')}
                data-testid="category-name-input"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('procurement.categories.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('procurement.categories.deleteDesc', {
                code: deleteTarget?.code,
                name: deleteTarget?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCategory.isPending}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteCategory.isPending}
              data-testid="confirm-delete-category"
            >
              {deleteCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
