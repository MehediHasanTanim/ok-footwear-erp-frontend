import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { DataTable } from '@/components/table/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePurchaseOrders } from '@/hooks/useProcurement'
import { formatCurrency, formatDateShort, toNumber } from '@/lib/format'
import { selectCan, useAuthStore } from '@/stores/authStore'
import {
  PO_STATUS_META,
  PO_STATUSES,
  type PoStatus,
  type PurchaseOrderDto,
} from '@/types/procurement'

const PAGE_SIZE = 20
const columnHelper = createColumnHelper<PurchaseOrderDto>()

export default function PurchaseOrdersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const canWrite = useAuthStore(selectCan('procurement', 'create'))
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('')
  const { list } = usePurchaseOrders()
  const { data, isPending } = list({
    status: status || undefined,
    page: page + 1,
    limit: PAGE_SIZE,
  })

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('poNumber', {
          header: t('procurement.po.number'),
          cell: (info) => (
            <Link
              className="font-medium text-primary hover:underline"
              to={`/procurement/purchase-orders/${info.row.original.id}`}
            >
              {info.getValue()}
            </Link>
          ),
        }),
        columnHelper.accessor((r) => r.vendor?.name ?? r.vendorId, {
          id: 'vendor',
          header: t('procurement.po.vendor'),
        }),
        columnHelper.accessor('totalAmount', {
          header: t('procurement.po.amount'),
          cell: (info) => formatCurrency(toNumber(info.getValue())),
        }),
        columnHelper.accessor('deliveryDate', {
          header: t('procurement.po.deliveryDate'),
          cell: (info) => formatDateShort(info.getValue()),
        }),
        columnHelper.accessor('status', {
          header: t('procurement.po.status'),
          cell: (info) => {
            const meta = PO_STATUS_META[info.getValue() as PoStatus]
            return (
              <Badge variant={meta.badgeVariant} className={meta.badgeClass}>
                {t(meta.labelKey)}
              </Badge>
            )
          },
        }),
      ] as ColumnDef<PurchaseOrderDto, unknown>[],
    [t]
  )

  return (
    <div className="space-y-4" data-testid="purchase-orders-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('procurement.nav.purchaseOrders')}</h1>
        {canWrite && (
          <Button onClick={() => navigate('/procurement/purchase-orders/new')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('procurement.po.new')}
          </Button>
        )}
      </div>
      <select
        className="h-10 rounded-md border bg-background px-3 text-sm"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value)
          setPage(0)
        }}
      >
        <option value="">{t('procurement.po.allStatuses')}</option>
        {PO_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(PO_STATUS_META[s].labelKey)}
          </option>
        ))}
      </select>
      <DataTable
        tableId="po-list"
        columns={columns}
        data={data?.data ?? []}
        rowCount={data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={isPending}
        onPaginationChange={(p) => setPage(p.pageIndex)}
      />
    </div>
  )
}
