import { flexRender, type ColumnDef } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUpDown } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useDataTable } from '@/hooks/useDataTable'

import { DataTablePagination } from './DataTablePagination'
import { DataTableSkeleton } from './DataTableSkeleton'
import { DataTableToolbar } from './DataTableToolbar'

// ── Props ────────────────────────────────────────────────────────────────────
export interface DataTableProps<T extends object> {
  /** Unique ID for persisting column visibility to localStorage */
  tableId: string
  columns: ColumnDef<T>[]
  data: T[]
  /** Total row count for server-side pagination */
  rowCount?: number
  /** Server-side pagination callback */
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
  /** Enable row selection checkbox */
  enableRowSelection?: boolean
  /** Expose selected rows */
  onSelectionChange?: (rows: T[]) => void
  /** Show skeleton while loading */
  loading?: boolean
  /** Page size */
  pageSize?: number
}

// ── Virtual row threshold ────────────────────────────────────────────────────
// Only enable virtual scrolling when rows exceed this count.
// Below this, a plain <tbody> is simpler and avoids virtualization overhead.
const VIRTUAL_THRESHOLD = 100

// ── Component ────────────────────────────────────────────────────────────────
export function DataTable<T extends object>({
  tableId,
  columns,
  data,
  rowCount,
  onPaginationChange,
  enableRowSelection = false,
  onSelectionChange,
  loading = false,
  pageSize = 20,
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = useState('')

  const { table, visibleColumnIds } = useDataTable({
    tableId,
    columns,
    data,
    rowCount,
    onPaginationChange,
    initialPageSize: pageSize,
    globalFilter: searchValue,
    enableRowSelection,
  })

  // Notify parent of selection changes
  const prevSelection = useRef<string>('')
  const selectedRowIds = Object.keys(table.getState().rowSelection).sort().join(',')
  if (selectedRowIds !== prevSelection.current) {
    prevSelection.current = selectedRowIds
    if (onSelectionChange) {
      const rows = table.getSelectedRowModel().rows.map((r) => r.original)
      onSelectionChange(rows)
    }
  }

  // ── Virtual scrolling setup ──────────────────────────────────────────────
  const rows = table.getRowModel().rows
  const shouldVirtualize = rows.length > VIRTUAL_THRESHOLD

  const tableContainerRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: useCallback(() => 48, []), // 48px per row
    overscan: 10,
    enabled: shouldVirtualize,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return (
    <div className="space-y-2">
      <DataTableToolbar
        table={table}
        tableId={tableId}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        visibleColumnIds={visibleColumnIds}
      />

      {/* Scrollable table container */}
      <div
        ref={tableContainerRef}
        className="overflow-auto rounded-md border"
        style={{ maxHeight: shouldVirtualize ? 'calc(100vh - 250px)' : undefined }}
      >
        <table className="w-full border-collapse">
          {/* Header */}
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  return (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          {/* Body — skeleton or virtualized/data rows */}
          <tbody>
            {loading ? (
              <DataTableSkeleton table={table} count={pageSize} />
            ) : shouldVirtualize ? (
              <>
                {/* Spacer for virtual scrolling */}
                <tr>
                  <td colSpan={columns.length} style={{ height: 0 }}>
                    <div style={{ height: `${totalSize}px` }} />
                  </td>
                </tr>
                {virtualItems.map((virtualRow) => {
                  const row = rows[virtualRow.index]
                  if (!row) return null
                  return (
                    <tr
                      key={row.id}
                      className="absolute flex w-full border-b"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="flex items-center px-4"
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  No results found
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DataTablePagination table={table} />
    </div>
  )
}
