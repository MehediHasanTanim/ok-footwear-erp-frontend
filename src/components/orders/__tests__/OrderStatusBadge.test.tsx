// ── TC-FE-C-001 ─────────────────────────────────────────────────────────────
// OrderStatusBadge: renders correct label and CSS classes for all statuses.
//
// Key design decision: assertions read from ORDER_STATUS_META (the source
// constant), not from hardcoded class strings. If a designer changes
// bg-blue-100 to bg-emerald-100 in the constant, this test still passes
// because it verifies the component→constant relationship, not the constant's
// specific values.

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { I18nTestWrapper } from '@/test/i18n-wrapper'
import { ORDER_STATUS_META, ORDER_STATUSES, type OrderStatus } from '@/types/orders'

// ── Parametric test over all statuses ────────────────────────────────────────
describe('OrderStatusBadge — TC-FE-C-001', () => {
  it.each([...ORDER_STATUSES])(
    'renders correct label and classes for status: %s',
    (status: OrderStatus) => {
      const meta = ORDER_STATUS_META[status]

      render(
        <I18nTestWrapper>
          <OrderStatusBadge status={status} showTooltip={false} />
        </I18nTestWrapper>
      )

      // Assert label text (the i18n key, since the wrapper returns identity)
      expect(screen.getByText(meta.labelKey)).toBeInTheDocument()

      // Assert ARIA role — the outer <span>
      const badgeWrapper = screen.getByRole('status')
      expect(badgeWrapper).toBeInTheDocument()

      // The Tailwind colour classes (bg-*, text-*, etc.) are on the inner
      // <div> rendered by the Badge component, not on the outer <span>.
      const badgeInner = badgeWrapper.firstElementChild as HTMLElement
      expect(badgeInner).toBeInTheDocument()

      // Assert CSS classes from the meta constant
      // badgeClass is a combined string like "bg-blue-100 text-blue-800 dark:..."
      // Split and check each class token individually with toHaveClass
      if (meta.badgeClass) {
        const classTokens = meta.badgeClass.split(/\s+/).filter(Boolean)
        for (const token of classTokens) {
          // toHaveClass checks for class presence, not exact match —
          // so other classes on the element don't cause false failures.
          expect(badgeInner).toHaveClass(token)
        }
      }
    }
  )

  // ── Tooltip / title attribute assertion ──────────────────────────────────
  it('renders a title attribute with the description for the confirmed status', () => {
    const meta = ORDER_STATUS_META['confirmed']

    render(
      <I18nTestWrapper>
        <OrderStatusBadge status="confirmed" />
      </I18nTestWrapper>
    )

    // With showTooltip=true (default), the <span> should have a title attr
    const badge = screen.getByRole('status')
    // The title attribute holds the translated descriptionKey
    // (which is the key itself in the test wrapper)
    expect(badge).toHaveAttribute('title', meta.descriptionKey)
  })

  it('omits the title attribute when showTooltip is false', () => {
    render(
      <I18nTestWrapper>
        <OrderStatusBadge status="confirmed" showTooltip={false} />
      </I18nTestWrapper>
    )

    const badge = screen.getByRole('status')
    expect(badge).not.toHaveAttribute('title')
  })
})
