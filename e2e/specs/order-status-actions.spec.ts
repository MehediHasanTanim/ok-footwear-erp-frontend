/**
 * TC-E2E-ORD-003 · Sample-approval gate on confirmed → in_production.
 *
 * Verifies that when sample_approved = false on a confirmed order:
 *   1. The "in_production" transition button is absent from the UI.
 *   2. The status badge still reads "confirmed".
 *   3. A direct API call confirms the database has status = 'confirmed'.
 *
 * DESIGN CHOICE: Option B — absent button.
 * OrderStatusActions renders buttons from nextAllowedStates. When
 * sample_approved is false, the backend excludes 'in_production' from
 * nextAllowedStates, so the button is absent (not-disabled).
 * If the component is refactored to Option A (disabled button), this
 * test must be updated: switch not.toBeAttached() → toBeDisabled(),
 * add hover + tooltip assertions.
 *
 * Prerequisite: globalSetup seeds a confirmed order (sample_approved: false)
 * and writes its ID to e2e/fixtures/seed-ids.json as confirmedOrderId.
 */

import { expect, test } from '../fixtures/base'
import { OrderDetailPage } from '../pages/OrderDetailPage'
import { getOpsManagerToken } from '../helpers/get-token'
import seedIds from '../fixtures/seed-ids.json'

test.describe('Orders — Status Actions', () => {
  test(
    'TC-E2E-ORD-003: in_production button absent when sample not approved',
    async ({ authenticatedPage }) => {
      // Guard: seed data must exist
      expect(seedIds.confirmedOrderId, 'confirmedOrderId missing from seed-ids.json').toBeTruthy()

      const { page, cleanup } = await authenticatedPage('manager')
      const detail = new OrderDetailPage(page)

      // Navigate to the confirmed order
      await detail.goto(seedIds.confirmedOrderId)

      // 1. Status must be confirmed
      await expect(detail.statusBadge).toContainText(/confirmed/i)

      // 2. in_production button must be ABSENT (Option B — not in nextAllowedStates)
      const inProductionButton = detail.transitionButton('in_production')
      await expect(inProductionButton).not.toBeAttached()

      // 3. Confirmed and cancelled buttons should still be present
      //    (confirmed→cancelled is allowed regardless of sample approval)
      const cancelButton = detail.transitionButton('cancelled')
      await expect(cancelButton).toBeAttached()

      // 4. Direct API call: confirm backend still has status = confirmed
      const token = getOpsManagerToken()
      const apiBase = process.env.E2E_API_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
      const response = await page.request.get(
        `${apiBase}/api/orders/${seedIds.confirmedOrderId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      )
      expect(response.ok()).toBe(true)

      const body = await response.json()
      const orderData = body?.data ?? body
      expect(orderData.status).toBe('confirmed')
      expect(orderData.sample_approved).toBe(false)

      await cleanup()
    }
  )
})
