import { Building2, ClipboardCheck, FileText, PackageCheck, ShoppingCart, Tags } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const CARDS = [
  {
    to: '/procurement/vendors',
    labelKey: 'procurement.nav.vendors',
    descKey: 'procurement.hub.vendorsDesc',
    icon: Building2,
  },
  {
    to: '/procurement/vendor-categories',
    labelKey: 'procurement.nav.categories',
    descKey: 'procurement.hub.categoriesDesc',
    icon: Tags,
  },
  {
    to: '/procurement/purchase-orders',
    labelKey: 'procurement.nav.purchaseOrders',
    descKey: 'procurement.hub.poDesc',
    icon: ShoppingCart,
  },
  {
    to: '/procurement/approvals',
    labelKey: 'procurement.nav.approvals',
    descKey: 'procurement.hub.approvalsDesc',
    icon: ClipboardCheck,
  },
  {
    to: '/procurement/grns/new',
    labelKey: 'procurement.nav.grn',
    descKey: 'procurement.hub.grnDesc',
    icon: PackageCheck,
  },
  {
    to: '/procurement/invoices',
    labelKey: 'procurement.nav.invoices',
    descKey: 'procurement.hub.invoicesDesc',
    icon: FileText,
  },
] as const

export default function ProcurementHubPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6" data-testid="procurement-hub">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.procurement')}</h1>
        <p className="text-muted-foreground">{t('procurement.hub.subtitle')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="rounded-lg border p-4 transition-colors hover:border-primary hover:bg-muted/40"
          >
            <card.icon className="mb-2 h-6 w-6 text-primary" />
            <h2 className="font-semibold">{t(card.labelKey)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(card.descKey)}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
