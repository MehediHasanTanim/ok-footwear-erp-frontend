import { useTranslation } from 'react-i18next'

export default function FinancePage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('nav.finance')}</h1>
      <p className="text-muted-foreground">
        {t('common.moduleComing', { module: t('nav.finance'), sprint: 'Sprint 4' })}
      </p>
    </div>
  )
}
