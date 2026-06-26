import { type Locator, type Page } from '@playwright/test'

/**
 * Base Page Object — all POM classes extend this.
 * Provides common helpers: navigation, waiting, data-testid selectors.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Select by data-testid — the ONLY allowed selector for interactive elements. */
  protected testid(id: string): Locator {
    return this.page.locator(`[data-testid="${id}"]`)
  }

  /** Navigate to a path relative to baseURL. */
  async navigate(path: string): Promise<void> {
    await this.page.goto(path)
    await this.page.waitForLoadState('networkidle')
  }

  /** Wait for the page title to contain the given text. */
  async waitForTitle(text: string): Promise<void> {
    await this.page.waitForFunction(
      (t: string) => document.title.includes(t),
      text
    )
  }
}
