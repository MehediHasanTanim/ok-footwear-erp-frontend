import { setupServer, type SetupServer } from 'msw/node'

import { handlers } from '@/mocks/handlers'

// MSW v2 server for Vitest (node environment).
// MSW intercepts fetch/axios at the network level — no need to mock axios directly.
export const server: SetupServer = setupServer(...handlers)

// ── Lifecycle hooks ─────────────────────────────────────────────────────────
// These are called by setupTests.ts.  Vitest hooks (beforeAll, afterAll, etc.)
// are injected via globals: true in vitest.config.ts.
export function startMSW(): void {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
}
