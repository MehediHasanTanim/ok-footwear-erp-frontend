import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'

import { useDebounce } from '@/hooks/useDebounce'

// ── localStorage key for column visibility ──────────────────────────────────
function visibilityKey(tableId: string): string {
  return `ok-erp-table-visibility-${tableId}`
}

function loadVisibility(tableId: string): VisibilityState {
  try {
    const raw = localStorage.getItem(visibilityKey(tableId))
    return raw ? (JSON.parse(raw) as VisibilityState) : {}
  } catch {
    return {}
  }
}

function saveVisibility(tableId: string, state: VisibilityState): void {
  localStorage.setItem(visibilityKey(tableId), JSON.stringify(state))
}

// ── Hook options ─────────────────────────────────────────────────────────────
interface UseDataTableOptions<T extends object> {
  tableId: string
  columns: ColumnDef<T>[]
  data: T[]
  /** Total row count (for server-side pagination) */
  rowCount?: number
  /** Server-side pagination: called when page changes */
  onPaginationChange?: (pagination: PaginationState) => void
  /** Initial page size */
  initialPageSize?: number
  /** Global search filter — applied to ALL string columns */
  globalFilter?: string
  /** Enable row selection via checkbox column */
  enableRowSelection?: boolean
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useDataTable<T extends object>({
  tableId,
  columns,
  data,
  rowCount,
  onPaginationChange,
  initialPageSize = 20,
  globalFilter = '',
  enableRowSelection = false,
}: UseDataTableOptions<T>) {
  // Debounce the global filter by 300ms to avoid filter-on-every-keystroke
  const debouncedFilter = useDebounce(globalFilter, 300)

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    loadVisibility(tableId)
  )
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  })

  // Persist column visibility to localStorage on change
  const handleVisibilityChange = useCallback(
    (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        saveVisibility(tableId, next)
        return next
      })
    },
    [tableId]
  )

  // Handle pagination — notify parent for server-side, use local for client-side
  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => {
      setPagination((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (onPaginationChange) {
          // Defer to next tick to avoid setState-during-render
          queueMicrotask(() => onPaginationChange(next))
        }
        return next
      })
    },
    [onPaginationChange]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      globalFilter: debouncedFilter,
    },
    // Manual pagination when server-side (rowCount provided)
    manualPagination: rowCount != null,
    rowCount: rowCount ?? data.length,
    enableRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: handleVisibilityChange,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Global filter searches ALL string columns by default
    globalFilterFn: 'auto',
  })

  // Derived: visible column IDs for export
  const visibleColumnIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [id, visible] of Object.entries(columnVisibility)) {
      if (visible !== false) ids.add(id)
    }
    // Also include columns not in the visibility state (default visible)
    for (const col of columns) {
      const colId = (col as { id?: string }).id ?? (col as { accessorKey?: string }).accessorKey
      if (colId && !(colId in columnVisibility)) ids.add(colId)
    }
    return ids
  }, [columnVisibility, columns])

  return {
    table,
    visibleColumnIds,
    // Expose selection state for parent callbacks
    selectedRows: table.getSelectedRowModel().rows,
  }
}
