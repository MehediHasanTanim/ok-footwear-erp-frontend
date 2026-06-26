import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

// Placeholder — Sprint 2 delivers the full orders CRUD.
export default function OrdersPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4" data-testid="orders-heading">
      <h1 className="text-2xl font-bold">{t('nav.orders')}</h1>
      <p className="text-muted-foreground">
        {t('common.moduleComing', { module: t('nav.orders'), sprint: 'Sprint 2' })}
      </p>
      <Button disabled data-testid="orders-new-btn">
        {t('common.create')}
      </Button>
    </div>
  )
}
