// MSW v2 — http.get() / http.post() syntax (NOT rest.get() from v1).
import { http, HttpResponse, type HttpHandler } from 'msw'

import type { Permission } from '@/stores/authStore'

// ── Mock data ───────────────────────────────────────────────────────────────
export const MOCK_USER = {
  userId: '00000000-0000-0000-0000-000000000001',
  fullName: 'Test User',
  role: 'Super Admin',
  permissions: [
    { module: 'dashboard', action: 'read' },
    { module: 'orders', action: 'read' },
    { module: 'orders', action: 'create' },
  ] satisfies Permission[],
}

export const MOCK_ACCESS_TOKEN = 'mock-access-token'
export const MOCK_REFRESH_TOKEN = 'mock-refresh-httpOnly'

const BASE_URL = import.meta.env.VITE_API_URL

// ── Scenario query params (for test control) ─────────────────────────────────
// Tests append ?scenario=<name> to trigger specific server responses.
// This avoids resetHandlers() boilerplate in each test case.
type LoginScenario =
  | 'success'
  | '401'
  | '423'
  | 'mfa'
  | 'validation-error'
  | 'empty-password'
  | 'invalid-email'

function getScenario(url: string): LoginScenario {
  const parsed = new URL(url)
  return (parsed.searchParams.get('scenario') as LoginScenario) ?? 'success'
}

// ── Handlers ────────────────────────────────────────────────────────────────
export const authHandlers: HttpHandler[] = [
  // POST /auth/login
  http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }
    const url = request.url
    const scenario = getScenario(url)

    switch (scenario) {
      // ── 401 — Invalid credentials (RFC 7807) ──────────────────────────
      case '401':
        return HttpResponse.json(
          {
            type: 'https://api.okfootwear.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Invalid email or password',
          },
          { status: 401 }
        )

      // ── 423 — Account locked ─────────────────────────────────────────
      case '423': {
        const unlockTime = new Date(Date.now() + 15 * 60_000).toISOString() // 15 min from now
        return HttpResponse.json(
          {
            type: 'https://api.okfootwear.com/errors/account-locked',
            title: 'Account Locked',
            status: 423,
            detail: `Account locked until ${unlockTime}`,
          },
          { status: 423 }
        )
      }

      // ── MFA required ─────────────────────────────────────────────────
      case 'mfa':
        return HttpResponse.json({
          data: {
            mfaRequired: true,
            tempToken: 'mock-temp-token-for-2fa',
          },
        })

      // ── RFC 7807 field-level validation errors ────────────────────────
      case 'validation-error':
        return HttpResponse.json(
          {
            type: 'https://api.okfootwear.com/errors/validation-error',
            title: 'Validation Error',
            status: 422,
            detail: 'The request was invalid',
            errors: {
              email: ['Enter a valid email'],
              password: ['Password must be at least 8 characters'],
            },
          },
          { status: 422 }
        )

      // ── Empty password validation error ──────────────────────────────
      case 'empty-password':
        return HttpResponse.json(
          {
            type: 'https://api.okfootwear.com/errors/validation-error',
            title: 'Validation Error',
            status: 422,
            detail: 'The request was invalid',
            errors: {
              password: ['Password is required'],
            },
          },
          { status: 422 }
        )

      // ── Invalid email validation error ───────────────────────────────
      case 'invalid-email':
        return HttpResponse.json(
          {
            type: 'https://api.okfootwear.com/errors/validation-error',
            title: 'Validation Error',
            status: 422,
            detail: 'The request was invalid',
            errors: {
              email: ['Enter a valid email'],
            },
          },
          { status: 422 }
        )

      // ── Success (default) ────────────────────────────────────────────
      case 'success':
      default:
        // Simulate invalid credentials for wrong email/password combo
        if (body.email !== 'admin@okfootwear.com' || body.password !== 'password') {
          return HttpResponse.json(
            {
              type: 'https://api.okfootwear.com/errors/unauthorized',
              title: 'Unauthorized',
              status: 401,
              detail: 'Invalid email or password',
            },
            { status: 401 }
          )
        }

        // Login response: tokens + user profile with permissions as strings
        return HttpResponse.json({
          data: {
            accessToken: MOCK_ACCESS_TOKEN,
            user: {
              id: MOCK_USER.userId,
              email: 'admin@okfootwear.com',
              fullName: MOCK_USER.fullName,
              permissions: MOCK_USER.permissions.map((p) => `${p.module}:${p.action}`),
            },
          },
        })
    }
  }),

  // ── 2FA endpoints ──────────────────────────────────────────────────────────

  // POST /auth/2fa/verify
  http.post(`${BASE_URL}/auth/2fa/verify`, async ({ request }) => {
    const body = (await request.json()) as { tempToken: string; totpCode: string }

    // Wrong code
    if (body.totpCode !== '123456') {
      return HttpResponse.json(
        { detail: 'Invalid verification code', status: 400 },
        { status: 400 }
      )
    }

    // Valid code — return same format as login success
    return HttpResponse.json({
      data: {
        accessToken: MOCK_ACCESS_TOKEN,
        user: {
          id: MOCK_USER.userId,
          email: 'admin@okfootwear.com',
          fullName: MOCK_USER.fullName,
          permissions: MOCK_USER.permissions.map((p) => `${p.module}:${p.action}`),
        },
      },
    })
  }),

  // POST /auth/2fa/resend
  http.post(`${BASE_URL}/auth/2fa/resend`, () => {
    return HttpResponse.json({
      data: { message: 'Code resent successfully' },
    })
  }),

  // POST /auth/refresh
  http.post(`${BASE_URL}/auth/refresh`, () => {
    return HttpResponse.json({
      data: {
        accessToken: MOCK_ACCESS_TOKEN,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    })
  }),

  // GET /auth/me
  http.get(`${BASE_URL}/auth/me`, () => {
    return HttpResponse.json({
      data: MOCK_USER,
    })
  }),
]
