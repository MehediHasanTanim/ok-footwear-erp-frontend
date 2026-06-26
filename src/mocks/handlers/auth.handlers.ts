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

// ── Handlers ────────────────────────────────────────────────────────────────
export const authHandlers: HttpHandler[] = [
  // POST /auth/login
  http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }

    // Simulate invalid credentials
    if (body.email !== 'admin@okfootwear.com' || body.password !== 'password') {
      return HttpResponse.json(
        { detail: 'Invalid email or password', status: 401 },
        { status: 401 }
      )
    }

    return HttpResponse.json({
      data: {
        userId: MOCK_USER.userId,
        fullName: MOCK_USER.fullName,
        role: MOCK_USER.role,
        permissions: MOCK_USER.permissions,
        accessToken: MOCK_ACCESS_TOKEN,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
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
