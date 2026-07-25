// ── TC-FE-Z-001, TC-FE-Z-002, TC-FE-Z-003 ───────────────────────────────────
// Zod schema unit tests for createOrderSchema.
// No DOM, no React — pure schema logic tested with safeParse().

import { describe, expect, it } from 'vitest'

import { createOrderSchema } from '@/lib/schemas'

// ── Valid baseline payload ───────────────────────────────────────────────────
// All fields are snake_case per the actual schema definition.
// delivery_date is hardcoded far in the future so the isAfterToday refine
// won't trip until this test file approaches that date.
// TODO: advance this date if this test starts failing in 2027
const VALID_PAYLOAD = {
  buyer_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  article_id: 'b2c3d4e5-f6a7-7890-bcde-f12345678901',
  order_type: 'bulk' as const,
  currency: 'USD',
  unit_price: 12.5,
  total_quantity: 100,
  delivery_date: '2027-06-01',
  order_lines: [
    { size_label: '38', quantity: 50, unit_price: 12.5 },
    { size_label: '39', quantity: 50, unit_price: 12.5 },
  ],
}

// ═══════════════════════════════════════════════════════════════════════════════
// TC-FE-Z-001 — valid payload accepted
// ═══════════════════════════════════════════════════════════════════════════════
describe('createOrderSchema — TC-FE-Z-001', () => {
  it('accepts a fully valid order payload', () => {
    const result = createOrderSchema.safeParse(VALID_PAYLOAD)

    expect(result.success).toBe(true)

    // Confirm safeParse returns data, not just success:true without payload
    expect(result.data).toBeDefined()

    // Sanity-check a specific field to confirm parsed output matches input
    if (result.success) {
      expect(result.data.currency).toBe('USD')
      expect(result.data.total_quantity).toBe(100)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TC-FE-Z-002 — empty orderLines array rejected
// ═══════════════════════════════════════════════════════════════════════════════
describe('createOrderSchema — TC-FE-Z-002', () => {
  it('rejects an empty orderLines array', () => {
    const result = createOrderSchema.safeParse({
      ...VALID_PAYLOAD,
      order_lines: [],
    })

    expect(result.success).toBe(false)

    if (!result.success) {
      // The error must be on order_lines, not on unrelated valid fields
      const orderLinesIssues = result.error.issues.filter(
        (issue) => issue.path[0] === 'order_lines'
      )
      expect(orderLinesIssues.length).toBeGreaterThan(0)

      // The code must be 'too_small' (Zod's code for .min(1) on arrays)
      const tooSmallIssue = orderLinesIssues.find((i) => i.code === 'too_small')
      expect(tooSmallIssue).toBeDefined()

      // No issues on unrelated valid fields — prevents test passing for wrong reason
      const buyerIssue = result.error.issues.find((i) => i.path[0] === 'buyer_id')
      expect(buyerIssue).toBeUndefined()
      const articleIssue = result.error.issues.find((i) => i.path[0] === 'article_id')
      expect(articleIssue).toBeUndefined()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TC-FE-Z-003 — unitPrice = 0 rejected; -1 rejected; 0.01 accepted
// ═══════════════════════════════════════════════════════════════════════════════
describe('createOrderSchema — TC-FE-Z-003', () => {
  it('rejects unit_price of 0 with a descriptive error message', () => {
    const result = createOrderSchema.safeParse({
      ...VALID_PAYLOAD,
      order_lines: [
        { size_label: '38', quantity: 50, unit_price: 0 }, // invalid
        { size_label: '39', quantity: 50, unit_price: 12.5 }, // valid
      ],
    })

    expect(result.success).toBe(false)

    if (!result.success) {
      // Error must be on order_lines[0].unit_price specifically
      const unitPriceIssue = result.error.issues.find(
        (issue) =>
          issue.path[0] === 'order_lines' && issue.path[1] === 0 && issue.path[2] === 'unit_price'
      )

      expect(unitPriceIssue).toBeDefined()

      // Message must be actionable — mention price/cost/amount
      expect(unitPriceIssue?.message).toMatch(/price/i)

      // No error for the second line (index 1) — only offending line flagged
      const secondLineIssue = result.error.issues.find(
        (issue) =>
          issue.path[0] === 'order_lines' && issue.path[1] === 1 && issue.path[2] === 'unit_price'
      )
      expect(secondLineIssue).toBeUndefined()
    }
  })

  it('rejects negative unit_price (-1) as well', () => {
    const result = createOrderSchema.safeParse({
      ...VALID_PAYLOAD,
      order_lines: [
        { size_label: '38', quantity: 50, unit_price: -1 },
        { size_label: '39', quantity: 50, unit_price: 12.5 },
      ],
    })

    expect(result.success).toBe(false)

    if (!result.success) {
      const unitPriceIssue = result.error.issues.find(
        (issue) =>
          issue.path[0] === 'order_lines' && issue.path[1] === 0 && issue.path[2] === 'unit_price'
      )
      expect(unitPriceIssue).toBeDefined()
    }
  })

  it('accepts unit_price of 0.01 (smallest valid positive price)', () => {
    const result = createOrderSchema.safeParse({
      ...VALID_PAYLOAD,
      order_lines: [
        { size_label: '38', quantity: 50, unit_price: 0.01 },
        { size_label: '39', quantity: 50, unit_price: 12.5 },
      ],
    })

    expect(result.success).toBe(true)
  })
})
