import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { RoleGuard, type Action, type Module } from '@/lib/auth'
// Direct import for UsersPage — bypasses lazyRoute+RoleGuard issue
import AuditLogPage from '@/pages/system/AuditLogPage'
import CompliancePage from '@/pages/system/CompliancePage'
import ProfilePage from '@/pages/system/ProfilePage'
import RolesPage from '@/pages/system/RolesPage'
import UsersPage from '@/pages/system/UsersPage'

// ── Skeleton fallback shared by all lazy routes ──────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

// ── Lazy helper — wraps React.lazy + Suspense in one call ────────────────────
function lazyRoute(
  factory: () => Promise<{ default: ComponentType<unknown> }>,
  module?: Module,
  action?: Action
): ReactNode {
  const LazyComponent = lazy(factory)

  const element = (
    <Suspense fallback={<PageSkeleton />}>
      <LazyComponent />
    </Suspense>
  )

  if (module && action) {
    return (
      <RoleGuard module={module} action={action}>
        {element}
      </RoleGuard>
    )
  }
  return element
}

// ── Lazy page imports — every page is code-split ─────────────────────────────
const LoginPage = () => lazyRoute(() => import('@/pages/auth/LoginPage'))

const ForbiddenPage = () => lazyRoute(() => import('@/pages/ForbiddenPage'))

const NotFoundPageNode = lazyRoute(() => import('@/pages/NotFoundPage'))

const DashboardPage = () => lazyRoute(() => import('@/pages/DashboardPage'), 'dashboard', 'read')

const OrdersPage = () => lazyRoute(() => import('@/pages/OrdersPage'), 'orders', 'read')

const OrderDetailPage = () => lazyRoute(() => import('@/pages/OrderDetailPage'), 'orders', 'read')

const CreateOrderPage = () => lazyRoute(() => import('@/pages/CreateOrderPage'), 'orders', 'create')

const BuyersPage = () => lazyRoute(() => import('@/pages/system/BuyersPage'), 'orders', 'read')

const ArticlesPage = () => lazyRoute(() => import('@/pages/system/ArticlesPage'), 'orders', 'read')

const ProcurementPage = () =>
  lazyRoute(() => import('@/pages/ProcurementPage'), 'procurement', 'read')

const HRPage = () => lazyRoute(() => import('@/pages/HRPage'), 'hr', 'read')

const FinancePage = () => lazyRoute(() => import('@/pages/FinancePage'), 'finance', 'read')

const BoardPage = () => lazyRoute(() => import('@/pages/BoardPage'), 'board', 'read')

const SystemPage = () => lazyRoute(() => import('@/pages/SystemPage'), 'system', 'read')

// Layy layouts
const AppLayout = lazy(() => import('@/layouts/AppLayout'))
const AuthLayout = lazy(() => import('@/layouts/AuthLayout'))

// ── Router ──────────────────────────────────────────────────────────────────
export const router = createBrowserRouter([
  // Public routes
  {
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <AuthLayout />
      </Suspense>
    ),
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'auth/2fa',
        element: lazyRoute(() => import('@/pages/auth/TwoFactorPage')),
      },
    ],
  },

  // Standalone public error pages (no layout wrapper)
  {
    path: '403',
    element: <ForbiddenPage />,
  },
  {
    path: '404',
    element: <Suspense fallback={<PageSkeleton />}>{NotFoundPageNode}</Suspense>,
  },

  // Protected routes — wrapped in AppLayout (authenticated shell)
  {
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <AppLayout />
      </Suspense>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
        handle: { crumb: () => 'Dashboard' },
      },
      {
        path: 'orders',
        element: <OrdersPage />,
        handle: { crumb: () => 'Orders' },
      },
      {
        path: 'orders/new',
        element: <CreateOrderPage />,
        handle: { crumb: () => 'New Order' },
      },
      {
        path: 'orders/:id',
        element: <OrderDetailPage />,
        handle: { crumb: () => 'Order Detail' },
      },
      {
        path: 'procurement',
        element: <ProcurementPage />,
        handle: { crumb: () => 'Procurement' },
      },
      {
        path: 'hr',
        element: <HRPage />,
        handle: { crumb: () => 'Human Resources' },
      },
      {
        path: 'finance',
        element: <FinancePage />,
        handle: { crumb: () => 'Finance' },
      },
      {
        path: 'board',
        element: <BoardPage />,
        handle: { crumb: () => 'Board Meeting' },
      },
      {
        path: 'profile',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <ProfilePage />
          </Suspense>
        ),
        handle: { crumb: () => 'Profile' },
      },
      {
        path: 'system',
        element: <SystemPage />,
        handle: { crumb: () => 'System Settings' },
      },
      {
        path: 'system/users',
        element: (
          <RoleGuard module="system" action="read">
            <Suspense fallback={<PageSkeleton />}>
              <UsersPage />
            </Suspense>
          </RoleGuard>
        ),
        handle: { crumb: () => 'Users' },
      },
      {
        path: 'system/roles',
        element: (
          <RoleGuard module="system" action="update">
            <Suspense fallback={<PageSkeleton />}>
              <RolesPage />
            </Suspense>
          </RoleGuard>
        ),
        handle: { crumb: () => 'Roles' },
      },
      {
        path: 'system/audit',
        element: (
          <RoleGuard module="system" action="read">
            <Suspense fallback={<PageSkeleton />}>
              <AuditLogPage />
            </Suspense>
          </RoleGuard>
        ),
        handle: { crumb: () => 'Audit Log' },
      },
      {
        path: 'system/compliance',
        element: (
          <RoleGuard module="compliance" action="read">
            <Suspense fallback={<PageSkeleton />}>
              <CompliancePage />
            </Suspense>
          </RoleGuard>
        ),
        handle: { crumb: () => 'Compliance' },
      },
      {
        path: 'system/buyers',
        element: <BuyersPage />,
        handle: { crumb: () => 'Buyers' },
      },
      {
        path: 'system/articles',
        element: <ArticlesPage />,
        handle: { crumb: () => 'Articles' },
      },
    ],
  },

  // 404 catch-all — must be the LAST route in the tree
  {
    path: '*',
    element: <Navigate to="/404" replace />,
  },
])
