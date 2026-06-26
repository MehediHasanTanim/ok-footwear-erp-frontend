import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'

export default function ForbiddenPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  // Extract the attempted path from router state (set by RoleGuard)
  const attemptedPath = (location.state as { from?: string } | null)?.from ?? '/'

  const role = useAuthStore((s) => s.role)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-6xl font-bold text-destructive">403</h1>
      <p className="text-lg font-medium">{t('auth.accessDenied')}</p>

      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Attempted path:</span> {attemptedPath}
        </p>
        {role && (
          <p>
            <span className="font-medium text-foreground">Current role:</span> {role}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate(-1 as unknown as string)}>
          Go Back
        </Button>
        <Button variant="default" onClick={() => navigate('/dashboard')}>
          {t('auth.goToDashboard')}
        </Button>
      </div>
    </div>
  )
}
