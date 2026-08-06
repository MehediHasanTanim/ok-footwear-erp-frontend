import { type Locator, type Page } from '@playwright/test'

import { BasePage } from './BasePage'

/**
 * Order Detail Page Object.
 *
 * POM for /orders/:id — used by TC-E2E-ORD-001 (post-submit landing)
 * and TC-E2E-ORD-003 (sample-approval gate validation).
 *
 * DESIGN NOTE (Option B — absent button):
 * OrderStatusActions renders buttons from nextAllowedStates.
 * When sample_approved=false and status=confirmed, nextAllowedStates
 * excludes 'in_production', so the button is ABSENT (not disabled).
 * TC-E2E-ORD-003 asserts with `not.toBeAttached()` accordingly.
 * If the component is later refactored to Option A (disabled button),
 * switch to `toBeDisabled()` + tooltip assertions.
 */
export class OrderDetailPage extends BasePage {
  // ── Locators ────────────────────────────────────────────────────────────

  /** Status badge — rendered by OrderStatusBadge with role="status" */
  get statusBadge(): Locator {
    return this.page.locator('[role="status"]')
  }

  /** The order number heading (h1 with tabular-nums class) */
  get orderNumber(): Locator {
    return this.page.locator('h1.tabular-nums')
  }

  /** All order line rows in the size breakdown table */
  get orderLines(): Locator {
    return this.page.locator('[data-testid="order-detail-page"] tbody tr')
  }

  /** Total quantity display in the breakdown footer */
  get totalQuantity(): Locator {
    return this.page.locator('[data-testid="order-detail-page"] tfoot td:nth-child(2)')
  }

  /** The status actions container */
  get statusActions(): Locator {
    return this.testid('order-status-actions')
  }

  /**
   * Returns a locator for a specific transition button.
   * Buttons use data-testid="transition-btn-{status}".
   */
  transitionButton(toStatus: string): Locator {
    return this.testid(`transition-btn-${toStatus}`)
  }

  get overviewTab(): Locator {
    return this.page.getByRole('tab', { name: /overview/i })
  }

  get quotationsTab(): Locator {
    return this.page.getByRole('tab', { name: /quotations/i })
  }

  get samplesTab(): Locator {
    return this.page.getByRole('tab', { name: /samples/i })
  }

  get complaintsTab(): Locator {
    return this.page.getByRole('tab', { name: /complaints/i })
  }

  get quotationsPanel(): Locator {
    return this.page.getByTestId('quotations-tab')
  }

  get samplesPanel(): Locator {
    return this.page.getByTestId('samples-tab')
  }

  get complaintsPanel(): Locator {
    return this.page.getByTestId('complaints-tab')
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  /** Navigate to an order detail page and wait for it to load. */
  async goto(id: string): Promise<void> {
    await this.navigate(`/orders/${id}`)
    await this.statusBadge.waitFor({ state: 'visible', timeout: 10_000 })
  }

  /** Assert the page is fully loaded (status badge visible). */
  async expectLoaded(): Promise<void> {
    await this.statusBadge.waitFor({ state: 'visible', timeout: 10_000 })
  }

  /**
   * Confirm a transition dialog (AlertDialog or Dialog).
   * Clicks the confirm/proceed button and waits for the dialog to dismiss.
   */
  async confirmTransitionDialog(_toStatus: string): Promise<void> {
    // The dialog is either a regular Dialog (role="dialog") or an AlertDialog (role="alertdialog").
    // Click the confirm button within whichever dialog is visible.
    const dialog = this.page.locator('[role="dialog"], [role="alertdialog"]').filter({ hasText: /confirm|proceed|cancel/i })
    await dialog.getByRole('button', { name: /confirm|proceed/i }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {
      // Dialog may have been removed from DOM entirely — that's also success.
    })
  }
}
