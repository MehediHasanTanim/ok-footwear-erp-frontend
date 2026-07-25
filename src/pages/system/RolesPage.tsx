import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Check, Pencil, Trash2, Search } from 'lucide-react'
import { useState, useCallback, useRef, useEffect } from 'react'

import { PermissionMatrix } from '@/components/system/PermissionMatrix'
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
interface PermissionObject {
  id: string
  module: string
  action: string
  description?: string
}

interface Role {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: PermissionObject[]
}

interface RoleDetailResponse {
  data: Role
}

interface RolesResponse {
  data: Role[]
}

/** Raw permission definition from /permissions API */
interface RawPermission {
  id: string
  module: string
  action: string
  description?: string
}

/** Convert permission object from API to "module:action" string */
function permissionToString(p: PermissionObject): string {
  return `${p.module}:${p.action}`
}

/** Convert string[] permissions to nested Record for PermissionMatrix */
function permsToRecord(perms: string[]): Record<string, Record<string, boolean>> {
  const result: Record<string, Record<string, boolean>> = {}
  for (const p of perms) {
    const [module, action] = p.split(':')
    if (!module || !action) continue
    if (!result[module]) result[module] = {}
    result[module]![action] = true
  }
  return result
}

/** Convert nested Record back to string[] */
function recordToPerms(rec: Record<string, Record<string, boolean>>): string[] {
  const result: string[] = []
  for (const [module, actions] of Object.entries(rec)) {
    for (const [action, enabled] of Object.entries(actions)) {
      if (enabled) result.push(`${module}:${action}`)
    }
  }
  return result
}

