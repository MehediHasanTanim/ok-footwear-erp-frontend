import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// ── Types ────────────────────────────────────────────────────────────────────
export type Module =
  | 'orders'
  | 'procurement'
  | 'hr'
  | 'finance'
  | 'board'
  | 'system'
  | 'dashboard'
  | 'compliance'

export type Action = 'read' | 'create' | 'update' | 'delete'

export interface Permission {
  module: Module | '*'
  action: Action | '*'
}

/**
 * Convert backend string-format permissions ("orders:read") to Permission objects.
 * The backend returns permissions as strings like "orders:read", "system:*", etc.
 */
export function parsePermissions(raw: string[]): Permission[] {
  return raw.map((p) => {
    const [module, action] = p.split(':') as [string, string]
    return {
      module: (module ?? '*') as Permission['module'],
      action: (action ?? '*') as Permission['action'],
    }
  })
}

// ── Store shape ──────────────────────────────────────────────────────────────
interface AuthState {
  userId: string | null
  fullName: string | null
  role: string | null
  permissions: Permission[]
  /** JWT access token — in memory ONLY, never persisted */
  accessToken: string | null
  /** ISO-8601 datetime when the access token expires */
  expiresAt: string | null
  /** true while the auth state is hydrating from localStorage on page load */
  isLoading: boolean

  // Actions
  login: (payload: {
    userId: string
    fullName: string
    role: string
    permissions: Permission[]
    accessToken: string
    expiresAt: string
  }) => void
  setAccessToken: (token: string, expiresAt: string) => void
  /** Clears auth state AND disconnects SSE + clears notifications */
  clearAuth: () => void
  setLoading: (loading: boolean) => void
}

// ── Wildcard helper ──────────────────────────────────────────────────────────
// Permission checks support three patterns:
//   1. Exact:    { module: 'orders', action: 'read' }
//   2. Module wildcard: 'orders:*' — grants ALL actions on the module
//   3. Global wildcard: '*:*' — super-admin, grants everything

const WILDCARD = '*' as const

function permissionMatches(perm: Permission, module: Module, action: Action): boolean {
  // Global wildcard
  if (perm.module === WILDCARD && perm.action === WILDCARD) return true
  // Module wildcard: user has 'orders:*' and we're checking any action on 'orders'
  if (perm.module === module && perm.action === WILDCARD) return true
  // Exact match
  if (perm.module === module && perm.action === action) return true
  return false
}

/** Role names that grant unrestricted access regardless of permissions. */
const SUPER_ADMIN_ROLES = ['super_admin', 'super admin']

function isSuperAdmin(role: string | null): boolean {
  if (!role) return false
  const normalized = role.toLowerCase().replace(/[_\s]+/g, '_')
  return SUPER_ADMIN_ROLES.some((r) => normalized === r.replace(/[_\s]+/g, '_'))
}

// ── Selectors (module-level, NOT on the store — avoids re-render storms) ────

/** Modules that are always accessible (no backend permission check needed) */
const PUBLIC_MODULES: Set<string> = new Set(['dashboard'])

/**
 * Curried selector for permission checks with wildcard support.
 * Returns a boolean primitive — always stable when the value hasn't changed.
 */
export const selectCan =
  (module: Module, action: Action) =>
  (state: AuthState): boolean => {
    // Dashboard is a frontend-only concept — always accessible if authenticated
    if (PUBLIC_MODULES.has(module)) return true
    // Super Admin role name OR having a wildcard permission
    if (isSuperAdmin(state.role)) return true
    return (state.permissions ?? []).some((p) => permissionMatches(p, module, action))
  }

/**
 * Selector for the derived "is authenticated" state.
 * Stable boolean — no object allocations.
 */
export const selectIsAuthenticated = (state: AuthState): boolean => state.accessToken !== null

/**
 * Selector for the loading/hydrating state.
 * Used by RoleGuard to avoid flashing a 403 before auth is restored from localStorage.
 */
export const selectIsLoading = (state: AuthState): boolean => state.isLoading

// ── Standalone helper (for non-React contexts like the API interceptor) ──────
export function canAccess(permissions: Permission[], module: Module, action: Action): boolean {
  return (permissions ?? []).some((p) => permissionMatches(p, module, action))
}

// ── Store ───────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>()(
  persist(
    immer((set) => ({
      userId: null,
      fullName: null,
      role: null,
      permissions: [],
      accessToken: null,
      expiresAt: null,
      isLoading: true,

      login: (payload) =>
        set((state) => {
          state.userId = payload.userId
          state.fullName = payload.fullName
          state.role = payload.role
          state.permissions = payload.permissions
          state.accessToken = payload.accessToken
          state.expiresAt = payload.expiresAt
          state.isLoading = false
        }),

      setAccessToken: (token, expiresAt) =>
        set((state) => {
          state.accessToken = token
          state.expiresAt = expiresAt
        }),

      clearAuth: () =>
        set((state) => {
          state.userId = null
          state.fullName = null
          state.role = null
          state.permissions = []
          state.accessToken = null
          state.expiresAt = null
          state.isLoading = false

          // Clear notifications on logout
          void import('./notifStore').then(({ useNotifStore }) => {
            useNotifStore.setState({ notifications: [], unreadCount: 0, sseConnected: false })
          })
        }),

      setLoading: (loading) =>
        set((state) => {
          state.isLoading = loading
        }),
    })),
    {
      name: 'ok-erp-auth',
      // accessToken and expiresAt are NEVER persisted — they live in memory only.
      // The refresh token lives in an httpOnly cookie (not JS-accessible).
      partialize: (state) => ({
        userId: state.userId,
        fullName: state.fullName,
        role: state.role,
        permissions: state.permissions,
      }),

      // After hydration from localStorage completes, mark loading as done.
      // This prevents a flash of 403 on hard refresh while auth is being restored.
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (!error) {
            useAuthStore.getState().setLoading(false)
          }
        }
      },
    }
  )
)
