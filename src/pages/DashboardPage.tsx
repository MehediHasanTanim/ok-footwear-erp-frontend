import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/authStore'

export default function DashboardPage() {
  const { t } = useTranslation()
  const fullName = useAuthStore((s) => s.fullName)
  const permissions = useAuthStore((s) => s.permissions)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
      <p className="text-muted-foreground">
        {t('dashboard.welcome', { name: fullName ?? 'User', count: permissions.length })}
      </p>
      <div className="flex flex-wrap gap-2">
        {permissions.map((p) => (
          <Badge key={`${p.module}-${p.action}`} variant="secondary">
            {p.module}:{p.action}
          </Badge>
        ))}
      </div>
    </div>
  )
}
