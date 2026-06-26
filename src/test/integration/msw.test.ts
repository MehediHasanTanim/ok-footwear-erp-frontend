import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { apiClient } from '@/lib/api'
import { MOCK_ACCESS_TOKEN, MOCK_USER } from '@/mocks/handlers/auth.handlers'
import { server } from '@/mocks/server'
import { useAuthStore } from '@/stores/authStore'

describe('MSW + Axios integration', () => {
  it('intercepts auth/login and returns mock data', async () => {
    // Act — call the real Axios instance; MSW intercepts at the network level
    const result = await apiClient.post<typeof MOCK_USER>(
      `${import.meta.env.VITE_API_URL}/auth/login`,
      { email: 'admin@okfootwear.com', password: 'password' }
    )

    // Assert — the mocked handler returned our MOCK_USER shape
    expect(result).toMatchObject({
      userId: MOCK_USER.userId,
      fullName: MOCK_USER.fullName,
    })
  })

  it('returns 401 for invalid credentials', async () => {
    await expect(
      apiClient.post(`${import.meta.env.VITE_API_URL}/auth/login`, {
        email: 'wrong@email.com',
        password: 'wrong',
      })
    ).rejects.toThrow()
  })

  it('attaches Bearer token on authenticated requests', async () => {
    // Arrange — log in via the store (this is what LoginPage does)
    useAuthStore.getState().login({
      userId: MOCK_USER.userId,
      fullName: MOCK_USER.fullName,
      role: MOCK_USER.role,
      permissions: MOCK_USER.permissions,
      accessToken: MOCK_ACCESS_TOKEN,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    // Add a temporary handler that checks the Authorization header
    let capturedAuthHeader = ''
    server.use(
      http.get(`${import.meta.env.VITE_API_URL}/auth/me`, ({ request }) => {
        capturedAuthHeader = request.headers.get('Authorization') ?? ''
        return HttpResponse.json({ data: MOCK_USER })
      })
    )

    // Act
    await apiClient.get(`${import.meta.env.VITE_API_URL}/auth/me`)

    // Assert
    expect(capturedAuthHeader).toBe(`Bearer ${MOCK_ACCESS_TOKEN}`)

    // Clean up
    useAuthStore.getState().clearAuth()
  })

  it('unmocked endpoint throws error (onUnhandledRequest: error)', async () => {
    // This endpoint has NO handler → MSW should reject it.
    // The test verifies that the onUnhandledRequest: 'error' setting works.
    await expect(
      apiClient.get(`${import.meta.env.VITE_API_URL}/nonexistent-endpoint`)
    ).rejects.toThrow()
  })
})
