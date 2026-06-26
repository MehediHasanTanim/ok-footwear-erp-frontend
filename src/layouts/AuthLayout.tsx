import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'

/**
 * AuthLayout — centered card for the login page.
 * No sidebar, no nav.  The login form renders inside <Outlet />.
 */
export default function AuthLayout() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-4 text-center text-2xl font-bold">{t('app.title')}</h1>
        <Outlet />
      </div>
    </div>
  )
}
