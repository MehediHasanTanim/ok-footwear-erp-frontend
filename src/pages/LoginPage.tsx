import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const { t } = useTranslation()
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@okfootwear.com')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    // DEVIATION: hardcoded "login" for Sprint 1 — backend auth not wired yet.
    // Sprint 2 replaces this with a real POST /auth/login call.
    login({
      userId: '00000000-0000-0000-0000-000000000001',
      fullName: 'Admin User',
      role: 'Super Admin',
      permissions: [
        { module: 'dashboard', action: 'read' },
        { module: 'orders', action: 'read' },
        { module: 'orders', action: 'create' },
        { module: 'orders', action: 'update' },
        { module: 'orders', action: 'delete' },
        { module: 'procurement', action: 'read' },
        { module: 'procurement', action: 'create' },
        { module: 'hr', action: 'read' },
        { module: 'finance', action: 'read' },
        { module: 'board', action: 'read' },
        { module: 'system', action: 'read' },
      ],
      accessToken: 'mock-jwt-token-sprint-1',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    navigate('/dashboard', { replace: true })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="login-form">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          {t('auth.email')}
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          data-testid="login-email"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          {t('auth.password')}
        </label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          data-testid="login-password"
        />
      </div>

      <Button type="submit" className="w-full" data-testid="login-submit">
        {t('auth.signIn')}
      </Button>
    </form>
  )
}