// ── Component ────────────────────────────────────────────────────────────────
export default function RolesPage() {
  const queryClient = useQueryClient()

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [localPermissions, setLocalPermissions] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [newRoleOpen, setNewRoleOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [editRoleOpen, setEditRoleOpen] = useState(false)
  const [editRoleName, setEditRoleName] = useState('')
  const [editRoleDesc, setEditRoleDesc] = useState('')
  const [deleteRoleOpen, setDeleteRoleOpen] = useState(false)
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null)
  const [roleSearch, setRoleSearch] = useState('')
  const debouncedRoleSearch = useDebounce(roleSearch, 300)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch roles ────────────────────────────────────────────────────────────
  const { data: rolesData, isPending: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get<RolesResponse>('/roles')
      return data.data
    },
  })

  const roles = rolesData ?? []
  const filteredRoles = debouncedRoleSearch
    ? roles.filter(
        (r) =>
          r.name.toLowerCase().includes(debouncedRoleSearch.toLowerCase()) ||
          (r.description ?? '').toLowerCase().includes(debouncedRoleSearch.toLowerCase())
      )
    : roles
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null

  // ── Fetch detailed role with permissions when selected ─────────────────────
  const { data: roleDetail, isPending: permissionsLoading } = useQuery({
    queryKey: ['roles', selectedRoleId],
    queryFn: async () => {
      if (!selectedRoleId) return null
      const { data } = await api.get<RoleDetailResponse>(`/roles/${selectedRoleId}`)
      return data.data ?? data
    },
    enabled: !!selectedRoleId,
    placeholderData: (prev) => prev,
  })

  // ── Fetch all available permissions (for grid structure) ───────────────────
  const { data: allPermissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data } = await api.get<{ data: RawPermission[] }>('/permissions')
      return Array.isArray(data) ? data : (data.data ?? [])
    },
    staleTime: 5 * 60 * 1000, // cache for 5 min — permissions rarely change
  })

  // Sync local permissions when selected role changes or permissions load
  useEffect(() => {
    const rawPerms = roleDetail?.permissions
    const perms: string[] = Array.isArray(rawPerms)
      ? rawPerms.map((p) => (typeof p === 'string' ? p : permissionToString(p)))
      : []
    setLocalPermissions([...perms])
    prevPermissionsRef.current = [...perms]
    setSaveStatus('idle')
  }, [selectedRoleId, roleDetail])

  // ── Optimistic save with 800ms debounce (diff-based add/remove) ─────────
  const prevPermissionsRef = useRef<string[]>([])

  const saveMutation = useMutation({
    mutationFn: async ({ added, removed }: { added: string[]; removed: string[] }) => {
      if (!selectedRoleId) return
      // Add new permissions (POST /roles/:id/permissions)
      await Promise.all(
        added.map((perm) => {
          const [module, action] = perm.split(':')
          // Look up the permission ID from the fetched list
          const permDef = allPermissions.find((p) => p.module === module && p.action === action)
          if (!permDef) return Promise.resolve() // skip if not found
          return api.post(`/roles/${selectedRoleId}/permissions`, {
            permissionId: permDef.id,
            module,
            action,
          })
        })
      )
      // Remove permissions (DELETE /roles/:id/permissions/:permId)
      await Promise.all(
        removed.map((perm) => {
          const [module, action] = perm.split(':')
          const permDef = allPermissions.find((p) => p.module === module && p.action === action)
          if (!permDef) return Promise.resolve() // skip if not found
          return api.delete(`/roles/${selectedRoleId}/permissions/${permDef.id}`)
        })
      )
    },
    onMutate: () => {
      setSaveStatus('saving')
    },
    onSuccess: () => {
      setSaveStatus('saved')
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: () => {
      setSaveStatus('error')
      if (selectedRole) {
        setLocalPermissions([...prevPermissionsRef.current])
      }
    },
  })

  const handlePermissionChange = useCallback(
    (permRecord: Record<string, Record<string, boolean>>) => {
      const permissions = recordToPerms(permRecord)
      const prev = prevPermissionsRef.current
      const newSet = new Set(permissions)
      const oldSet = new Set(prev)

      const added = permissions.filter((p) => !oldSet.has(p))
      const removed = prev.filter((p) => !newSet.has(p))

      setLocalPermissions(permissions)
      setSaveStatus('idle')

      if (added.length === 0 && removed.length === 0) return

      prevPermissionsRef.current = permissions

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        saveMutation.mutate({ added, removed })
      }, 800)
    },
    [saveMutation]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ── Create role mutation ───────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/roles', { name: newRoleName, description: newRoleDesc || undefined })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      setNewRoleOpen(false)
      setNewRoleName('')
      setNewRoleDesc('')
    },
  })

  // ── Update role mutation ───────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoleId) return
      await api.patch(`/roles/${selectedRoleId}`, {
        name: editRoleName,
        description: editRoleDesc || undefined,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      void queryClient.invalidateQueries({ queryKey: ['roles', selectedRoleId] })
      setEditRoleOpen(false)
    },
  })

  // ── Delete role mutation ───────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteRoleId) return
      await api.delete(`/roles/${deleteRoleId}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      if (selectedRoleId === deleteRoleId) {
        setSelectedRoleId(null)
      }
      setDeleteRoleOpen(false)
      setDeleteRoleId(null)
    },
  })

  // ── Open edit dialog (pre-populated with selected role) ────────────────────
  const handleOpenEdit = useCallback(() => {
    if (!selectedRole) return
    setEditRoleName(selectedRole.name)
    setEditRoleDesc(selectedRole.description ?? '')
    setEditRoleOpen(true)
  }, [selectedRole])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" data-testid="roles-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Roles & Permissions</h1>
        <Button onClick={() => setNewRoleOpen(true)} data-testid="new-role-btn">
          <Plus className="mr-2 h-4 w-4" />
          New Role
        </Button>
      </div>

      <div className="flex gap-4">
        {/* ── Left panel: Role list ──────────────────────────────────────── */}
        <div className="w-56 shrink-0 rounded-md border" data-testid="role-list">
          <div className="border-b px-3 py-2 text-sm font-medium">Roles</div>
          <div className="border-b px-2 py-1.5">
            <div className="flex items-center gap-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Search…"
                className="h-7 border-0 px-1 text-xs shadow-none focus-visible:ring-0"
                data-testid="role-search"
              />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {rolesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRoles.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No roles yet</p>
            ) : (
              filteredRoles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                    selectedRoleId === role.id && 'bg-accent font-medium'
                  )}
                  data-testid={`role-item-${role.id}`}
                >
                  <div>{role.name}</div>
                  {role.description && (
                    <div className="truncate text-xs text-muted-foreground">{role.description}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right panel: Permission matrix ─────────────────────────────── */}
        <div className="min-w-0 flex-1 rounded-md border">
          {!selectedRole ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Select a role to manage permissions
            </div>
          ) : permissionsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div>
                    <h2 className="font-semibold">{selectedRole.name}</h2>
                    {selectedRole.description && (
                      <p className="text-xs text-muted-foreground">{selectedRole.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleOpenEdit}
                      disabled={selectedRole.isSystem}
                      data-testid="edit-role-btn"
                      title={selectedRole.isSystem ? 'System roles cannot be edited' : 'Edit role'}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        setDeleteRoleId(selectedRole.id)
                        setDeleteRoleOpen(true)
                      }}
                      disabled={selectedRole.isSystem}
                      data-testid="delete-role-btn"
                      title={
                        selectedRole.isSystem ? 'System roles cannot be deleted' : 'Delete role'
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {/* Save status indicator */}
                <div className="flex items-center gap-1 text-xs" data-testid="save-status">
                  {saveStatus === 'saving' && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving…
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="flex items-center gap-1 text-green-600">
                      <Check className="h-3 w-3" />
                      Saved ✓
                    </span>
                  )}
                  {saveStatus === 'error' && <span className="text-destructive">Save failed</span>}
                </div>
              </div>
              <PermissionMatrix
                allPermissions={allPermissions}
                value={permsToRecord(localPermissions)}
                onChange={handlePermissionChange}
                disabled={selectedRole.isSystem && saveStatus !== 'idle'}
                protectedPermissions={[
                  { module: 'system', action: 'delete' },
                  { module: 'system', action: 'approve' },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── New Role Dialog ──────────────────────────────────────────────── */}
      <Dialog open={newRoleOpen} onOpenChange={setNewRoleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>Add a new role to the system.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. finance_manager"
                data-testid="new-role-name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <Input
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="Optional description"
                data-testid="new-role-desc"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRoleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newRoleName.trim() || createMutation.isPending}
              data-testid="new-role-submit"
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Role Dialog ─────────────────────────────────────────────── */}
      <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update the role name or description.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <Input
                value={editRoleName}
                onChange={(e) => setEditRoleName(e.target.value)}
                placeholder="e.g. finance_manager"
                data-testid="edit-role-name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <Input
                value={editRoleDesc}
                onChange={(e) => setEditRoleDesc(e.target.value)}
                placeholder="Optional description"
                data-testid="edit-role-desc"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!editRoleName.trim() || updateMutation.isPending}
              data-testid="edit-role-submit"
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Role Confirmation Dialog ──────────────────────────────── */}
      <Dialog open={deleteRoleOpen} onOpenChange={setDeleteRoleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this role? This action cannot be undone.
              {selectedRole?.isSystem && (
                <span className="mt-2 block font-medium text-destructive">
                  System roles cannot be deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRoleOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="delete-role-confirm"
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
