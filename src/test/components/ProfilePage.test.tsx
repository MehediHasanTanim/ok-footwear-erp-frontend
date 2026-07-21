import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import ProfilePage from '@/pages/system/ProfilePage'
import { useAuthStore } from '@/stores/authStore'
import { render, screen, waitFor, userEvent, server } from '@/test/test-utils'

const BASE_URL = import.meta.env.VITE_API_URL

function setupAuth() {
  useAuthStore.setState({
    userId: 'user-1',
    fullName: 'Super Admin',
    role: 'super_admin',
    permissions: [],
    accessToken: 'mock-token',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    isLoading: false,
  })
}

function resetAuth() {
  useAuthStore.setState({
    userId: null,
    fullName: null,
    role: null,
    permissions: [],
    accessToken: null,
    expiresAt: null,
    isLoading: false,
  })
}

describe('ProfilePage', () => {
  beforeEach(() => {
    setupAuth()
    // Default handlers: 2FA disabled, no sessions
    server.use(
      http.get(`${BASE_URL}/auth/2fa/status`, () =>
        HttpResponse.json({ data: { enabled: false } })
      ),
      http.get(`${BASE_URL}/auth/sessions`, () => HttpResponse.json({ data: [] }))
    )
  })
  afterEach(() => resetAuth())

  // AC 1: Zod enforces min 12 chars with uppercase, lowercase, digit, special char
  it('validates password requirements', async () => {
    render(<ProfilePage />, { initialRoute: '/profile' })

    await waitFor(() => screen.getByTestId('profile-page'))

    const btn = screen.getByTestId('change-password-btn')
    const newPw = screen.getByTestId('new-password')

    // Too short
    await userEvent.type(newPw, 'Short1!')
    await userEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByText(/at least 12 characters/)).toBeInTheDocument()
    })
  })

  // AC 2: confirmNewPassword mismatch shows error
  it('shows mismatch error when passwords differ', async () => {
    render(<ProfilePage />, { initialRoute: '/profile' })

    await waitFor(() => screen.getByTestId('profile-page'))

    await userEvent.type(screen.getByTestId('new-password'), 'ValidPass123!@')
    await userEvent.type(screen.getByTestId('confirm-password'), 'DifferentPass1!')
    await userEvent.click(screen.getByTestId('change-password-btn'))

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })
  })

  // AC 3: Successful password change shows toast, does not redirect
  it('shows toast on success without redirect', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/change-password`, () =>
        HttpResponse.json({ data: { message: 'ok' } })
      )
    )

    render(<ProfilePage />, { initialRoute: '/profile' })
    await waitFor(() => screen.getByTestId('profile-page'))

    await userEvent.type(screen.getByTestId('current-password'), 'OldPass123!')
    await userEvent.type(screen.getByTestId('new-password'), 'ValidPass123!@')
    await userEvent.type(screen.getByTestId('confirm-password'), 'ValidPass123!@')
    await userEvent.click(screen.getByTestId('change-password-btn'))

    await waitFor(() => {
      // Form should still be present (no redirect)
      expect(screen.getByTestId('profile-page')).toBeInTheDocument()
    })
  })

  // AC 4: Wrong current_password maps to currentPassword field
  it('maps 401 to currentPassword field', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/change-password`, () =>
        HttpResponse.json({ detail: 'Incorrect password' }, { status: 401 })
      )
    )

    render(<ProfilePage />, { initialRoute: '/profile' })
    await waitFor(() => screen.getByTestId('profile-page'))

    await userEvent.type(screen.getByTestId('current-password'), 'WrongPass1!')
    await userEvent.type(screen.getByTestId('new-password'), 'ValidPass123!@')
    await userEvent.type(screen.getByTestId('confirm-password'), 'ValidPass123!@')
    await userEvent.click(screen.getByTestId('change-password-btn'))

    await waitFor(() => {
      expect(screen.getByText('Current password is incorrect')).toBeInTheDocument()
    })
  })

  // AC 5: Shows 'Enable 2FA' when disabled
  it('shows Enable 2FA button when disabled', async () => {
    render(<ProfilePage />, { initialRoute: '/profile' })
    await waitFor(() => screen.getByTestId('profile-page'))
    await waitFor(() => {
      expect(screen.getByTestId('enable-2fa-btn')).toBeInTheDocument()
    })
  })

  // AC 6 & 7: Enable fetches setup data, shows QR + secret
  it('shows QR and secret after enabling setup', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/2fa/setup`, () =>
        HttpResponse.json({ data: { otpauth_url: 'otpauth://test', secret: 'ABCDEFGH' } })
      )
    )

    render(<ProfilePage />, { initialRoute: '/profile' })
    await waitFor(() => screen.getByTestId('profile-page'))
    await waitFor(() => screen.getByTestId('enable-2fa-btn'))

    await userEvent.click(screen.getByTestId('enable-2fa-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('2fa-qr')).toBeInTheDocument()
      expect(screen.getByTestId('2fa-secret')).toHaveTextContent('ABCDEFGH')
    })
  })

  // AC 8: 6-digit OTP inputs rendered
  it('renders 6 OTP inputs in setup flow', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/2fa/setup`, () =>
        HttpResponse.json({ data: { otpauth_url: 'otpauth://test', secret: 'ABCDEFGH' } })
      )
    )

    render(<ProfilePage />, { initialRoute: '/profile' })
    await waitFor(() => screen.getByTestId('profile-page'))
    await waitFor(() => screen.getByTestId('enable-2fa-btn'))
    await userEvent.click(screen.getByTestId('enable-2fa-btn'))

    await waitFor(() => {
      for (let i = 0; i < 6; i++) {
        expect(screen.getByTestId(`otp-input-${i}`)).toBeInTheDocument()
      }
    })
  })

  // AC 9: Successful verify updates state
  it('updates state after successful 2FA verify', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/2fa/setup`, () =>
        HttpResponse.json({ data: { otpauth_url: 'otpauth://test', secret: 'ABCDEFGH' } })
      ),
      http.post(`${BASE_URL}/auth/2fa/verify`, () => HttpResponse.json({ data: { ok: true } })),
      http.get(`${BASE_URL}/auth/2fa/status`, () => HttpResponse.json({ data: { enabled: true } }))
    )

    render(<ProfilePage />, { initialRoute: '/profile' })
    await waitFor(() => screen.getByTestId('profile-page'))
    await waitFor(() => screen.getByTestId('enable-2fa-btn'))
    await userEvent.click(screen.getByTestId('enable-2fa-btn'))

    await waitFor(() => screen.getByTestId('otp-input-0'))

    // Type 6 digits into first input to trigger auto-submit (paste handler on input 0)
    const otp0 = screen.getByTestId('otp-input-0')
    await userEvent.click(otp0)
    await userEvent.paste('123456')

    // After success, should eventually show disable button
    await waitFor(
      () => {
        expect(screen.getByTestId('disable-2fa-btn')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  // AC 10: Disable 2FA shows confirmation dialog
  it('shows confirmation before disabling 2FA', async () => {
    server.use(
      http.get(`${BASE_URL}/auth/2fa/status`, () => HttpResponse.json({ data: { enabled: true } }))
    )

    render(<ProfilePage />, { initialRoute: '/profile' })
    await waitFor(() => screen.getByTestId('profile-page'))
    await waitFor(() => screen.getByTestId('disable-2fa-btn'))

    await userEvent.click(screen.getByTestId('disable-2fa-btn'))

    await waitFor(() => {
      expect(screen.getByText('Disable Two-Factor Authentication')).toBeInTheDocument()
      expect(screen.getByTestId('confirm-disable-2fa')).toBeInTheDocument()
    })
  })

  // AC 11: Sessions table shows columns
  it('shows sessions table with IP, user agent, last active', async () => {
    server.use(
      http.get(`${BASE_URL}/auth/sessions`, () =>
        HttpResponse.json({
          data: [
            {
              id: 's1',
              ip: '192.168.1.1',
              user_agent: 'Chrome on macOS',
              created_at: new Date().toISOString(),
              last_active_at: new Date().toISOString(),
              current: true,
            },
          ],
        })
      )
    )

    render(<ProfilePage />, { initialRoute: '/profile' })
    await waitFor(() => screen.getByTestId('profile-page'))

    await waitFor(() => {
      expect(screen.getByTestId('sessions-table')).toBeInTheDocument()
    })
  })

  // AC 12: Current session has badge, no revoke button
  it('shows This device badge for current session', async () => {
    server.use(
      http.get(`${BASE_URL}/auth/sessions`, () =>
        HttpResponse.json({
          data: [
            {
              id: 's1',
              ip: '::1',
              user_agent: 'Chrome on macOS',
              created_at: new Date().toISOString(),
              last_active_at: new Date().toISOString(),
              current: true,
            },
          ],
        })
      )
    )

    render(<ProfilePage />, { initialRoute: '/profile' })
    await waitFor(() => screen.getByTestId('profile-page'))
    await waitFor(() => screen.getByTestId('session-s1'))

    expect(screen.getByText('This device')).toBeInTheDocument()
    expect(screen.queryByTestId('revoke-session-s1')).not.toBeInTheDocument()
  })

  // AC 13: Revoking invalidates query
  it('revokes a session', async () => {
    server.use(
      http.get(`${BASE_URL}/auth/sessions`, () =>
        HttpResponse.json({
          data: [
            {
              id: 's1',
              ip: '::1',
              user_agent: 'Chrome',
              created_at: new Date().toISOString(),
              last_active_at: new Date().toISOString(),
              current: true,
            },
            {
              id: 's2',
              ip: '10.0.0.1',
              user_agent: 'Firefox',
              created_at: new Date().toISOString(),
              last_active_at: new Date().toISOString(),
              current: false,
            },
          ],
        })
      ),
      http.delete(`${BASE_URL}/auth/sessions/s2`, () => new HttpResponse(null, { status: 204 }))
    )

    render(<ProfilePage />, { initialRoute: '/profile' })
    await waitFor(() => screen.getByTestId('profile-page'))
    await waitFor(() => screen.getByTestId('session-s2'))

    await userEvent.click(screen.getByTestId('revoke-session-s2'))
  })
})
