import { useQuery } from '@tanstack/react-query'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { DataTable } from '@/components/table/DataTable'
import { Button } from '@/components/ui/button'
import { useOrders } from '@/hooks/useOrders'
import api from '@/lib/api'
import { formatDateShort } from '@/lib/format'
import {
  type OrderResponseDto,
  type OrderStatus,
  type OrdersFilter,
  ORDER_STATUSES,
} from '@/types/orders'

// ── Helpers ──────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20
const columnHelper = createColumnHelper<OrderResponseDto>()

// ── Component ────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // ── Filter state ──────────────────────────────────────────────────────────
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState<OrderStatus[]>([])
  const [buyerIdFilter, setBuyerIdFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // ── Fetch buyers for filter dropdown ───────────────────────────────────────
  const { data: buyersDropdown } = useQuery({
    queryKey: ['buyers', 'dropdown'],
    queryFn: async () => {
      const { data } = await api.get<{
        data: { id: string; buyer_code: string; name: string; country: string }[]
      }>('/buyers', {
        params: { dropdown: 'true' },
      })
      return data.data
    },
    staleTime: 5 * 60_000,
  })

  // ── Fetch orders ───────────────────────────────────────────────────────────
  const filters: OrdersFilter = {
    page: page + 1,
    limit: PAGE_SIZE,
    search: undefined,
    status: statusFilter.length > 0 ? statusFilter : undefined,
    buyer_id: buyerIdFilter || undefined,
    delivery_date_from: dateFrom || undefined,
    delivery_date_to: dateTo || undefined,
  }

  const { data: ordersData, isPending } = useOrders().list(filters)

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('order_number', {
          header: t('orders.list.orderNumber'),
          cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
        }),
        columnHelper.accessor('buyer', {
          header: t('orders.list.buyer'),
          cell: (info) => <span>{info.getValue().name}</span>,
        }),
        columnHelper.accessor('article', {
          header: t('orders.list.article'),
          cell: (info) => (
            <span className="text-muted-foreground">{info.getValue().article_code}</span>
          ),
        }),
        columnHelper.accessor('total_quantity', {
          header: t('orders.list.totalQty'),
          cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
        }),
        columnHelper.accessor('delivery_date', {
          header: t('orders.list.deliveryDate'),
          cell: (info) => <span>{formatDateShort(info.getValue())}</span>,
        }),
        columnHelper.accessor('status', {
          header: t('orders.list.status'),
          cell: (info) => <OrderStatusBadge status={info.getValue()} />,
        }),
      ] as ColumnDef<OrderResponseDto>[],
    [t]
  )

  // ── Toggle status filter ──────────────────────────────────────────────────
  const toggleStatus = (status: OrderStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
    setPage(0)
  }

  return (
    <div className="space-y-4" data-testid="orders-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('nav.orders')}</h1>
        <Button onClick={() => navigate('/orders/new')} data-testid="orders-new-btn">
          <Plus className="mr-2 h-4 w-4" />
          {t('orders.list.newOrder')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {ORDER_STATUSES.map((status) => (
            <Button
              key={status}
              variant={statusFilter.includes(status) ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleStatus(status)}
              className="h-7 text-xs"
            >
              <OrderStatusBadge
                status={status}
                showTooltip={false}
                className={statusFilter.includes(status) ? 'text-primary-foreground' : ''}
              />
            </Button>
          ))}
        </div>

        {/* Buyer filter */}
        <select
          value={buyerIdFilter}
          onChange={(e) => {
            setBuyerIdFilter(e.target.value)
            setPage(0)
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          data-testid="buyer-filter"
        >
          <option value="">{t('orders.list.allBuyers')}</option>
          {buyersDropdown?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.buyer_code})
            </option>
          ))}
        </select>

        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value)
            setPage(0)
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          data-testid="date-from-filter"
          aria-label={t('orders.list.dateFrom')}
        />
        <span className="text-muted-foreground text-sm">–</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value)
            setPage(0)
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          data-testid="date-to-filter"
          aria-label={t('orders.list.dateTo')}
        />
      </div>

      {/* Table */}
      <DataTable
        tableId="orders-list"
        columns={columns}
        data={ordersData?.data ?? []}
        rowCount={ordersData?.meta?.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={isPending}
        onPaginationChange={(p) => setPage(p.pageIndex)}
      />
    </div>
  )
}
