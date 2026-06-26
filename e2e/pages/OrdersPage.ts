import { type Locator } from '@playwright/test'

import { BasePage } from './BasePage'

export class OrdersPage extends BasePage {
  // ── Selectors (data-testid only) ─────────────────────────────────────────
  get heading(): Locator {
    return this.testid('orders-heading')
  }

  get newOrderButton(): Locator {
    return this.testid('orders-new-btn')
  }

  get table(): Locator {
    return this.testid('orders-table')
  }

  get rows(): Locator {
    return this.testid('orders-row')
  }

  /** Get a specific row by order number. */
  rowByOrderNumber(orderNumber: string): Locator {
    return this.testid(`orders-row-${orderNumber}`)
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  async gotoOrders(): Promise<void> {
    await this.navigate('/orders')
  }

  /** Assert the orders page is visible. */
  async expectLoaded(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' })
  }

  /** Assert a specific order row exists. */
  async expectOrderVisible(orderNumber: string): Promise<void> {
    await this.rowByOrderNumber(orderNumber).waitFor({ state: 'visible' })
  }

  /** Count rows in the table. */
  async getRowCount(): Promise<number> {
    return this.rows.count()
  }
}
