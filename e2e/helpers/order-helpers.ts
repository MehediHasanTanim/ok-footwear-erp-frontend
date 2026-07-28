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
 * @returns { orderId, orderNumber } — extracted from the detail page after confirmation.
 */
export async function createAndConfirmOrder(
  page: Page,
  options: {
    buyerName?: string
    articleCode?: string
    sizes?: Record<string, number>
    deliveryDate?: string
  } = {}
): Promise<{ orderId: string; orderNumber: string }> {
  const {
    buyerName = 'Test Buyer Co.',
    articleCode = 'ART-001',
    sizes = { '38': 100, '39': 100 },
    deliveryDate = '2027-06-01',
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

  // API verification
  const apiBase = process.env.E2E_API_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
  const resp = await page.request.get(`${apiBase}/api/orders/${orderId}`)
  if (resp.ok()) {
    const body = await resp.json()
    const data = body?.data ?? body
    expect(data.status).toBe('confirmed')
  }

  return { orderId, orderNumber }
}

/**
 * Approves all pending sample rounds for an order.
 * Precondition: order must exist with sample rounds in 'pending' state.
 */
export async function approveAllSamples(page: Page, orderId: string): Promise<void> {
  const detail = new OrderDetailPage(page)
  await detail.goto(orderId)

  // Navigate to Samples tab
  await page.getByRole('tab', { name: /samples/i }).click()

  // Wait for samples to load
  await page.waitForResponse(
    (resp) => resp.url().includes(`/api/orders/${orderId}/samples`) && resp.status() === 200,
    { timeout: 10_000 }
  )

  // Find all pending sample rounds
  const pendingRows = page.locator('[data-testid="sample-round-row"][data-approval-status="pending"]')
  const count = await pendingRows.count()

  for (let i = 0; i < count; i++) {
    const row = pendingRows.nth(i)
    await row.getByRole('button', { name: /approve/i }).click()

    // Confirm the AlertDialog
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await dialog.getByRole('button', { name: /approve/i }).click()
    await expect(dialog).not.toBeAttached({ timeout: 5_000 })

    // Wait for this round to show 'approved'
    await expect(row).toHaveAttribute('data-approval-status', 'approved', { timeout: 10_000 })
  }

  // Verify the tab badge shows approved
  await expect(page.locator('[data-testid="samples-tab-badge"]')).toContainText(/approved/i, { timeout: 5_000 })
}

/**
 * Drives an order through the full production cycle:
 * confirmed → in_production → qc → packed → delivered.
 *
 * Precondition: order must be in 'confirmed' with sample_approved = true.
 * Call approveAllSamples() first if needed.
 */
export async function completeProductionCycle(page: Page, orderId: string): Promise<void> {
  const detail = new OrderDetailPage(page)
  await detail.goto(orderId)

  // Navigate to Overview tab
  await page.getByRole('tab', { name: /overview/i }).click()

  const transitions: OrderStatus[] = ['in_production', 'qc', 'packed', 'delivered']
  for (const toStatus of transitions) {
    await expect(detail.transitionButton(toStatus)).toBeEnabled({ timeout: 10_000 })
    await detail.transitionButton(toStatus).click()
    await detail.confirmTransitionDialog(toStatus)
    await expect(detail.statusBadge).toContainText(new RegExp(toStatus, 'i'), { timeout: 10_000 })
  }
}
