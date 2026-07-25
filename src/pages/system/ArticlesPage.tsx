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
import { useArticles } from '@/hooks/useOrders'
import { createArticleSchema, type CreateArticleFormData } from '@/lib/schemas'
import { selectCan, useAuthStore } from '@/stores/authStore'
import { ARTICLE_CATEGORIES, SIZE_SYSTEMS, type ArticleDto } from '@/types/orders'

const PAGE_SIZE = 20
const columnHelper = createColumnHelper<ArticleDto>()

export default function ArticlesManagementPage() {
  const { t } = useTranslation()
  const canWrite = useAuthStore(selectCan('orders', 'create'))

  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState<ArticleDto | null>(null)

  const { list, create, update } = useArticles()

  const { data: articlesData, isPending } = list({
    search: debouncedSearch || undefined,
    category: categoryFilter || undefined,
    page: page + 1,
    limit: PAGE_SIZE,
  })

  // ── Sheet form ─────────────────────────────────────────────────────────────
  const form = useForm<CreateArticleFormData>({
    resolver: zodResolver(createArticleSchema),
    defaultValues: {
      article_code: '',
      description: '',
      category: 'men',
      sub_category: '',
      gender: '',
      season: '',
      size_system: 'EU',
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form

  const handleOpenCreate = useCallback(() => {
    setEditingArticle(null)
    reset({
      article_code: '',
      description: '',
      category: 'men',
      sub_category: '',
      gender: '',
      season: '',
      size_system: 'EU',
    })
    setSheetOpen(true)
  }, [reset])

  const handleOpenEdit = useCallback(
    (article: ArticleDto) => {
      setEditingArticle(article)
      reset({
        article_code: article.article_code,
        description: article.description,
        category: article.category,
        sub_category: article.sub_category ?? '',
        gender: article.gender ?? '',
        season: article.season ?? '',
        size_system: article.size_system,
      })
      setSheetOpen(true)
    },
    [reset]
  )

  const handleClose = useCallback(() => {
    setSheetOpen(false)
    setEditingArticle(null)
  }, [])

  const onSubmit = useCallback(
    (data: CreateArticleFormData) => {
      if (editingArticle) {
        update.mutate({ id: editingArticle.id, dto: data }, { onSuccess: handleClose })
      } else {
        create.mutate(data, { onSuccess: handleClose })
      }
    },
    [editingArticle, create, update, handleClose]
  )

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('article_code', {
          header: t('articles.code'),
          cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
        }),
        columnHelper.accessor('description', {
          header: t('articles.description'),
          cell: (info) => <span className="max-w-[300px] truncate block">{info.getValue()}</span>,
        }),
        columnHelper.accessor('category', {
          header: t('articles.category'),
          cell: (info) => (
            <Badge variant="secondary">{t(`articles.categories.${info.getValue()}`)}</Badge>
          ),
        }),
        columnHelper.accessor('size_system', {
          header: t('articles.sizeSystem'),
          cell: (info) => <Badge variant="outline">{info.getValue()}</Badge>,
        }),
        columnHelper.accessor('season', {
          header: t('articles.season'),
          cell: (info) => info.getValue() ?? '—',
        }),
        columnHelper.accessor('is_active', {
          header: t('articles.status'),
          cell: (info) => (
            <Badge variant={info.getValue() ? 'default' : 'secondary'}>
              {info.getValue() ? t('articles.active') : t('articles.inactive')}
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

      {/* Filters */}
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
        data={(articlesData as { data?: ArticleDto[]; meta?: { total: number } })?.data ?? []}
        rowCount={
          (articlesData as { data?: ArticleDto[]; meta?: { total: number } })?.meta?.total ?? 0
        }
        pageSize={PAGE_SIZE}
        loading={isPending}
        onPaginationChange={(p) => setPage(p.pageIndex)}
      />

      {/* Slide‑over panel */}
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
              <Input {...register('article_code')} />
              {errors.article_code && (
                <p className="text-sm text-destructive">{errors.article_code.message}</p>
              )}
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
                {ARTICLE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`articles.categories.${c}`)}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('articles.subCategory')}</label>
              <Input {...register('sub_category')} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('articles.gender')}</label>
              <Input {...register('gender')} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('articles.season')}</label>
              <Input {...register('season')} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('articles.sizeSystem')}</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('size_system')}
              >
                {SIZE_SYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.size_system && (
                <p className="text-sm text-destructive">{errors.size_system.message}</p>
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
    </div>
  )
}
