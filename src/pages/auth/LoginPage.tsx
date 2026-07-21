import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import axios, { type AxiosError } from 'axios'
import { format } from 'date-fns'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuthStore, selectIsAuthenticated, parsePermissions } from '@/stores/authStore'

// ── Constants ────────────────────────────────────────────────────────────────
const BASE_URL: string = import.meta.env.VITE_API_URL

// ── Zod schema ───────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

// ── RFC 7807 error types ─────────────────────────────────────────────────────
interface RFC7807Error {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  /** Extension: validation errors keyed by field name (Record format) */
  errors?: Record<string, string[]>
}

// ── API response types ───────────────────────────────────────────────────────
/** Backend returns user profile WITH permissions inside the login response */
interface LoginResponse {
  data: {
    accessToken: string
    user: {
      id: string
      email: string
      fullName: string
      permissions: string[] // e.g. ["orders:read", "orders:create"]
    }
  }
}

interface MfaRequiredResponse {
  data: {
    mfaRequired: true
    tempToken: string
  }
}

// ── Type guard ───────────────────────────────────────────────────────────────
function isMfaResponse(data: LoginResponse | MfaRequiredResponse): data is MfaRequiredResponse {
  return 'mfaRequired' in data.data && data.data.mfaRequired === true
}

// ── Error mapper (RFC 7807 → React Hook Form setError + form-level messages) ─
function mapRFC7807Errors(
  axiosError: AxiosError<RFC7807Error>,
  setError: ReturnType<typeof useForm<LoginFormData>>['setError'],
  setFormError: (msg: string) => void
): void {
  const problem = axiosError.response?.data

  // 401 — invalid credentials (form-level)
  if (axiosError.response?.status === 401) {
    setFormError(problem?.detail ?? 'Invalid email or password')
    return
  }

  // 423 — account locked
  if (axiosError.response?.status === 423) {
    const detail = problem?.detail ?? 'Account temporarily locked'
    setFormError(detail)
    return
  }

  // RFC 7807 field-level errors from `errors` extension (Record<string, string[]>)
  if (problem?.errors && typeof problem.errors === 'object' && !Array.isArray(problem.errors)) {
    for (const [field, messages] of Object.entries(problem.errors)) {
      const message = Array.isArray(messages) ? messages[0] : String(messages)
      // Only set error for known form fields
      if (field === 'email' || field === 'password') {
        setError(field, { message })
      }
    }
    return
  }

  // Fallback: use detail as form-level error
  if (problem?.detail) {
    setFormError(problem.detail)
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const loginAction = useAuthStore((s) => s.login)

  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ── React Hook Form (must be before any conditional returns) ─────────────
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // ── TanStack Query v5 mutation ───────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      // POST /auth/login — backend returns tokens + user profile + permissions
      const loginRes = await axios.post<LoginResponse | MfaRequiredResponse>(
        `${BASE_URL}/auth/login`,
        data,
        { withCredentials: true }
      )

      if (isMfaResponse(loginRes.data)) {
        throw { __mfa: true, tempToken: loginRes.data.data.tempToken }
      }

      return loginRes.data
    },
    onSuccess: (responseData) => {
      setFormError(null)

      const { accessToken, user } = (responseData as LoginResponse).data

      loginAction({
        userId: user.id,
        fullName: user.fullName,
        role: '', // backend doesn't return role in login response
        permissions: parsePermissions(user.permissions),
        accessToken,
        expiresAt: '', // backend doesn't return expiresAt separately; JWT has exp
      })

      const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
      navigate(from, { replace: true })
    },
    onError: (error: unknown) => {
      // Handle MFA redirect (thrown from mutationFn)
      if (error && typeof error === 'object' && '__mfa' in error) {
        const mfa = error as { __mfa: true; tempToken: string }
        navigate('/auth/2fa', {
          state: { tempToken: mfa.tempToken },
          replace: true,
        })
        return
      }

      setFormError(null)
      mapRFC7807Errors(error as AxiosError<RFC7807Error>, setError, setFormError)
    },
  })

  // ── Redirect if already authenticated (MUST be after ALL hooks) ──────────
  if (isAuthenticated) {
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
    return <Navigate to={from} replace />
  }

  const onSubmit = (data: LoginFormData) => {
    setFormError(null)
    mutation.mutate(data)
  }

  // ── Extract 423 unlock time from detail message for formatted display ────
  const formatLockMessage = (msg: string): string => {
    // Pattern: "Account locked until 2026-07-08T14:30:00Z" or similar
    const match = msg.match(/until\s+(.+)$/i)
    if (match?.[1]) {
      try {
        const date = new Date(match[1])
        if (!isNaN(date.getTime())) {
          const formatted = format(date, 'HH:mm')
          return `Account locked until ${formatted}`
        }
      } catch {
        // If date parsing fails, return original message
      }
    }
    return msg
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      data-testid="login-form"
      noValidate
    >
      {/* ── Form-level error ─────────────────────────────────────────────── */}
      {formError && (
        <div
          role="alert"
          data-testid="login-form-error"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError.includes('locked') || formError.includes('until')
            ? formatLockMessage(formError)
            : formError}
        </div>
      )}

      {/* ── Email field ───────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          {t('auth.email')}
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          data-testid="login-email"
          {...register('email')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={cn(errors.email && 'border-destructive')}
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-sm text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* ── Password field with visibility toggle ─────────────────────────── */}
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          {t('auth.password')}
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            data-testid="login-password"
            {...register('password')}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className={cn('pr-10', errors.password && 'border-destructive')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            data-testid="password-toggle"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="mt-1 text-sm text-destructive" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* ── Submit button ────────────────────────────────────────────────── */}
      <Button
        type="submit"
        className="w-full"
        data-testid="login-submit"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('auth.signIn')}
          </>
        ) : (
          t('auth.signIn')
        )}
      </Button>
    </form>
  )
}
