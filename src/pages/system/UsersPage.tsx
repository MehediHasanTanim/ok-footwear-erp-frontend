import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useState, useMemo, useCallback } from 'react'

import { DataTable } from '@/components/table/DataTable'
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
import { UserDialog } from '@/components/users/UserDialog'
import { useDebounce } from '@/hooks/useDebounce'
import api from '@/lib/api'
import { selectCan, useAuthStore } from '@/stores/authStore'

// ── Types ────────────────────────────────────────────────────────────────────
interface User {
  id: string
  firstName: string
  lastName: string | null
  email: string
  isActive: boolean
  lastLoginAt: string | null
  roles?: { id: string; name: string }[]
}

interface UsersResponse {
  data: {
    data: User[]
    meta: { page: number; limit: number; total: number }
  }
}

interface Role {
  id: string
  name: string
  description?: string
}

const PAGE_SIZE = 20

const columnHelper = createColumnHelper<User>()

// ── Component ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const queryClient = useQueryClient()
  const canWrite = useAuthStore(selectCan('system', 'update'))

  // ── State ──────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  // ── Fetch users ────────────────────────────────────────────────────────────
  const {
    data: usersData,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['users', page, debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get<UsersResponse>('/users', {
        params: { page: page + 1, limit: PAGE_SIZE, search: debouncedSearch || undefined },
      })
      // Backend wraps in double data: { data: { data: [...], meta: {...} } }
      return data.data
    },
  })

  // ── Fetch roles (for the dialog) ───────────────────────────────────────────
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Role[] }>('/roles')
      return data.data
    },
    staleTime: 5 * 60_000,
  })

  const roles = rolesData ?? []

  // ── Delete mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteTarget(null)
    },
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    setEditingUser(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((user: User) => {
    setEditingUser(user)
    setDialogOpen(true)
  }, [])

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false)
    setEditingUser(null)
  }, [])

  const handleDialogSuccess = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['users'] })
  }, [queryClient])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      columnHelper.accessor('firstName', {
        header: 'Name',
        cell: (info) => {
          const user = info.row.original
          const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
          return <span className="font-medium">{name || '—'}</span>
        },
      }),
      columnHelper.accessor('email', {
        header: 'Email',
      }),
      columnHelper.accessor('roles', {
        header: 'Roles',
        cell: (info) => {
          const userRoles = info.getValue()
          if (!userRoles || userRoles.length === 0) {
            return <span className="text-muted-foreground">—</span>
          }
          return (
            <div className="flex flex-wrap gap-1">
              {userRoles.map((role) => (
                <Badge key={role.id} variant="secondary" className="text-xs">
                  {role.name}
                </Badge>
              ))}
            </div>
          )
        },
      }),
      columnHelper.accessor('isActive', {
        header: 'Status',
        cell: (info) => {
          const active = info.getValue()
          return (
            <Badge
              variant={active ? 'default' : 'secondary'}
              className={active ? 'bg-green-600 hover:bg-green-700' : 'text-muted-foreground'}
            >
              {active ? 'Active' : 'Inactive'}
            </Badge>
          )
        },
      }),
      columnHelper.accessor('lastLoginAt', {
        header: 'Last Login',
        cell: (info) => {
          const val = info.getValue()
          if (!val) return <span className="text-muted-foreground">—</span>
          return format(new Date(val), 'PPp')
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => {
          if (!canWrite) return null
          const user = info.row.original
          return (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(user)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )
        },
      }),
    ],
    [canWrite, handleEdit]
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" data-testid="users-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users Management</h1>
        {canWrite && (
          <Button onClick={handleCreate} data-testid="users-create-btn">
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      {/* Search */}
      <Input
        placeholder="Search users…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(0)
        }}
        className="max-w-sm"
        data-testid="users-search"
      />

      {/* Table */}
      {isError && (
        <div
          className="rounded-md bg-destructive/10 p-4 text-sm text-destructive"
          data-testid="users-error"
        >
          Failed to load users. {(error as Error)?.message || 'Please try again.'}
        </div>
      )}
      {!isError && (
        <DataTable
          tableId="users"
          columns={columns as ColumnDef<User>[]}
          data={usersData?.data ?? []}
          rowCount={usersData?.meta?.total ?? 0}
          pageSize={PAGE_SIZE}
          loading={isPending}
          onPaginationChange={(p) => setPage(p.pageIndex)}
        />
      )}

      {/* Create/Edit Dialog */}
      <UserDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSuccess={handleDialogSuccess}
        user={editingUser}
        roles={roles}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.firstName}</strong>? This
              action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="users-delete-confirm"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
