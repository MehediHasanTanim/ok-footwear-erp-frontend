import { useTranslation } from 'react-i18next'

export default function BoardPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('nav.board')}</h1>
      <p className="text-muted-foreground">
        {t('common.moduleComing', { module: t('nav.board'), sprint: 'Sprint 5' })}
      </p>
    </div>
  )
}
