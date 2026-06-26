import { type ComponentType, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import {
  selectCan,
  selectIsAuthenticated,
  selectIsLoading,
  type Action,
  type Module,
  useAuthStore,
} from '@/stores/authStore'

export type { Action, Module, Permission } from '@/stores/authStore'

// ── RoleGuard (component wrapper) ────────────────────────────────────────────
// Usage: <RoleGuard module='orders' action='read'><OrdersPage /></RoleGuard>
// Redirects to /403 with { state: { from: location.pathname } } so the 403 page
// can display what was attempted.

interface RoleGuardProps {
  module: Module
  action: Action
  children: ReactNode
}

export function RoleGuard({ module, action, children }: RoleGuardProps) {
  const location = useLocation()
  const isLoading = useAuthStore(selectIsLoading)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const hasAccess = useAuthStore(selectCan(module, action))

  // While auth state is hydrating from localStorage (on hard refresh),
  // render nothing — NOT a redirect.  This prevents the flash-of-403 bug.
  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!hasAccess) {
    return <Navigate to="/403" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

// ── withRole HOC ─────────────────────────────────────────────────────────────
// Usage: export default withRole(OrdersPage, 'orders', 'read')
// Wraps a lazy-loaded page component with RoleGuard so the router doesn't need
// to manage the guard inline.

export function withRole<P extends object>(
  Component: ComponentType<P>,
  module: Module,
  action: Action
): ComponentType<P> {
  function WithRoleWrapper(props: P) {
    return (
      <RoleGuard module={module} action={action}>
        <Component {...props} />
      </RoleGuard>
    )
  }

  WithRoleWrapper.displayName = `withRole(${Component.displayName ?? Component.name ?? 'Component'})`
  return WithRoleWrapper
}
