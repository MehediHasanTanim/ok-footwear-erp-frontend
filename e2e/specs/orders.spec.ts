import { expect, test } from '../fixtures/base'
import { OrdersPage } from '../pages/OrdersPage'

// ── Acceptance test #3: navigates to /orders and sees the seeded order
test.describe('Orders — E2E', () => {
  test('admin can view seeded orders on /orders page', async ({
    authenticatedPage,
    seedOrder,
  }) => {
    // Arrange — seed an order via API (not UI)
    const { orderNumber } = await seedOrder({
      customerName: 'E2E Test Customer',
      style: 'E2E-001',
      quantity: 100,
      deliveryDate: '2026-08-01',
    })

    // Act — open authenticated browser as admin
    const { page, cleanup } = await authenticatedPage('admin')
    const ordersPage = new OrdersPage(page)

    await ordersPage.gotoOrders()
    await ordersPage.expectLoaded()

    // Assert — the seeded order should appear in the table
    await ordersPage.expectOrderVisible(orderNumber)

    // Cleanup — delete the seeded order via API
    await page.request.delete(`/api/orders/${orderNumber}`)
    await cleanup()
  })

  test('orders page shows heading', async ({ authenticatedPage }) => {
    const { page, cleanup } = await authenticatedPage('admin')
    const ordersPage = new OrdersPage(page)

    await ordersPage.gotoOrders()
    await ordersPage.expectLoaded()

    await expect(ordersPage.heading).toBeVisible()

    await cleanup()
  })

  test('new order button exists for admin', async ({ authenticatedPage }) => {
    const { page, cleanup } = await authenticatedPage('admin')
    const ordersPage = new OrdersPage(page)

    await ordersPage.gotoOrders()
    await ordersPage.expectLoaded()

    await expect(ordersPage.newOrderButton).toBeVisible()

    await cleanup()
  })
})
