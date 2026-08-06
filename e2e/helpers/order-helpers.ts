/**
 * E2E Order Helpers — reusable Playwright functions for order lifecycle.
 *
 * Used across Sprint 3–8 E2E tests to avoid duplicating UI orchestration.
 * All waits are on observable conditions — no page.waitForTimeout().
 */

import { type Page, expect } from '@playwright/test'

import { OrderCreateWizardPage } from '../pages/OrderCreateWizardPage'
import { OrderDetailPage } from '../pages/OrderDetailPage'
import type { OrderStatus } from '@/types/orders'

/**
 * Creates an order via the wizard and transitions it to 'confirmed' status.
 *
 * Defaults align with e2e/global-setup seeds (`Test Buyer Co.`, `E2E-ART-001`).
 *
 * @param options.approvedSample — when true, after confirm creates a PP sample
 *   round if needed and approves all pending samples.
 * @returns { orderId, orderNumber } — extracted from the detail page after confirmation.
 */
export async function createAndConfirmOrder(
  page: Page,
  options: {
    buyerName?: string
    articleCode?: string
    sizes?: Record<string, number>
    deliveryDate?: string
    approvedSample?: boolean
  } = {}
): Promise<{ orderId: string; orderNumber: string }> {
  const {
    buyerName = 'Test Buyer Co.',
    articleCode = 'E2E-ART-001',
    sizes = { '38': 100, '39': 100 },
    deliveryDate = '2027-06-01',
    approvedSample = false,
  } = options

  const wizard = new OrderCreateWizardPage(page)
  const detail = new OrderDetailPage(page)

  // Step 1: buyer, article, dates
  await wizard.goto()
  await wizard.selectBuyer(buyerName)
  await wizard.selectArticle(articleCode)
  await wizard.setDeliveryDate(deliveryDate)
  await wizard.goToNextStep()

  // Step 2: size run
  await wizard.step2.waitFor({ state: 'visible', timeout: 5_000 })
  for (const [size, qty] of Object.entries(sizes)) {
    await wizard.enterSizeQuantity(size, qty)
  }
  await wizard.goToNextStep()

  // Step 3: submit
  await wizard.step3.waitFor({ state: 'visible', timeout: 5_000 })
  await wizard.submit()

  // Extract IDs from detail page
  await page.waitForURL(/\/orders\/[0-9a-f-]+$/, { timeout: 10_000 })
  await detail.expectLoaded()

  const url = page.url()
  const orderId = url.split('/').pop() ?? ''
  const orderNumber = ((await detail.orderNumber.textContent()) ?? '').trim()

  // Transition to confirmed
  await expect(detail.transitionButton('confirmed')).toBeEnabled({ timeout: 10_000 })
  await detail.transitionButton('confirmed').click()
  await detail.confirmTransitionDialog('confirmed')
  await expect(detail.statusBadge).toContainText(/confirmed/i, { timeout: 10_000 })

  // Optional API verification (Swagger / Nest global prefix)
  const apiBase =
    process.env.E2E_API_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
  const resp = await page.request.get(`${apiBase}/api/v1/orders/${orderId}`)
  if (resp.ok()) {
    const body = await resp.json()
    const data = body?.data ?? body
    expect(data.status).toBe('confirmed')
  }

  if (approvedSample) {
    await approveAllSamples(page, orderId)
  }

  return { orderId, orderNumber }
}

/**
 * Approves all pending sample rounds for an order.
 *
 * Re-queries pending rows each iteration so DOM updates after approve do not skip rows.
 * If there are zero pending rounds and the tab is not yet approved, creates one PP round
 * via the UI, then approves.
 */
export async function approveAllSamples(page: Page, orderId: string): Promise<void> {
  const detail = new OrderDetailPage(page)
  await detail.goto(orderId)

  await detail.samplesTab.click()
  await detail.samplesPanel.waitFor({ state: 'visible', timeout: 10_000 })

  await page
    .waitForResponse(
      (resp) =>
        resp.url().includes(`/orders/${orderId}/samples`) &&
        resp.request().method() === 'GET' &&
        resp.status() === 200,
      { timeout: 10_000 }
    )
    .catch(() => {
      // List may already be cached from a prior visit
    })

  const pendingRows = page.locator(
    '[data-testid="sample-round-row"][data-approval-status="pending"]'
  )
  const badge = page.locator('[data-testid="samples-tab-badge"]')

  let pendingCount = await pendingRows.count()
  if (pendingCount === 0) {
    const alreadyApproved = /approved/i.test((await badge.textContent()) ?? '')
    if (alreadyApproved) return

    await page.getByTestId('add-sample-btn').click()
    const sheet = page.locator('[role="dialog"]').filter({ hasText: /add|round|sample/i })
    await sheet.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined)
    await page.getByRole('button', { name: /save/i }).click()
    await expect(pendingRows.first()).toBeVisible({ timeout: 10_000 })
    pendingCount = await pendingRows.count()
  }

  let approvedCount = 0
  while ((await pendingRows.count()) > 0) {
    const before = await pendingRows.count()
    const row = pendingRows.first()
    await row.getByRole('button', { name: /approve/i }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await dialog.getByRole('button', { name: /approve/i }).click()
    await expect(dialog).not.toBeAttached({ timeout: 5_000 })

    approvedCount += 1
    await expect.poll(async () => pendingRows.count(), { timeout: 10_000 }).toBe(before - 1)
  }

  if (approvedCount > 0 || /approved/i.test((await badge.textContent()) ?? '')) {
    await expect(badge).toContainText(/approved/i, { timeout: 10_000 })
  }
}

/**
 * Drives an order through the full production cycle:
 * confirmed → in_production → qc → packed → delivered.
 *
 * Precondition: order must be in 'confirmed'. If sample approval gates
 * `in_production`, this helper calls `approveAllSamples` once and retries.
 */
export async function completeProductionCycle(page: Page, orderId: string): Promise<void> {
  const detail = new OrderDetailPage(page)
  await detail.goto(orderId)

  await detail.overviewTab.click()

  const transitions: OrderStatus[] = ['in_production', 'qc', 'packed', 'delivered']
  for (const toStatus of transitions) {
    const btn = detail.transitionButton(toStatus)
    const visible = await btn.isVisible().catch(() => false)

    if (!visible && toStatus === 'in_production') {
      await approveAllSamples(page, orderId)
      await detail.goto(orderId)
      await detail.overviewTab.click()
    }

    await expect(detail.transitionButton(toStatus)).toBeEnabled({ timeout: 10_000 })
    await detail.transitionButton(toStatus).click()
    await detail.confirmTransitionDialog(toStatus)
    await expect(detail.statusBadge).toContainText(new RegExp(toStatus.replace('_', '[_ ]'), 'i'), {
      timeout: 10_000,
    })
  }
}
