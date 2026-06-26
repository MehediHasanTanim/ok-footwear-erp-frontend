import { useTranslation } from 'react-i18next'

export default function HRPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('nav.hr')}</h1>
      <p className="text-muted-foreground">
        {t('common.moduleComing', { module: t('nav.hr'), sprint: 'Sprint 4' })}
      </p>
    </div>
  )
}
