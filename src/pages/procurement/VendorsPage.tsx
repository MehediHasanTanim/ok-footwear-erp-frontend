import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/table/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'
import { useVendors } from '@/hooks/useProcurement'
import type { CreateVendorFormData } from '@/lib/schemas'
import {
  emptyVendorForm,
  VendorFormSheet,
  vendorToFormValues,
} from '@/pages/procurement/VendorFormSheet'
import { selectCan, useAuthStore } from '@/stores/authStore'
import {
  VENDOR_STATUS_META,
  VENDOR_STATUSES,
  type VendorDto,
  type VendorStatus,
} from '@/types/procurement'

const PAGE_SIZE = 20
const columnHelper = createColumnHelper<VendorDto>()

export default function VendorsPage() {
  const { t } = useTranslation()
  const canCreate = useAuthStore(selectCan('procurement', 'create'))
  const canUpdate = useAuthStore(selectCan('procurement', 'update'))
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('')
  const debouncedSearch = useDebounce(search, 300)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<VendorDto | null>(null)

  const { list, create, update, categories } = useVendors()
  const { data, isPending } = list({
    search: debouncedSearch || undefined,
    status: status || undefined,
    page: page + 1,
    limit: PAGE_SIZE,
  })
  const { data: categoryOptions = [] } = categories()

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('vendorCode', {
          header: t('procurement.vendors.code'),
          cell: (info) => (
            <Link
              className="font-medium text-primary hover:underline"
              to={`/procurement/vendors/${info.row.original.id}`}
            >
              {info.getValue()}
            </Link>
          ),
        }),
        columnHelper.accessor('name', { header: t('procurement.vendors.name') }),
        columnHelper.accessor('type', {
          header: t('procurement.vendors.type'),
          cell: (info) => t(`procurement.vendorType.${info.getValue()}`),
        }),
        columnHelper.accessor('status', {
          header: t('procurement.vendors.status'),
          cell: (info) => {
            const meta = VENDOR_STATUS_META[info.getValue() as VendorStatus]
            return (
              <Badge variant={meta.badgeVariant} className={meta.badgeClass}>
                {t(meta.labelKey)}
              </Badge>
            )
          },
        }),
        columnHelper.accessor('rating', {
          header: t('procurement.vendors.rating'),
          cell: (info) => {
            const v = info.getValue()
            return v == null ? '—' : Number(v).toFixed(1)
          },
        }),
        ...(canUpdate
          ? [
              columnHelper.display({
                id: 'actions',
                header: '',
                cell: ({ row }) => (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t('procurement.vendors.edit')}
                    data-testid={`edit-vendor-${row.original.id}`}
                    onClick={() => {
                      setEditing(row.original)
                      setSheetOpen(true)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                ),
              }),
            ]
          : []),
      ] as ColumnDef<VendorDto, unknown>[],
    [t, canUpdate]
  )

  const handleClose = useCallback((open: boolean) => {
    setSheetOpen(open)
    if (!open) setEditing(null)
  }, [])

  const onSubmit = useCallback(
    (values: CreateVendorFormData) => {
      if (editing) {
        update.mutate(
          { id: editing.id, dto: values },
          {
            onSuccess: () => {
              setSheetOpen(false)
              setEditing(null)
            },
          }
        )
        return
      }
      create.mutate(values, {
        onSuccess: () => {
          setSheetOpen(false)
          setEditing(null)
        },
      })
    },
    [create, update, editing]
  )

  return (
    <div className="space-y-4" data-testid="vendors-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('procurement.nav.vendors')}</h1>
        {canCreate && (
          <Button
            onClick={() => {
              setEditing(null)
              setSheetOpen(true)
            }}
            data-testid="new-vendor-btn"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('procurement.vendors.new')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          className="max-w-xs"
        />
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(0)
          }}
        >
          <option value="">{t('procurement.vendors.allStatuses')}</option>
          {VENDOR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(VENDOR_STATUS_META[s].labelKey)}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        tableId="vendors-list"
        columns={columns}
        data={data?.data ?? []}
        rowCount={data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={isPending}
        onPaginationChange={(p) => setPage(p.pageIndex)}
      />

      <VendorFormSheet
        open={sheetOpen}
        onOpenChange={handleClose}
        title={editing ? t('procurement.vendors.edit') : t('procurement.vendors.new')}
        formKey={editing?.id ?? 'new'}
        categories={categoryOptions}
        initialValues={editing ? vendorToFormValues(editing) : emptyVendorForm}
        saving={create.isPending || update.isPending}
        onSubmit={onSubmit}
      />
    </div>
  )
}
