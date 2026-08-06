import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type AxiosError } from 'axios'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Loader2, Shield, Key, Monitor, Trash2, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────
interface Session {
  id: string
  ip: string
  user_agent: string
  created_at: string
  last_active_at: string
  current: boolean
}

interface TwoFactorSetupResponse {
  otpauth_url: string
  secret: string
}

// ── Zod schema for change password ───────────────────────────────────────────
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one digit')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })

type PasswordFormData = z.infer<typeof passwordSchema>

// ── Helpers ──────────────────────────────────────────────────────────────────
const OTP_LENGTH = 6

/** Parse user agent string into a readable browser/OS name */
function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown'
  // Extract browser
  let browser = ''
  if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Safari')) browser = 'Safari'
  else if (ua.includes('Edge')) browser = 'Edge'
  else browser = ua.split(' ')[0] ?? 'Browser'

  // Extract OS
  let os = ''
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

  return os ? `${browser} on ${os}` : browser
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const queryClient = useQueryClient()

  // ── Change Password ────────────────────────────────────────────────────────
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register: registerPw,
    handleSubmit: handleSubmitPw,
    setError: setPwError,
    reset: resetPw,
    formState: { errors: pwErrors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  })

  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
    },
    onSuccess: () => {
      toast.success('Password changed successfully')
      resetPw()
    },
    onError: (
      err: AxiosError<{ errors?: Array<{ field: string; message: string }>; detail?: string }>
    ) => {
      const serverErrors = err.response?.data?.errors
      if (serverErrors && Array.isArray(serverErrors)) {
        for (const { field, message } of serverErrors) {
          const formField =
            field === 'current_password' ? 'currentPassword' : (field as keyof PasswordFormData)
          setPwError(formField, { message })
        }
      } else if (err.response?.status === 401) {
        setPwError('currentPassword', { message: 'Current password is incorrect' })
      } else {
        toast.error(err.response?.data?.detail ?? 'Failed to change password')
      }
    },
  })

  // ── 2FA ────────────────────────────────────────────────────────────────────
  const [twoFactorState, setTwoFactorState] = useState<
    'loading' | 'disabled' | 'setup' | 'enabled'
  >('loading')
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null)
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [otpError, setOtpError] = useState<string | null>(null)
  const [secretCopied, setSecretCopied] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [disableDialogOpen, setDisableDialogOpen] = useState(false)

  // Fetch current 2FA status
  const { data: twoFactorStatus, isPending: twoFactorLoading } = useQuery({
    queryKey: ['auth', '2fa', 'status'],
    queryFn: async () => {
      const { data: res } = await api.get<{ data: { enabled: boolean } }>('/auth/2fa/status')
      return res.data ?? res
    },
  })

  useEffect(() => {
    if (twoFactorLoading) return
    setTwoFactorState(twoFactorStatus?.enabled ? 'enabled' : 'disabled')
  }, [twoFactorStatus, twoFactorLoading])

  // Setup 2FA → get QR + secret
  const setupMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await api.post<{ data: TwoFactorSetupResponse }>('/auth/2fa/setup')
      return res.data ?? res
    },
    onSuccess: (data) => {
      setSetupData(data as TwoFactorSetupResponse)
      setTwoFactorState('setup')
      setOtp(Array(OTP_LENGTH).fill(''))
      setOtpError(null)
      // Focus first OTP input
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    },
    onError: () => {
      toast.error('Failed to set up 2FA')
    },
  })

  // Verify 2FA code
  const verifyMutation = useMutation({
    mutationFn: async (totpCode: string) => {
      await api.post('/auth/2fa/verify', { totpCode })
    },
    onSuccess: () => {
      toast.success('Two-factor authentication enabled')
      setTwoFactorState('enabled')
      setSetupData(null)
      setOtp(Array(OTP_LENGTH).fill(''))
      void queryClient.invalidateQueries({ queryKey: ['auth', '2fa', 'status'] })
    },
    onError: () => {
      setOtpError('Invalid verification code')
      setOtp(Array(OTP_LENGTH).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    },
  })

  // Disable 2FA
  const disableMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/2fa/disable')
    },
    onSuccess: () => {
      toast.success('Two-factor authentication disabled')
      setTwoFactorState('disabled')
      setDisableDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['auth', '2fa', 'status'] })
    },
    onError: () => {
      toast.error('Failed to disable 2FA')
    },
  })

  // ── OTP input handlers ────────────────────────────────────────────────────
  const handleOtpChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d?$/.test(value)) return
      const next = [...otp]
      next[index] = value
      setOtp(next)
      setOtpError(null)

      // Auto-advance to next input
      if (value && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus()
      }

      // Auto-submit when all 6 filled
      const code = next.join('')
      if (code.length === OTP_LENGTH && next.every(Boolean)) {
        verifyMutation.mutate(code)
      }
    },
    [otp, verifyMutation]
  )

  const handleOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    },
    [otp]
  )

  const handleOtpPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault()
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
      const next = Array(OTP_LENGTH).fill('')
      for (let i = 0; i < pasted.length; i++) {
        next[i] = pasted[i]!
      }
      setOtp(next)
      setOtpError(null)
      const code = next.join('')
      if (code.length === OTP_LENGTH) {
        verifyMutation.mutate(code)
      }
    },
    [verifyMutation]
  )

  // ── Active Sessions ────────────────────────────────────────────────────────
  const { data: sessions = [], isPending: sessionsLoading } = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: async () => {
      const { data: res } = await api.get<{ data: Session[] }>('/auth/sessions')
      const arr = Array.isArray(res) ? res : (res.data ?? [])
      return arr as Session[]
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/auth/sessions/${sessionId}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] })
      toast.success('Session revoked')
    },
    onError: () => {
      toast.error('Failed to revoke session')
    },
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-8" data-testid="profile-page">
      <h1 className="text-2xl font-bold">Profile & Security</h1>

      {/* ── Section 1: Change Password ───────────────────────────────────── */}
      <section className="rounded-md border p-6" data-testid="change-password-section">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Key className="h-5 w-5" />
          Change Password
        </h2>
        <form onSubmit={handleSubmitPw((d) => passwordMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Current Password</label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                {...registerPw('currentPassword')}
                className={cn(pwErrors.currentPassword && 'border-destructive')}
                data-testid="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-2.5 text-muted-foreground"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwErrors.currentPassword && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {pwErrors.currentPassword.message}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">New Password</label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                {...registerPw('newPassword')}
                className={cn(pwErrors.newPassword && 'border-destructive')}
                data-testid="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-2.5 text-muted-foreground"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwErrors.newPassword && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {pwErrors.newPassword.message}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Min 8 characters: uppercase, lowercase, digit, and special character.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirm New Password</label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                {...registerPw('confirmNewPassword')}
                className={cn(pwErrors.confirmNewPassword && 'border-destructive')}
                data-testid="confirm-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-2.5 text-muted-foreground"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwErrors.confirmNewPassword && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {pwErrors.confirmNewPassword.message}
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={passwordMutation.isPending}
            data-testid="change-password-btn"
          >
            {passwordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change Password
          </Button>
        </form>
      </section>

      {/* ── Section 2: Two-Factor Authentication ──────────────────────────── */}
      <section className="rounded-md border p-6" data-testid="two-factor-section">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Shield className="h-5 w-5" />
          Two-Factor Authentication
        </h2>

        {twoFactorState === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {twoFactorState === 'disabled' && (
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              Add an extra layer of security to your account by enabling two-factor authentication.
            </p>
            <Button
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
              data-testid="enable-2fa-btn"
            >
              {setupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enable 2FA
            </Button>
          </div>
        )}

        {twoFactorState === 'setup' && setupData && (
          <div data-testid="2fa-setup">
            <p className="mb-4 text-sm text-muted-foreground">
              Scan the QR code with your authenticator app, then enter the 6-digit code to verify.
            </p>
            <div className="mb-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(setupData.otpauth_url)}&size=200x200`}
                alt="QR Code"
                className="rounded-md border"
                width={200}
                height={200}
                data-testid="2fa-qr"
              />
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Manual setup key:</p>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-sm" data-testid="2fa-secret">
                    {setupData.secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(setupData.secret)
                      setSecretCopied(true)
                      setTimeout(() => setSecretCopied(false), 2000)
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {secretCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* OTP Input */}
            <div className="mb-3">
              <label className="mb-2 block text-sm font-medium">Verification Code</label>
              <div className="flex gap-2" data-testid="2fa-otp-inputs">
                {otp.map((digit, i) => (
                  <Input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    className={cn(
                      'h-12 w-12 text-center text-lg',
                      otpError && 'border-destructive'
                    )}
                    data-testid={`otp-input-${i}`}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>
              {otpError && (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {otpError}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {verifyMutation.isPending ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Verifying…
                </span>
              ) : (
                'Enter the 6-digit code from your authenticator app'
              )}
            </p>
          </div>
        )}

        {twoFactorState === 'enabled' && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800">Enabled</Badge>
              <span className="text-sm text-muted-foreground">
                Your account is protected with two-factor authentication.
              </span>
            </div>
            <Button
              variant="destructive"
              onClick={() => setDisableDialogOpen(true)}
              data-testid="disable-2fa-btn"
            >
              Disable 2FA
            </Button>
          </div>
        )}
      </section>

      {/* ── Section 3: Active Sessions ─────────────────────────────────────── */}
      <section className="rounded-md border p-6" data-testid="sessions-section">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Monitor className="h-5 w-5" />
          Active Sessions
        </h2>

        {sessionsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" data-testid="sessions-table">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Last Active</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-b" data-testid={`session-${session.id}`}>
                    <td
                      className="max-w-[200px] truncate px-3 py-2 text-xs"
                      title={session.user_agent}
                    >
                      {parseUserAgent(session.user_agent)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{session.ip}</td>
                    <td className="px-3 py-2 text-xs">{formatTimestamp(session.last_active_at)}</td>
                    <td className="px-3 py-2">
                      {session.current ? (
                        <Badge variant="secondary" className="text-xs">
                          This device
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {!session.current && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => revokeMutation.mutate(session.id)}
                          disabled={revokeMutation.isPending}
                          data-testid={`revoke-session-${session.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Disable 2FA Confirmation Dialog ────────────────────────────────── */}
      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Are you sure you want to disable 2FA? Your account will be less secure.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => disableMutation.mutate()}
              disabled={disableMutation.isPending}
              data-testid="confirm-disable-2fa"
            >
              {disableMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTimestamp(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return iso
  }
}
