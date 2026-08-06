/**
 * Smoke: order helpers (createAndConfirmOrder + approveAllSamples).
 *
 * Tagged @smoke so it can be filtered: npx playwright test --grep @smoke
 * Prerequisite: globalSetup seeds E2E buyer/article fixtures.
 */

import { expect, test } from '../fixtures/base'
import { createAndConfirmOrder, approveAllSamples } from '../helpers/order-helpers'
import { OrderDetailPage } from '../pages/OrderDetailPage'
import seedIds from '../fixtures/seed-ids.json'

test.describe('Orders — Helpers smoke @smoke', () => {
  test(
    'createAndConfirmOrder + approveAllSamples',
    { tag: '@smoke' },
    async ({ authenticatedPage }) => {
      expect(seedIds.buyerId, 'buyerId missing from seed-ids.json').toBeTruthy()
      expect(seedIds.articleId, 'articleId missing from seed-ids.json').toBeTruthy()

      const { page, cleanup } = await authenticatedPage('manager')

      try {
        const { orderId } = await createAndConfirmOrder(page, {
          sizes: { '38': 10, '39': 10 },
        })
        expect(orderId).toBeTruthy()

        await approveAllSamples(page, orderId)

        const detail = new OrderDetailPage(page)
        await detail.goto(orderId)
        await detail.samplesTab.click()
        await expect(page.getByTestId('samples-tab-badge')).toContainText(/approved/i, {
          timeout: 10_000,
        })
      } finally {
        await cleanup()
      }
    }
  )
})
