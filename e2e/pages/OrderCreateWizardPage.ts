import { type Locator, type Page } from '@playwright/test'

import { BasePage } from './BasePage'

/**
 * Order Create Wizard Page Object.
 *
 * POM for /orders/new — three-step wizard:
 *   Step 1: buyer, article, delivery date, currency
 *   Step 2: size run input grid
 *   Step 3: review summary and submit
 *
 * Used by TC-E2E-ORD-001 (factory tablet create-order flow).
 */
export class OrderCreateWizardPage extends BasePage {
  // ── Locators ────────────────────────────────────────────────────────────

  /** Wizard container */
  get wizard(): Locator {
    return this.testid('create-order-wizard')
  }

  /** Step 1 container */
  get step1(): Locator {
    return this.testid('wizard-step-1')
  }

  /** Step 2 container */
  get step2(): Locator {
    return this.testid('wizard-step-2')
  }

  /** Step 3 container */
  get step3(): Locator {
    return this.testid('wizard-step-3')
  }

  /** Search input for buyer */
  get buyerSearchInput(): Locator {
    return this.step1.getByPlaceholder(/search buyer/i)
  }

  /** Search input for article */
  get articleSearchInput(): Locator {
    return this.step1.getByPlaceholder(/search article/i)
  }

  /** Delivery date input */
  get deliveryDateInput(): Locator {
    return this.step1.getByLabel(/delivery date/i)
  }

  /** Currency dropdown */
  get currencySelect(): Locator {
    return this.step1.getByRole('combobox', { name: /currency/i })
  }

  /** "Next" button */
  get nextButton(): Locator {
    return this.testid('wizard-next-btn')
  }

  /** "Back" button */
  get backButton(): Locator {
    return this.step1.getByRole('button', { name: /back|previous/i })
  }

  /** Running total display in Step 2 */
  get runningTotal(): Locator {
    return this.testid('size-run-total')
  }

  /** Submit button on Step 3 */
  get submitButton(): Locator {
    return this.testid('wizard-submit-btn')
  }

  /** Total quantity on Step 3 summary */
  get summaryTotalQuantity(): Locator {
    return this.step3.getByText(/total quantity/i).locator('..').locator('p.font-medium')
  }

  /** Buyer name on Step 3 summary */
  get summaryBuyerName(): Locator {
    return this.step3.getByText(/buyer/i).first().locator('..').locator('p.font-medium')
  }

  /** Article code on Step 3 summary */
  get summaryArticleCode(): Locator {
    return this.step3.getByText(/article/i).first().locator('..').locator('p.font-medium')
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  /** Navigate to the create order page and wait for Step 1. */
  async goto(): Promise<void> {
    await this.navigate('/orders/new')
    await this.step1.waitFor({ state: 'visible', timeout: 10_000 })
  }

  /**
   * Select a buyer from the searchable dropdown.
   * Types the name, waits for the API response, then clicks the matching option.
   */
  async selectBuyer(name: string): Promise<void> {
    await this.buyerSearchInput.fill(name)
    // Wait for the buyers API to return before clicking
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/api/buyers') && resp.status() === 200,
      { timeout: 10_000 }
    )
    const option = this.step1.getByRole('button', { name: new RegExp(name, 'i') })
    await option.waitFor({ state: 'visible', timeout: 5_000 })
    await option.click()
  }

  /**
   * Select an article from the searchable dropdown.
   */
  async selectArticle(code: string): Promise<void> {
    await this.articleSearchInput.fill(code)
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/api/articles') && resp.status() === 200,
      { timeout: 10_000 }
    )
    const option = this.step1.getByRole('button', { name: new RegExp(code, 'i') })
    await option.waitFor({ state: 'visible', timeout: 5_000 })
    await option.click()
  }

  /** Set the delivery date. */
  async setDeliveryDate(date: string): Promise<void> {
    await this.deliveryDateInput.fill(date)
  }

  /** Select currency from the dropdown. */
  async setCurrency(currency: string): Promise<void> {
    await this.currencySelect.selectOption(currency)
  }

  /** Click "Next" and wait for the next step to appear. */
  async goToNextStep(): Promise<void> {
    await this.nextButton.click()
    // Wait for either step 2 or step 3 to be visible
    await Promise.race([
      this.step2.waitFor({ state: 'visible', timeout: 5_000 }),
      this.step3.waitFor({ state: 'visible', timeout: 5_000 }),
    ])
  }

  /**
   * Enter a quantity for a specific size cell.
   * Clears the existing value, then types the new quantity.
   */
  async enterSizeQuantity(size: string, qty: number): Promise<void> {
    const input = this.testid(`size-input-${size}`)
    await input.waitFor({ state: 'visible', timeout: 5_000 })
    await input.fill('') // clear
    await input.fill(String(qty))
  }

  /** Click Submit and wait for navigation away from /orders/new. */
  async submit(): Promise<void> {
    await this.submitButton.click()
    await this.page.waitForURL(
      (url) => !url.pathname.includes('/orders/new'),
      { timeout: 15_000 }
    )
  }
}
