import {
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ClipboardCheck,
  Cpu,
  DollarSign,
  LayoutDashboard,
  Menu,
  Shield,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { NotificationDropdown } from '@/components/layout/NotificationDropdown'
import { Breadcrumb } from '@/components/nav/Breadcrumb'
import { UserDropdown } from '@/components/nav/UserDropdown'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useNotifications } from '@/hooks/useNotifications'
import { useUIStore } from '@/stores/uiStore'

// ── Nav item config — grouped by category ────────────────────────────────────
interface NavItem {
  to: string
  labelKey: string
  icon: ReactNode
}

interface NavGroup {
  titleKey: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: 'nav.dashboard',
    items: [
      {
        to: '/dashboard',
        labelKey: 'nav.dashboard',
        icon: <LayoutDashboard className="h-5 w-5" />,
      },
    ],
  },
  {
    titleKey: 'Operations',
    items: [
      { to: '/orders', labelKey: 'nav.orders', icon: <ClipboardList className="h-5 w-5" /> },
      {
        to: '/procurement',
        labelKey: 'nav.procurement',
        icon: <ShoppingCart className="h-5 w-5" />,
      },
    ],
  },
  {
    titleKey: 'Management',
    items: [
      { to: '/hr', labelKey: 'nav.hr', icon: <Users className="h-5 w-5" /> },
      { to: '/finance', labelKey: 'nav.finance', icon: <DollarSign className="h-5 w-5" /> },
    ],
  },
  {
    titleKey: 'Administration',
    items: [
      { to: '/board', labelKey: 'nav.board', icon: <Building2 className="h-5 w-5" /> },
      { to: '/system', labelKey: 'nav.system', icon: <Cpu className="h-5 w-5" /> },
      {
        to: '/system/users',
        labelKey: 'nav.users',
        icon: <Users className="h-5 w-5" />,
      },
      {
        to: '/system/roles',
        labelKey: 'nav.roles',
        icon: <Shield className="h-5 w-5" />,
      },
      {
        to: '/system/audit',
        labelKey: 'nav.auditLog',
        icon: <ClipboardList className="h-5 w-5" />,
      },
      {
        to: '/system/compliance',
        labelKey: 'nav.compliance',
        icon: <ClipboardCheck className="h-5 w-5" />,
      },
    ],
  },
]

// ── Sidebar ──────────────────────────────────────────────────────────────────
// NOTE: Zustand selectors are used per-component to isolate re-renders.
// The sidebar component re-renders ONLY when sidebarCollapsed changes.
// The child <Outlet /> does NOT re-render on sidebar toggle.

function Sidebar() {
  const { t } = useTranslation()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)
  const location = useLocation()

  return (
    <aside
      className="relative flex flex-col border-r bg-muted/40 transition-all duration-300 ease-in-out"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-4 z-10 h-6 w-6 rounded-full border bg-background shadow-sm"
        onClick={toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      {/* Logo area */}
      <div className="flex h-14 items-center justify-center border-b px-3">
        {collapsed ? (
          <BarChart3 className="h-6 w-6 text-primary" />
        ) : (
          <span className="text-sm font-bold">{t('app.title')}</span>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.titleKey} className="mb-4">
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.titleKey}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive =
                  location.pathname.startsWith(item.to) && item.to !== '/dashboard'
                    ? true
                    : location.pathname === item.to

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                    title={collapsed ? t(item.labelKey) : undefined}
                  >
                    {item.icon}
                    {!collapsed && <span>{t(item.labelKey)}</span>}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-2">
        {!collapsed && (
          <div className="mb-2 px-2">
            <LanguageSwitcher />
          </div>
        )}
      </div>
    </aside>
  )
}

// ── Topbar ───────────────────────────────────────────────────────────────────
function Topbar() {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
      {/* Mobile hamburger — hidden on desktop, shown on mobile via responsive class */}
      <MobileMenuTrigger />

      {/* Breadcrumb — auto-generated from route handle.crumb */}
      <div className="flex-1">
        <Breadcrumb />
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-1">
        <NotificationDropdown />
        <UserDropdown />
      </div>
    </header>
  )
}

// ── Mobile sidebar trigger ──────────────────────────────────────────────────
function MobileMenuTrigger() {
  const toggle = useUIStore((s) => s.toggleMobileMenu)

  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden"
      onClick={toggle}
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  )
}

// ── AppShell ─────────────────────────────────────────────────────────────────
export default function AppShell() {
  useNotifications()

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — hidden on mobile (rendered as Sheet instead) */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar — Sheet overlay */}
      <div className="md:hidden">
        <MobileSidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// ── Mobile sidebar — Sheet-based ─────────────────────────────────────────────

function MobileSidebar() {
  const { t } = useTranslation()
  const mobileMenuOpen = useUIStore((s) => s.mobileMenuOpen)
  const close = useUIStore((s) => s.setMobileMenuOpen)
  const location = useLocation()

  return (
    <Sheet open={mobileMenuOpen} onOpenChange={(open) => close(open)}>
      <SheetContent side="left" className="w-60 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>{t('app.title')}</SheetTitle>
        </SheetHeader>
        <nav className="overflow-y-auto p-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.titleKey} className="mb-4">
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.titleKey}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive =
                    location.pathname.startsWith(item.to) && item.to !== '/dashboard'
                      ? true
                      : location.pathname === item.to

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => close(false)}
                      className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      {item.icon}
                      <span>{t(item.labelKey)}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t p-3">
          <LanguageSwitcher />
        </div>
      </SheetContent>
    </Sheet>
  )
}
