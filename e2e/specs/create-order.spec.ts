/**
 * TC-E2E-ORD-001 · Order manager creates order with full size breakdown.
 *
 * Runs on a factory tablet viewport (iPad gen 7, 810×1080, touch).
 * Verifies the end-to-end create-order pipeline:
 *   wizard → API → doc number generation → detail page with size lines.
 *
 * Prerequisite: globalSetup seeds a test buyer and article, writing their
 * IDs to e2e/fixtures/seed-ids.json.
 *
 * NOTE: No dedicated tablet route (/tablet/*) exists yet.
 * This test uses the desktop /orders/new route with tablet viewport
 * emulation as a lower-fidelity proxy.  Flagged as a known gap —
 * a dedicated tablet PWA route should be added for true tablet validation.
 */

import { expect, test, devices } from '@playwright/test'
import { OrderCreateWizardPage } from '../pages/OrderCreateWizardPage'
import { OrderDetailPage } from '../pages/OrderDetailPage'
import { getAuthPath } from '../helpers/get-token'
import seedIds from '../fixtures/seed-ids.json'

// ── Tablet device context ────────────────────────────────────────────────────
test.use({ ...devices['iPad (gen 7)'] })

test.describe('Orders — Create Flow (Tablet)', () => {
  test(
    'TC-E2E-ORD-001: order manager creates order with full size breakdown on tablet',
    async ({ browser }) => {
      // Guard: seed data must exist
      expect(seedIds.buyerId, 'buyerId missing from seed-ids.json').toBeTruthy()
      expect(seedIds.articleId, 'articleId missing from seed-ids.json').toBeTruthy()

      // Create authenticated context using manager role storage state
      const context = await browser.newContext({
        ...devices['iPad (gen 7)'],
        storageState: getAuthPath('manager'),
      })
      const page = await context.newPage()

      const wizard = new OrderCreateWizardPage(page)
      const detail = new OrderDetailPage(page)

      // ── Step 1: buyer, article, dates ──────────────────────────────────
      await wizard.goto()

      await wizard.selectBuyer('Test Buyer Co.')
      await wizard.selectArticle('E2E-ART-001')
      await wizard.setDeliveryDate('2027-03-01')

      // Set currency to USD (via select dropdown)
      const currencySelect = wizard.currencySelect
      if (await currencySelect.isVisible()) {
        await currencySelect.selectOption('USD')
      }

      await wizard.goToNextStep()

      // ── Step 2: size run entry ─────────────────────────────────────────
      await wizard.step2.waitFor({ state: 'visible', timeout: 5_000 })

      await wizard.enterSizeQuantity('38', 100)
      await wizard.enterSizeQuantity('39', 100)
      await wizard.enterSizeQuantity('40', 100)
      await wizard.enterSizeQuantity('41', 100)
      await wizard.enterSizeQuantity('42', 100)

      // Running total should now show 500
      await expect(wizard.runningTotal).toHaveText('500')

      // ── Tap target verification (tablet requirement: ≥ 48px) ───────────
      const sizeInputs = page.locator('[data-testid^="size-input-"]')
      const inputCount = await sizeInputs.count()
      for (let i = 0; i < inputCount; i++) {
        const input = sizeInputs.nth(i)
        const box = await input.boundingBox()
        expect(box?.height, `Size input ${i} tap target too small`).toBeGreaterThanOrEqual(48)
      }

      await wizard.goToNextStep()

      // ── Step 3: review and submit ──────────────────────────────────────
      await wizard.step3.waitFor({ state: 'visible', timeout: 5_000 })

      // Verify summary displays correct values
      await expect(wizard.summaryBuyerName).toContainText('Test Buyer Co.')
      await expect(wizard.summaryArticleCode).toContainText('E2E-ART-001')

      await wizard.submit()

      // ── Post-submit: landed on the new order's detail page ─────────────
      await page.waitForURL(/\/orders\/[0-9a-f-]+$/, { timeout: 10_000 })
      await detail.expectLoaded()

      // Status must be draft
      await expect(detail.statusBadge).toContainText(/draft/i)

      // Order number must match ORD-XXXXXX pattern
      await expect(detail.orderNumber).toHaveText(/^ORD-\d{6}$/)

      // Must have 5 size lines
      await expect(detail.orderLines).toHaveCount(5)

      // Total quantity must be 500
      await expect(detail.totalQuantity).toHaveText('500')

      // Cleanup
      await page.close()
      await context.close()
    }
  )
})
