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
import { useArticles } from '@/hooks/useOrders'
import { createArticleSchema, type CreateArticleFormData } from '@/lib/schemas'
import { selectCan, useAuthStore } from '@/stores/authStore'
import { ARTICLE_CATEGORIES, SIZE_SYSTEMS, type ArticleDto } from '@/types/orders'

const PAGE_SIZE = 20
const columnHelper = createColumnHelper<ArticleDto>()

const emptyForm: CreateArticleFormData = {
  code: '',
  description: '',
  category: 'men',
  season: '',
  sizeSystem: 'EU',
}

export default function ArticlesManagementPage() {
  const { t } = useTranslation()
  const canWrite = useAuthStore(selectCan('orders', 'create'))

  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState<ArticleDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ArticleDto | null>(null)

  const { list, create, update, remove } = useArticles()

  const { data: articlesData, isPending } = list({
    search: debouncedSearch || undefined,
    category: categoryFilter || undefined,
    page: page + 1,
    limit: PAGE_SIZE,
  })

  const form = useForm<CreateArticleFormData>({
    resolver: zodResolver(createArticleSchema),
    defaultValues: emptyForm,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form

  const handleOpenCreate = useCallback(() => {
    setEditingArticle(null)
    reset(emptyForm)
    setSheetOpen(true)
  }, [reset])

  const handleOpenEdit = useCallback(
    (article: ArticleDto) => {
      setEditingArticle(article)
      reset({
        code: article.code,
        description: article.description,
        category: article.category ?? '',
        season: article.season ?? '',
        sizeSystem: article.sizeSystem ?? 'EU',
      })
      setSheetOpen(true)
    },
    [reset]
  )

  const handleClose = useCallback(() => {
    setSheetOpen(false)
    setEditingArticle(null)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return
    remove.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }, [deleteTarget, remove])

  const onSubmit = useCallback(
    (data: CreateArticleFormData) => {
      const payload = {
        code: data.code,
        description: data.description,
        category: data.category || undefined,
        season: data.season || undefined,
        sizeSystem: (data.sizeSystem || undefined) as CreateArticleFormData['sizeSystem'],
      }
      if (editingArticle) {
        update.mutate({ id: editingArticle.id, dto: payload }, { onSuccess: handleClose })
      } else {
        create.mutate(payload, { onSuccess: handleClose })
      }
    },
    [editingArticle, create, update, handleClose]
  )

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('code', {
          header: t('articles.code'),
          cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
        }),
        columnHelper.accessor('description', {
          header: t('articles.description'),
          cell: (info) => <span className="max-w-[300px] truncate block">{info.getValue()}</span>,
        }),
        columnHelper.accessor('category', {
          header: t('articles.category'),
          cell: (info) => {
            const value = info.getValue()
            if (!value) return '—'
            const key = `articles.categories.${value}`
            const label = t(key)
            return <Badge variant="secondary">{label === key ? value : label}</Badge>
          },
        }),
        columnHelper.accessor('sizeSystem', {
          header: t('articles.sizeSystem'),
          cell: (info) => <Badge variant="outline">{info.getValue() ?? '—'}</Badge>,
        }),
        columnHelper.accessor('season', {
          header: t('articles.season'),
          cell: (info) => info.getValue() ?? '—',
        }),
        columnHelper.accessor('isActive', {
          header: t('articles.status'),
          cell: (info) => (
            <Badge variant={info.getValue() !== false ? 'default' : 'secondary'}>
              {info.getValue() !== false ? t('articles.active') : t('articles.inactive')}
            </Badge>
          ),
        }),
        columnHelper.display({
          id: 'actions',
          header: '',
          cell: (info) => {
            const article = info.row.original
            if (!canWrite) return null
            return (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenEdit(article)}
                  aria-label={t('common.edit')}
                  data-testid="articles-edit-btn"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {article.isActive !== false && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(article)}
                    aria-label={t('common.delete')}
                    data-testid="articles-delete-btn"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            )
          },
        }),
      ] as ColumnDef<ArticleDto>[],
    [t, canWrite, handleOpenEdit]
  )

  const isSubmitting = create.isPending || update.isPending

  return (
    <div className="space-y-4" data-testid="articles-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('articles.title')}</h1>
        {canWrite && (
          <Button onClick={handleOpenCreate} data-testid="articles-create-btn">
            <Plus className="mr-2 h-4 w-4" />
            {t('articles.addArticle')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t('articles.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          className="max-w-sm"
          data-testid="articles-search"
        />
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value)
            setPage(0)
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t('articles.allCategories')}</option>
          {ARTICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`articles.categories.${c}`)}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        tableId="articles"
        columns={columns}
        data={articlesData?.data ?? []}
        rowCount={articlesData?.meta?.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={isPending}
        onPaginationChange={(p) => setPage(p.pageIndex)}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingArticle ? t('articles.editArticle') : t('articles.addArticle')}
            </SheetTitle>
            <SheetDescription>
              {editingArticle ? t('articles.editDescription') : t('articles.createDescription')}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('articles.code')}</label>
              <Input {...register('code')} data-testid="articles-code" />
              {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('articles.description')}</label>
              <Input {...register('description')} />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('articles.category')}</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('category')}
              >
                <option value="">{t('articles.selectCategory')}</option>
                {ARTICLE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`articles.categories.${c}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('articles.season')}</label>
              <Input {...register('season')} placeholder="SS24" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('articles.sizeSystem')}</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('sizeSystem')}
                data-testid="articles-size-system"
              >
                {SIZE_SYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.sizeSystem && (
                <p className="text-sm text-destructive">{errors.sizeSystem.message}</p>
              )}
            </div>

            <SheetFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="articles-save-btn">
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
            <AlertDialogTitle>{t('articles.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('articles.deleteDescription', { code: deleteTarget?.code ?? '' })}
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
              data-testid="articles-delete-confirm"
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
