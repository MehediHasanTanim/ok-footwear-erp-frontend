import { useTranslation } from 'react-i18next'

export default function SystemPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('nav.system')}</h1>
      <p className="text-muted-foreground">
        {t('common.moduleComing', { module: t('nav.system'), sprint: 'Sprint 6' })}
      </p>
    </div>
  )
}
