import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { differenceInDays, parseISO, format as formatDateFn } from 'date-fns'
import { Plus, Loader2, Pencil, Trash2, Search, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────
type ComplianceStatus = 'valid' | 'expiring_soon' | 'expired' | 'renewed'

/** Raw item from backend (may use snake_case) */
interface ComplianceItemRaw {
  id: string
  name: string
  category: string
  expiryDate?: string
  expiry_date?: string
  responsibleUserId?: string
  responsible_user_id?: string
  responsibleUser?: string
  responsible_user?: string
  alertDays?: number
  alert_days?: number
  documentUrl?: string | null
  document_url?: string | null
  status: ComplianceStatus
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

/** Normalised shape used by the table */
interface ComplianceItem {
  id: string
  name: string
  category: string
  expiryDate: string
  responsibleUserId: string
  responsibleUser: string
  alertDays: number
  documentUrl: string | null
  status: ComplianceStatus
  createdAt: string
  updatedAt: string
}

/** Normalise snake_case or camelCase backend response */
function normaliseItem(raw: ComplianceItemRaw): ComplianceItem {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    expiryDate: raw.expiryDate || raw.expiry_date || '',
    responsibleUserId: raw.responsibleUserId || raw.responsible_user_id || '',
    responsibleUser: raw.responsibleUser || raw.responsible_user || '',
    alertDays: raw.alertDays ?? raw.alert_days ?? 30,
    documentUrl: raw.documentUrl ?? raw.document_url ?? null,
    status: raw.status,
    createdAt: raw.createdAt || raw.created_at || '',
    updatedAt: raw.updatedAt || raw.updated_at || '',
  }
}

interface UserSuggestion {
  id: string
  fullName?: string
  full_name?: string
  email: string
}

/** Extract display name from user — handles both camelCase and snake_case */
function userDisplayName(u: UserSuggestion): string {
  return u.fullName || u.full_name || u.email
}

// ── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ['license', 'certification', 'audit', 'policy', 'other'] as const

const STATUS_OPTIONS: ComplianceStatus[] = ['valid', 'expiring_soon', 'expired', 'renewed']

/** CSS variable–based badge styles — no hardcoded hex */
const COUNTDOWN_STYLE = {
  expired: 'bg-[rgb(var(--bg-danger))] text-[rgb(var(--text-danger))]',
  warning: 'bg-[rgb(var(--bg-warning))] text-[rgb(var(--text-warning))]',
  safe: 'bg-[rgb(var(--bg-success))] text-[rgb(var(--text-success))]',
} as const

const STATUS_STYLE: Record<ComplianceStatus, string> = {
  valid: 'bg-[rgb(var(--bg-success))] text-[rgb(var(--text-success))]',
  expiring_soon: 'bg-[rgb(var(--bg-warning))] text-[rgb(var(--text-warning))]',
  expired: 'bg-[rgb(var(--bg-danger))] text-[rgb(var(--text-danger))]',
  renewed: 'bg-[rgb(var(--bg-teal))] text-[rgb(var(--text-teal))]',
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDaysRemaining(expiryDate: string): number {
  return differenceInDays(parseISO(expiryDate), new Date())
}

function getCountdownLabel(item: ComplianceItem): { label: string; style: string } {
  const days = getDaysRemaining(item.expiryDate)
  if (days < 0) return { label: 'Expired', style: COUNTDOWN_STYLE.expired }
  if (days <= item.alertDays) return { label: `${days}d`, style: COUNTDOWN_STYLE.warning }
  return { label: `${days}d`, style: COUNTDOWN_STYLE.safe }
}

function getStatusLabel(status: ComplianceStatus): string {
  return status.replace(/_/g, ' ')
}

// ── Component ────────────────────────────────────────────────────────────────
export default function CompliancePage() {
  const queryClient = useQueryClient()

  // ── State ──────────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | ''>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ComplianceItem | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Form fields
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState<string>('license')
  const [formExpiryDate, setFormExpiryDate] = useState('')
  const [formAlertDays, setFormAlertDays] = useState('30')
  const [formDocumentUrl, setFormDocumentUrl] = useState('')
  const [formUserId, setFormUserId] = useState('')
  const [formUserName, setFormUserName] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)

  const debouncedUserSearch = useDebounce(userSearch, 300)

  // ── Fetch compliance list ─────────────────────────────────────────────────
  const { data: allItems = [], isPending } = useQuery({
    queryKey: ['compliance'],
    queryFn: async () => {
      const { data: res } = await api.get<{ data: ComplianceItemRaw[] }>('/compliance-items')
      const rawItems: ComplianceItemRaw[] = Array.isArray(res) ? res : (res.data ?? [])
      return rawItems.map(normaliseItem)
    },
    placeholderData: (prev) => prev,
  })

  // Client-side status filter
  const items = useMemo(
    () => (statusFilter ? allItems.filter((i) => i.status === statusFilter) : allItems),
    [allItems, statusFilter]
  )

  // ── Fetch all users for name resolution ────────────────────────────────────
  const { data: userNameMap = {} } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: async () => {
      const response = await api.get('/users', { params: { limit: 100 } })
      let val: unknown = response.data
      while (val && typeof val === 'object' && 'data' in (val as Record<string, unknown>)) {
        val = (val as Record<string, unknown>).data
      }
      const users = Array.isArray(val)
        ? (val as Array<{
            id: string
            firstName?: string
            lastName?: string
            fullName?: string
            full_name?: string
            email: string
          }>)
        : []
      const map: Record<string, string> = {}
      for (const u of users) {
        const name =
          u.fullName ||
          u.full_name ||
          [u.firstName, u.lastName].filter(Boolean).join(' ') ||
          u.email
        map[u.id] = name
      }
      return map
    },
    staleTime: 5 * 60_000,
  })

  // ── Fetch user suggestions ─────────────────────────────────────────────────
  const { data: userSuggestions = [] } = useQuery({
    queryKey: ['users', 'search', debouncedUserSearch],
    queryFn: async () => {
      if (!debouncedUserSearch) return []
      const response = await api.get('/users', {
        params: { search: debouncedUserSearch, limit: 5 },
      })
      // Unwrap NestJS response — handle all possible nesting levels
      let val: unknown = response.data
      while (val && typeof val === 'object' && 'data' in (val as Record<string, unknown>)) {
        val = (val as Record<string, unknown>).data
      }
      return Array.isArray(val) ? (val as UserSuggestion[]) : []
    },
    enabled: debouncedUserSearch.length > 0,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/compliance-items', {
        name: formName,
        category: formCategory,
        expiryDate: formExpiryDate,
        responsibleUserId: formUserId,
        alertDays: Number(formAlertDays),
        documentUrl: formDocumentUrl || undefined,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compliance'] })
      resetForm()
      setDialogOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) return
      await api.patch(`/compliance-items/${editingItem.id}`, {
        name: formName,
        category: formCategory,
        expiryDate: formExpiryDate,
        responsibleUserId: formUserId,
        alertDays: Number(formAlertDays),
        documentUrl: formDocumentUrl || undefined,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compliance'] })
      resetForm()
      setDialogOpen(false)
      setEditingItem(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteId) return
      await api.delete(`/compliance-items/${deleteId}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compliance'] })
      setDeleteOpen(false)
      setDeleteId(null)
    },
  })

  // ── Form helpers ───────────────────────────────────────────────────────────
  function resetForm() {
    setFormName('')
    setFormCategory('license')
    setFormExpiryDate('')
    setFormAlertDays('30')
    setFormDocumentUrl('')
    setFormUserId('')
    setFormUserName('')
    setUserSearch('')
  }

  function openCreate() {
    resetForm()
    setEditingItem(null)
    setDialogOpen(true)
  }

  function openEdit(item: ComplianceItem) {
    setEditingItem(item)
    setFormName(item.name)
    setFormCategory(item.category)
    setFormExpiryDate(item.expiryDate.substring(0, 10))
    setFormAlertDays(String(item.alertDays))
    setFormDocumentUrl(item.documentUrl ?? '')
    setFormUserId(item.responsibleUserId)
    setFormUserName(item.responsibleUser)
    setDialogOpen(true)
  }

  const isFormValid =
    formName.trim() !== '' &&
    formExpiryDate !== '' &&
    formUserId !== '' &&
    Number(formAlertDays) > 0

  const saveMutation = editingItem ? updateMutation : createMutation
  const isSaving = createMutation.isPending || updateMutation.isPending

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<ComplianceItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
        size: 180,
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ getValue }) => (
          <Badge variant="outline" className="capitalize">
            {getValue<string>()}
          </Badge>
        ),
        size: 120,
      },
      {
        accessorKey: 'expiryDate',
        header: 'Expiry Date',
        cell: ({ getValue }) => {
          const val = getValue<string>()
          try {
            return formatDateFn(parseISO(val), 'dd MMM yyyy')
          } catch {
            return val
          }
        },
        size: 130,
      },
      {
        id: 'daysRemaining',
        header: 'Due',
        cell: ({ row }) => {
          const badge = getCountdownLabel(row.original)
          return (
            <span
              className={cn(
                'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold',
                badge.style
              )}
              data-testid={`countdown-${row.original.id}`}
            >
              {badge.label}
            </span>
          )
        },
        size: 100,
        sortingFn: (a, b) =>
          getDaysRemaining(a.original.expiryDate) - getDaysRemaining(b.original.expiryDate),
      },
      {
        accessorKey: 'responsibleUser',
        header: 'Responsible',
        size: 150,
        cell: ({ row }) => {
          const userId = row.original.responsibleUserId
          const name = userNameMap[userId] || row.original.responsibleUser
          if (!name) return <span className="text-xs text-muted-foreground">—</span>
          return <span>{name}</span>
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue<ComplianceStatus>()
          return (
            <span
              className={cn(
                'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                STATUS_STYLE[status]
              )}
              data-testid={`status-${status}`}
            >
              {getStatusLabel(status)}
            </span>
          )
        },
        size: 120,
      },
      {
        id: 'document',
        header: 'Doc',
        cell: ({ row }) => {
          const url = row.original.documentUrl
          if (!url) return <span className="text-xs text-muted-foreground">—</span>
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
              data-testid={`doc-link-${row.original.id}`}
            >
              <ExternalLink className="h-3 w-3" />
              View
            </a>
          )
        },
        size: 70,
        enableSorting: false,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation()
                openEdit(row.original)
              }}
              data-testid={`edit-${row.original.id}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteId(row.original.id)
                setDeleteOpen(true)
              }}
              data-testid={`delete-${row.original.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
        size: 80,
        enableSorting: false,
      },
    ],
    [userNameMap]
  )

  // ── Table ──────────────────────────────────────────────────────────────────
  const [sorting, setSorting] = useState<SortingState>([{ id: 'daysRemaining', desc: false }])

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" data-testid="compliance-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Compliance Register</h1>
        <Button onClick={openCreate} data-testid="new-compliance-btn">
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* ── Status filter ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <button
          onClick={() => setStatusFilter('')}
          className={cn(
            'rounded-md border px-2.5 py-1 text-xs transition-colors',
            !statusFilter
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input hover:bg-muted'
          )}
          data-testid="status-filter-all"
        >
          All
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs capitalize transition-colors',
              statusFilter === s
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input hover:bg-muted'
            )}
            data-testid={`status-filter-${s}`}
          >
            {getStatusLabel(s)}
          </button>
        ))}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" data-testid="compliance-table">
            <thead className="bg-muted/50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className={cn(
                        'px-3 py-3 text-left text-xs font-medium text-muted-foreground',
                        h.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground'
                      )}
                      style={{ width: h.getSize() }}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {h.isPlaceholder
                        ? null
                        : flexRender(h.column.columnDef.header, h.getContext())}
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
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-16 text-center text-sm text-muted-foreground"
                  >
                    No compliance items found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-muted/50"
                    data-testid={`compliance-row-${row.original.id}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create/Edit Dialog ────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit' : 'Add'} Compliance Item</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the item details.' : 'Register a new compliance item.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Name *</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Fire Safety Certificate"
                data-testid="form-name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Category *</label>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormCategory(cat)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs capitalize transition-colors',
                      formCategory === cat
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input hover:bg-muted'
                    )}
                    data-testid={`category-${cat}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Expiry Date *</label>
              <Input
                type="date"
                value={formExpiryDate}
                onChange={(e) => setFormExpiryDate(e.target.value)}
                data-testid="form-expiry-date"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Alert Days *</label>
              <Input
                type="number"
                min={1}
                value={formAlertDays}
                onChange={(e) => setFormAlertDays(e.target.value)}
                data-testid="form-alert-days"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Responsible User *</label>
              <div className="relative">
                <div className="flex items-center gap-1">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={formUserName || userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value)
                      setFormUserName('')
                      setFormUserId('')
                      if (e.target.value) setUserDropdownOpen(true)
                    }}
                    onFocus={() => {
                      if (userSuggestions.length > 0) setUserDropdownOpen(true)
                    }}
                    placeholder="Search user…"
                    data-testid="form-user-search"
                    autoComplete="off"
                  />
                </div>
                <div
                  className={cn(
                    'absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md',
                    userDropdownOpen && userSuggestions.length > 0 ? '' : 'hidden'
                  )}
                >
                  {userSuggestions.map((u) => {
                    const name = userDisplayName(u)
                    return (
                      <div
                        key={u.id}
                        className="cursor-pointer px-3 py-1.5 text-left text-xs hover:bg-muted"
                        onMouseDown={() => {
                          setFormUserId(u.id)
                          setFormUserName(name)
                          setUserSearch('')
                          setUserDropdownOpen(false)
                        }}
                        data-testid={`user-opt-${u.id}`}
                      >
                        <div className="font-medium">{name}</div>
                        <div className="text-muted-foreground">{u.email}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Document URL</label>
              <Input
                value={formDocumentUrl}
                onChange={(e) => setFormDocumentUrl(e.target.value)}
                placeholder="https://..."
                data-testid="form-doc-url"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!isFormValid || isSaving}
              data-testid="form-submit"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingItem ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this compliance item? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="delete-confirm"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
