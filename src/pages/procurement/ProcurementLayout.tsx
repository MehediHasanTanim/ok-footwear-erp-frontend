import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/procurement', end: true, labelKey: 'procurement.nav.hub' },
  { to: '/procurement/vendors', labelKey: 'procurement.nav.vendors' },
  { to: '/procurement/vendor-categories', labelKey: 'procurement.nav.categories' },
  { to: '/procurement/purchase-orders', labelKey: 'procurement.nav.purchaseOrders' },
  { to: '/procurement/approvals', labelKey: 'procurement.nav.approvals' },
  { to: '/procurement/grns/new', labelKey: 'procurement.nav.grn' },
  { to: '/procurement/invoices', labelKey: 'procurement.nav.invoices' },
] as const

export default function ProcurementLayout() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4" data-testid="procurement-layout">
      <nav className="flex flex-wrap gap-2 border-b pb-2">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={'end' in link ? link.end : false}
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            {t(link.labelKey)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
