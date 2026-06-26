import { useTranslation } from 'react-i18next'

export default function ProcurementPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('nav.procurement')}</h1>
      <p className="text-muted-foreground">
        {t('common.moduleComing', { module: t('nav.procurement'), sprint: 'Sprint 3' })}
      </p>
    </div>
  )
}
