import {
  test as base,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test'

import { type Role, ROLES } from '../global-setup'

// ── Types ────────────────────────────────────────────────────────────────────
export interface SeedOrderPayload {
  customerName: string
  style: string
  quantity: number
  deliveryDate: string
}

export interface SeedOrderResult {
  orderId: string
  orderNumber: string
}

// ── Fixtures ────────────────────────────────────────────────────────────────
interface E2EFixtures {
  /** Returns an authenticated page for the given role. */
  authenticatedPage: (role?: Role) => Promise<{
    page: Page
    /** Cleanup: close the page. */
    cleanup: () => Promise<void>
  }>

  /** Creates a test order via API and returns its ID.  Deletes in teardown. */
  seedOrder: (payload: SeedOrderPayload) => Promise<SeedOrderResult>

  /** Raw API request context (authenticated as admin). */
  apiContext: APIRequestContext
}

// ── Extended test ───────────────────────────────────────────────────────────
export const test = base.extend<E2EFixtures>({
  // ── apiContext ──────────────────────────────────────────────────────────
  apiContext: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
      storageState: ROLES.admin.storageState,
    })
    await use(ctx)
    await ctx.dispose()
  },

  // ── authenticatedPage ───────────────────────────────────────────────────
  authenticatedPage: async ({ browser }, use) => {
    const factory = async (role: Role = 'admin') => {
      const context = await browser.newContext({ storageState: ROLES[role].storageState })
      const page = await context.newPage()
      return {
        page,
        cleanup: async () => {
          await page.close()
          await context.close()
        },
      }
    }
    await use(factory)
  },

  // ── seedOrder ───────────────────────────────────────────────────────────
  seedOrder: async ({ apiContext }, use) => {
    const factory = async (payload: SeedOrderPayload): Promise<SeedOrderResult> => {
      const response: APIResponse = await apiContext.post('/api/orders', {
        data: payload,
      })
      if (!response.ok()) {
        const body = await response.text()
        throw new Error(`[seedOrder] Failed to create order: ${response.status()} — ${body}`)
      }
      const { data } = await response.json()
      // Teardown is handled by the caller — we don't auto-delete here so
      // the test can assert on the created order before cleaning up.
      return { orderId: data.id, orderNumber: data.orderNumber }
    }
    await use(factory)
  },
})

export { expect } from '@playwright/test'
