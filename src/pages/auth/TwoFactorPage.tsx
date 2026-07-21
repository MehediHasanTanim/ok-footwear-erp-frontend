import { useMutation } from '@tanstack/react-query'
import axios, { type AxiosError } from 'axios'
import { Loader2 } from 'lucide-react'
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore, parsePermissions } from '@/stores/authStore'

// ── Constants ────────────────────────────────────────────────────────────────
const BASE_URL: string = import.meta.env.VITE_API_URL
const OTP_LENGTH = 6
const COUNTDOWN_SECONDS = 30

// ── API response types ───────────────────────────────────────────────────────
interface VerifyResponse {
  data: {
    accessToken: string
    user: {
      id: string
      email: string
      fullName: string
      permissions: string[]
    }
  }
}

interface ResendResponse {
  data: {
    message: string
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function TwoFactorPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const loginAction = useAuthStore((s) => s.login)

  const tempToken = (location.state as { tempToken?: string } | null)?.tempToken

  // ── OTP state ─────────────────────────────────────────────────────────────
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // ── Countdown state ───────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const countdownRef = useRef(countdown)
  countdownRef.current = countdown

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(id)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, []) // Empty deps — interval self-manages via setCountdown functional updater

  const formattedCountdown = `${String(Math.floor(countdown / 60)).padStart(2, '0')}:${String(countdown % 60).padStart(2, '0')}`

  // ── OTP mutation ──────────────────────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: async (totpCode: string) => {
      const response = await axios.post<VerifyResponse>(
        `${BASE_URL}/auth/2fa/verify`,
        { tempToken, totpCode },
        { withCredentials: true }
      )
      return response.data
    },
    onSuccess: (responseData) => {
      const { accessToken, user } = responseData.data
      loginAction({
        userId: user.id,
        fullName: user.fullName,
        role: '',
        permissions: parsePermissions(user.permissions),
        accessToken,
        expiresAt: '',
      })
      navigate('/dashboard', { replace: true })
    },
    onError: (error: AxiosError<{ detail?: string; status?: number }>) => {
      // Expired tempToken — redirect to login
      if (error.response?.status === 401) {
        navigate('/login', {
          replace: true,
          state: { message: '2FA session expired. Please log in again.' },
        })
        return
      }
      // Wrong code — shake + error
      setErrorMessage(error.response?.data?.detail ?? 'Invalid verification code')
      setShaking(true)
      clearOtp()
      setTimeout(() => setShaking(false), 500)
    },
  })

  // ── Resend mutation ───────────────────────────────────────────────────────
  const resendMutation = useMutation({
    mutationFn: async () => {
      await axios.post<ResendResponse>(
        `${BASE_URL}/auth/2fa/resend`,
        { tempToken },
        { withCredentials: true }
      )
    },
    onSuccess: () => {
      setCountdown(COUNTDOWN_SECONDS)
      setErrorMessage(null)
      clearOtp()
    },
    onError: () => {
      setErrorMessage('Failed to resend code. Please try again.')
    },
  })

  // ── OTP input handlers ────────────────────────────────────────────────────
  const clearOtp = useCallback(() => {
    setOtp(Array(OTP_LENGTH).fill(''))
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    // Only accept single digits
    if (!/^\d?$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setErrorMessage(null)

    // Advance focus if a digit was entered
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are filled
    const code = newOtp.join('')
    if (code.length === OTP_LENGTH && !verifyMutation.isPending) {
      verifyMutation.mutate(code)
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Current input is empty: move back and clear previous
        const newOtp = [...otp]
        newOtp[index - 1] = ''
        setOtp(newOtp)
        inputRefs.current[index - 1]?.focus()
      } else if (otp[index]) {
        // Current input has a digit: clear it (default backspace behavior is fine)
        // React handles the state update via handleChange, but Backspace doesn't
        // trigger onChange. We handle it here.
        const newOtp = [...otp]
        newOtp[index] = ''
        setOtp(newOtp)
      }
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }

    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return

    const newOtp = Array(OTP_LENGTH).fill('')
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i]!
    }
    setOtp(newOtp)

    // Focus the next empty input or the last filled one
    const nextEmpty = newOtp.findIndex((d) => !d)
    if (nextEmpty >= 0 && nextEmpty < OTP_LENGTH) {
      inputRefs.current[nextEmpty]?.focus()
    } else {
      inputRefs.current[OTP_LENGTH - 1]?.focus()
    }

    // Auto-submit if all digits filled by paste
    if (newOtp.every((d) => d) && !verifyMutation.isPending) {
      verifyMutation.mutate(newOtp.join(''))
    }
  }

  // ── Guard: no tempToken → redirect to login ──────────────────────────────
  if (!tempToken) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex flex-col gap-5" data-testid="two-factor-page">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      {/* ── OTP Inputs ──────────────────────────────────────────────────── */}
      <div
        className={cn('flex justify-center gap-2', shaking && 'animate-shake')}
        onPaste={handlePaste}
        data-testid="otp-container"
      >
        {Array.from({ length: OTP_LENGTH }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={otp[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={verifyMutation.isPending}
            aria-label={`Digit ${i + 1}`}
            data-testid={`otp-input-${i}`}
            className={cn(
              'h-12 w-10 rounded-md border border-input bg-background text-center text-lg font-semibold',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              errorMessage && 'border-destructive'
            )}
            autoFocus={i === 0}
          />
        ))}
      </div>

      {/* ── Error message ────────────────────────────────────────────────── */}
      {errorMessage && (
        <p className="text-center text-sm text-destructive" role="alert" data-testid="otp-error">
          {errorMessage}
        </p>
      )}

      {/* ── Submit button (fallback for manual submission) ────────────────── */}
      <Button
        type="button"
        className="w-full"
        disabled={otp.some((d) => !d) || verifyMutation.isPending}
        data-testid="otp-submit"
        onClick={() => verifyMutation.mutate(otp.join(''))}
      >
        {verifyMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying…
          </>
        ) : (
          'Verify'
        )}
      </Button>

      {/* ── Countdown & Resend ───────────────────────────────────────────── */}
      <div className="text-center text-sm text-muted-foreground">
        {countdown > 0 ? (
          <span data-testid="otp-countdown">Resend code in {formattedCountdown}</span>
        ) : (
          <button
            type="button"
            onClick={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
            className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
            data-testid="otp-resend"
          >
            {resendMutation.isPending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </div>
    </div>
  )
}
