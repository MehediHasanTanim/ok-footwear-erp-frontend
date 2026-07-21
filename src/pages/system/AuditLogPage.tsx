import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ExpandedState,
} from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { Download, Loader2, ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { useCallback, useMemo, useState, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────
type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT'

/** Raw shape from the backend API */
interface AuditLogRaw {
  id: string
  createdAt: string
  changedBy: string | null
  action: AuditAction
  tableName: string
  recordId: string
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
}

/** Normalised shape used by the table — adds a derived `user` and `schemaName` */
interface AuditLog extends AuditLogRaw {
  /** Display name (resolved from changedBy UUID or fallback) */
  user: string
  /** Derived schema name (e.g. "auth" from "auth_events") */
  schemaName: string
}

interface AuditLogResponse {
  data: AuditLogRaw[]
  meta: { page: number; limit: number; totalItems: number }
}

/** Derive a schema (module) name from a table name, e.g. "auth_events" → "auth" */
function deriveSchemaName(tableName: string): string {
  const parts = tableName.split('_')
  return parts[0] ?? 'unknown'
}

/** Truncate a UUID for display */
function formatUserId(id: string | null): string {
  if (!id) return 'System'
  // If it looks like an email (contains @), return as-is
  if (id.includes('@')) return id
  return id.substring(0, 8) + '…'
}

interface UserSuggestion {
  id: string
  fullName: string
  email: string
}

// ── Constants ────────────────────────────────────────────────────────────────
const MODULES = [
  'orders',
  'procurement',
  'manufacturing',
  'inventory',
  'finance',
  'hr',
  'board',
  'system',
] as const

const ACTIONS: AuditAction[] = ['INSERT', 'UPDATE', 'DELETE', 'SELECT']

const ACTION_BADGE: Record<AuditAction, string> = {
  INSERT: 'bg-teal-100 text-teal-800 border-teal-300',
  UPDATE: 'bg-blue-100 text-blue-800 border-blue-300',
  DELETE: 'bg-red-100 text-red-800 border-red-300',
  SELECT: 'bg-gray-100 text-gray-700 border-gray-300',
}

const PAGE_SIZE = 20

// ── Recursive JSON diff ──────────────────────────────────────────────────────
type DiffNode =
  | { type: 'added'; key: string; value: unknown }
  | { type: 'removed'; key: string; value: unknown }
  | { type: 'changed'; key: string; oldValue: unknown; newValue: unknown }
  | { type: 'unchanged'; key: string; value: unknown }
  | { type: 'nested'; key: string; children: DiffNode[] }

function computeDiff(
  oldObj: Record<string, unknown> | null,
  newObj: Record<string, unknown> | null
): DiffNode[] {
  const oldSafe = oldObj ?? {}
  const newSafe = newObj ?? {}
  const allKeys = new Set([...Object.keys(oldSafe), ...Object.keys(newSafe)])
  const result: DiffNode[] = []

  for (const key of [...allKeys].sort()) {
    const oldVal = oldSafe[key]
    const newVal = newSafe[key]
    const inOld = key in oldSafe
    const inNew = key in newSafe

    if (!inOld && inNew) {
      // Recurse into nested objects even for added keys
      if (isPlainObject(newVal)) {
        const children = computeDiff(null, newVal as Record<string, unknown>)
        result.push({ type: 'nested', key, children })
      } else {
        result.push({ type: 'added', key, value: newVal })
      }
    } else if (inOld && !inNew) {
      // Recurse into nested objects even for removed keys
      if (isPlainObject(oldVal)) {
        const children = computeDiff(oldVal as Record<string, unknown>, null)
        result.push({ type: 'nested', key, children })
      } else {
        result.push({ type: 'removed', key, value: oldVal })
      }
    } else if (isPlainObject(oldVal) && isPlainObject(newVal)) {
      const children = computeDiff(
        oldVal as Record<string, unknown>,
        newVal as Record<string, unknown>
      )
      if (children.length > 0) {
        result.push({ type: 'nested', key, children })
      } else {
        result.push({ type: 'unchanged', key, value: newVal })
      }
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      result.push({ type: 'changed', key, oldValue: oldVal, newValue: newVal })
    } else {
      result.push({ type: 'unchanged', key, value: newVal })
    }
  }

  return result
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

// ── Diff row style helpers ───────────────────────────────────────────────────
const DIFF_ROW_STYLE: Record<string, string> = {
  added: 'bg-green-50 border-l-2 border-l-green-400',
  removed: 'bg-red-50 border-l-2 border-l-red-400',
  changed: 'bg-amber-50 border-l-2 border-l-amber-400',
  unchanged: '',
  nested: '',
}

function formatDiffValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') return JSON.stringify(val, null, 2)
  return String(val)
}

function DiffRow({ node, depth = 0 }: { node: DiffNode; depth?: number }) {
  const indent = { paddingLeft: `${depth * 16 + 12}px` }

  if (node.type === 'nested') {
    return (
      <Fragment>
        <div className="py-1 font-medium text-muted-foreground" style={indent}>
          {node.key}
        </div>
        {node.children.map((child, i) => (
          <DiffRow key={`${child.key}-${i}`} node={child} depth={depth + 1} />
        ))}
      </Fragment>
    )
  }

  return (
    <div className={cn('flex gap-4 px-3 py-1 text-sm', DIFF_ROW_STYLE[node.type])} style={indent}>
      <span className="w-40 shrink-0 font-mono text-xs">{node.key}</span>
      {node.type === 'changed' && (
        <>
          <span className="flex-1 text-red-700 line-through">{formatDiffValue(node.oldValue)}</span>
          <span className="flex-1 text-green-700">{formatDiffValue(node.newValue)}</span>
        </>
      )}
      {node.type === 'added' && (
        <span className="flex-1 text-green-700">{formatDiffValue(node.value)}</span>
      )}
      {node.type === 'removed' && (
        <span className="flex-1 text-red-700 line-through">{formatDiffValue(node.value)}</span>
      )}
      {node.type === 'unchanged' && (
        <span className="flex-1 text-muted-foreground">{formatDiffValue(node.value)}</span>
      )}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Filter state (from URL) ────────────────────────────────────────────────
  const startDate = searchParams.get('startDate') ?? ''
  const endDate = searchParams.get('endDate') ?? ''
  const selectedModules = searchParams.get('modules')?.split(',').filter(Boolean) ?? []
  const selectedActions =
    (searchParams.get('actions')?.split(',').filter(Boolean) as AuditAction[]) ?? []
  const userId = searchParams.get('userId') ?? ''
  const page = Number(searchParams.get('page') ?? '1')

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [userSearch, setUserSearch] = useState('')
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [selectedUserName, setSelectedUserName] = useState(searchParams.get('userName') ?? '')

  const debouncedUserSearch = useDebounce(userSearch, 300)

  // ── Update URL helper ──────────────────────────────────────────────────────
  const updateFilter = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
        // Reset page when filters change
        if (key !== 'page') next.set('page', '1')
        return next
      })
    },
    [setSearchParams]
  )

  const toggleArrayFilter = useCallback(
    (key: string, item: string, current: string[]) => {
      const next = current.includes(item) ? current.filter((v) => v !== item) : [...current, item]
      updateFilter(key, next.length > 0 ? next.join(',') : '')
    },
    [updateFilter]
  )

  // ── Fetch audit logs ───────────────────────────────────────────────────────
  const { data, isPending } = useQuery({
    queryKey: [
      'audit-logs',
      {
        startDate,
        endDate,
        modules: selectedModules.join(','),
        actions: selectedActions.join(','),
        userId,
        page,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (selectedModules.length > 0) params.set('modules', selectedModules.join(','))
      if (selectedActions.length > 0) params.set('actions', selectedActions.join(','))
      if (userId) params.set('userId', userId)
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))

      // API returns { data: { data: [...], meta: {...} }, timestamp: "..." }
      // NestJS wraps in an outer { data } — we unwrap one level here.
      const { data: res } = await api.get<{ data: AuditLogResponse }>(
        `/audit-logs?${params.toString()}`
      )
      return res.data
    },
    placeholderData: (prev) => prev,
  })

  // Normalise raw data → add derived user & schemaName
  const auditLogs: AuditLog[] = useMemo(
    () =>
      (data?.data ?? []).map((log) => ({
        ...log,
        user: formatUserId(log.changedBy),
        schemaName: deriveSchemaName(log.tableName),
      })),
    [data?.data]
  )

  const totalCount = data?.meta?.totalItems ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // ── Fetch user suggestions ─────────────────────────────────────────────────
  const { data: userSuggestions = [] } = useQuery({
    queryKey: ['users', 'search', debouncedUserSearch],
    queryFn: async () => {
      if (!debouncedUserSearch) return []
      const response = await api.get('/users', {
        params: { search: debouncedUserSearch, limit: 10 },
      })
      let val: unknown = response.data
      while (val && typeof val === 'object' && 'data' in (val as Record<string, unknown>)) {
        val = (val as Record<string, unknown>).data
      }
      return Array.isArray(val) ? (val as UserSuggestion[]) : []
    },
    enabled: debouncedUserSearch.length > 0,
  })

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const headers = ['ID', 'Timestamp', 'User', 'Action', 'Module', 'Table', 'Record ID']
    const rows = auditLogs.map((log) => [
      log.id,
      log.createdAt,
      log.user,
      log.action,
      log.schemaName,
      log.tableName,
      log.recordId,
    ])

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csvContent = [
      headers.map(escape).join(','),
      ...rows.map((r) => r.map(escape).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'audit-logs.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [auditLogs])

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        id: 'expander',
        header: () => null,
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation()
              row.toggleExpanded()
            }}
            className="p-1"
            data-testid={`expand-row-${row.original.id}`}
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ),
        size: 40,
        enableSorting: false,
      },
      {
        accessorKey: 'createdAt',
        header: 'Timestamp',
        cell: ({ getValue }) => {
          const val = getValue<string>()
          try {
            return format(parseISO(val), 'dd MMM yyyy HH:mm')
          } catch {
            return val
          }
        },
        size: 170,
      },
      {
        accessorKey: 'user',
        header: 'User',
        size: 140,
        cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'schemaName',
        header: 'Module',
        cell: ({ getValue }) => (
          <Badge variant="outline" className="capitalize">
            {getValue<string>()}
          </Badge>
        ),
        size: 130,
      },
      {
        accessorKey: 'action',
        header: 'Action',
        cell: ({ getValue }) => {
          const action = getValue<AuditAction>()
          return (
            <Badge
              className={cn('border', ACTION_BADGE[action] ?? ACTION_BADGE.SELECT)}
              data-testid={`action-badge-${action}`}
            >
              {action}
            </Badge>
          )
        },
        size: 100,
      },
      {
        accessorKey: 'tableName',
        header: 'Table',
        size: 180,
      },
      {
        accessorKey: 'recordId',
        header: 'Record ID',
        cell: ({ getValue }) => {
          const id = getValue<string>()
          return (
            <span className="font-mono text-xs text-muted-foreground">{id?.substring(0, 8)}…</span>
          )
        },
        size: 120,
      },
    ],
    []
  )

  // ── Table instance ─────────────────────────────────────────────────────────
  const table = useReactTable({
    data: auditLogs,
    columns,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    getRowCanExpand: () => true,
  })

  // ── Pagination handlers ────────────────────────────────────────────────────
  const handlePageChange = useCallback(
    (newPage: number) => {
      updateFilter('page', String(newPage))
    },
    [updateFilter]
  )

  // ── Clear all filters ──────────────────────────────────────────────────────
  const hasFilters =
    startDate || endDate || selectedModules.length > 0 || selectedActions.length > 0 || userId

  const clearFilters = useCallback(() => {
    setSearchParams({})
    setSelectedUserName('')
    setUserSearch('')
  }, [setSearchParams])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" data-testid="audit-log-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <Button onClick={handleExportCSV} variant="outline" data-testid="export-csv-btn">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
        {/* Date range */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => updateFilter('startDate', e.target.value)}
            className="h-9 w-36 text-xs"
            data-testid="filter-start-date"
          />
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => updateFilter('endDate', e.target.value)}
            className="h-9 w-36 text-xs"
            data-testid="filter-end-date"
          />
        </div>

        {/* Module multi-select */}
        <div className="flex flex-wrap gap-1" data-testid="filter-modules">
          {MODULES.map((mod) => (
            <button
              key={mod}
              onClick={() => toggleArrayFilter('modules', mod, selectedModules)}
              className={cn(
                'rounded-md border px-2 py-1 text-xs capitalize transition-colors',
                selectedModules.includes(mod)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input hover:bg-muted'
              )}
              data-testid={`module-filter-${mod}`}
            >
              {mod}
            </button>
          ))}
        </div>

        {/* Action multi-select */}
        <div className="flex flex-wrap gap-1" data-testid="filter-actions">
          {ACTIONS.map((act) => (
            <button
              key={act}
              onClick={() => toggleArrayFilter('actions', act, selectedActions as string[])}
              className={cn(
                'rounded-md border px-2 py-1 text-xs transition-colors',
                selectedActions.includes(act)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input hover:bg-muted'
              )}
              data-testid={`action-filter-${act}`}
            >
              {act}
            </button>
          ))}
        </div>

        {/* User autocomplete */}
        <div className="relative" data-testid="filter-user">
          <div className="flex items-center gap-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={selectedUserName || userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value)
                setSelectedUserName('')
                setUserDropdownOpen(true)
                if (!e.target.value) {
                  updateFilter('userId', '')
                  updateFilter('userName', '')
                }
              }}
              onFocus={() => setUserDropdownOpen(true)}
              onBlur={() => setTimeout(() => setUserDropdownOpen(false), 200)}
              placeholder="Search user…"
              className="h-9 w-44 text-xs"
              data-testid="user-search-input"
            />
            {userId && (
              <button
                onClick={() => {
                  updateFilter('userId', '')
                  updateFilter('userName', '')
                  setSelectedUserName('')
                  setUserSearch('')
                }}
                className="text-muted-foreground hover:text-foreground"
                data-testid="clear-user-filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {userDropdownOpen && userSuggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
              {userSuggestions.map((u) => (
                <button
                  key={u.id}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                  onMouseDown={() => {
                    updateFilter('userId', u.id)
                    updateFilter('userName', u.fullName)
                    setSelectedUserName(u.fullName)
                    setUserSearch('')
                    setUserDropdownOpen(false)
                  }}
                  data-testid={`user-suggestion-${u.id}`}
                >
                  <div className="font-medium">{u.fullName}</div>
                  <div className="text-muted-foreground">{u.email}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 text-xs"
            data-testid="clear-filters"
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" data-testid="audit-table">
            <thead className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        'px-3 py-3 text-left text-xs font-medium text-muted-foreground',
                        header.column.getCanSort() &&
                          'cursor-pointer select-none hover:text-foreground'
                      )}
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td colSpan={columns.length} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-16 text-center text-sm text-muted-foreground"
                  >
                    No audit logs found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <Fragment key={row.id}>
                    <tr
                      className={cn(
                        'border-b transition-colors hover:bg-muted/50',
                        row.getIsExpanded() && 'bg-muted/30'
                      )}
                      onClick={() => row.toggleExpanded()}
                      data-testid={`audit-row-${row.original.id}`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2.5 text-sm">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {/* Expanded diff row */}
                    {row.getIsExpanded() && (
                      <tr data-testid={`expanded-row-${row.original.id}`}>
                        <td colSpan={columns.length} className="bg-muted/20 p-0">
                          <div className="max-h-96 overflow-y-auto border-t">
                            {row.original.action === 'INSERT' ? (
                              <div className="p-3">
                                <div className="mb-2 text-xs font-medium text-green-700">
                                  New Record (INSERT)
                                </div>
                                {computeDiff(null, row.original.newValue).map((node, i) => (
                                  <DiffRow key={i} node={node} />
                                ))}
                              </div>
                            ) : row.original.action === 'DELETE' ? (
                              <div className="p-3">
                                <div className="mb-2 text-xs font-medium text-red-700">
                                  Deleted Record (DELETE)
                                </div>
                                {computeDiff(row.original.oldValue, null).map((node, i) => (
                                  <DiffRow key={i} node={node} />
                                ))}
                              </div>
                            ) : (
                              <div className="p-3">
                                <div className="mb-3 grid grid-cols-2 gap-4">
                                  <div>
                                    <div className="mb-1 text-xs font-medium text-red-700">
                                      Old Value
                                    </div>
                                  </div>
                                  <div>
                                    <div className="mb-1 text-xs font-medium text-green-700">
                                      New Value
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-0.5">
                                  {computeDiff(row.original.oldValue, row.original.newValue)
                                    .filter((n) => n.type !== 'unchanged')
                                    .map((node, i) => (
                                      <DiffRow key={i} node={node} />
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} total)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              data-testid="prev-page"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              data-testid="next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
