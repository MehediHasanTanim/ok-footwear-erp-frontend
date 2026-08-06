// ── TC-FE-Z-001, TC-FE-Z-002, TC-FE-Z-003 ───────────────────────────────────
// Zod schema unit tests for createOrderSchema (camelCase OpenAPI fields).

import { describe, expect, it } from 'vitest'

import { createOrderSchema } from '@/lib/schemas'

// deliveryDate is hardcoded far in the future so the refine won't trip until 2027+
const VALID_PAYLOAD = {
  buyerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  articleId: 'b2c3d4e5-f6a7-7890-bcde-f12345678901',
  currency: 'USD',
  unitPrice: 12.5,
  totalQuantity: 100,
  deliveryDate: '2027-06-01',
  orderLines: [
    { sizeLabel: '38', quantity: 50, unitPrice: 12.5 },
    { sizeLabel: '39', quantity: 50, unitPrice: 12.5 },
  ],
}

describe('createOrderSchema — TC-FE-Z-001', () => {
  it('accepts a fully valid order payload', () => {
    const result = createOrderSchema.safeParse(VALID_PAYLOAD)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    if (result.success) {
      expect(result.data.currency).toBe('USD')
      expect(result.data.totalQuantity).toBe(100)
    }
  })
})

describe('createOrderSchema — TC-FE-Z-002', () => {
  it('rejects an empty orderLines array', () => {
    const result = createOrderSchema.safeParse({
      ...VALID_PAYLOAD,
      orderLines: [],
    })

    expect(result.success).toBe(false)

    if (!result.success) {
      const orderLinesIssues = result.error.issues.filter((issue) => issue.path[0] === 'orderLines')
      expect(orderLinesIssues.length).toBeGreaterThan(0)

      const tooSmallIssue = orderLinesIssues.find((i) => i.code === 'too_small')
      expect(tooSmallIssue).toBeDefined()

      const buyerIssue = result.error.issues.find((i) => i.path[0] === 'buyerId')
      expect(buyerIssue).toBeUndefined()
      const articleIssue = result.error.issues.find((i) => i.path[0] === 'articleId')
      expect(articleIssue).toBeUndefined()
    }
  })
})

describe('createOrderSchema — TC-FE-Z-003', () => {
  it('rejects unitPrice of 0 with a descriptive error message', () => {
    const result = createOrderSchema.safeParse({
      ...VALID_PAYLOAD,
      orderLines: [
        { sizeLabel: '38', quantity: 50, unitPrice: 0 },
        { sizeLabel: '39', quantity: 50, unitPrice: 12.5 },
      ],
    })

    expect(result.success).toBe(false)

    if (!result.success) {
      const unitPriceIssue = result.error.issues.find(
        (issue) =>
          issue.path[0] === 'orderLines' && issue.path[1] === 0 && issue.path[2] === 'unitPrice'
      )

      expect(unitPriceIssue).toBeDefined()
      expect(unitPriceIssue?.message).toMatch(/price/i)

      const secondLineIssue = result.error.issues.find(
        (issue) =>
          issue.path[0] === 'orderLines' && issue.path[1] === 1 && issue.path[2] === 'unitPrice'
      )
      expect(secondLineIssue).toBeUndefined()
    }
  })

  it('rejects negative unitPrice (-1) as well', () => {
    const result = createOrderSchema.safeParse({
      ...VALID_PAYLOAD,
      orderLines: [
        { sizeLabel: '38', quantity: 50, unitPrice: -1 },
        { sizeLabel: '39', quantity: 50, unitPrice: 12.5 },
      ],
    })

    expect(result.success).toBe(false)

    if (!result.success) {
      const unitPriceIssue = result.error.issues.find(
        (issue) =>
          issue.path[0] === 'orderLines' && issue.path[1] === 0 && issue.path[2] === 'unitPrice'
      )
      expect(unitPriceIssue).toBeDefined()
    }
  })

  it('accepts unitPrice of 0.01 (smallest valid positive price)', () => {
    const result = createOrderSchema.safeParse({
      ...VALID_PAYLOAD,
      orderLines: [
        { sizeLabel: '38', quantity: 50, unitPrice: 0.01 },
        { sizeLabel: '39', quantity: 50, unitPrice: 12.5 },
      ],
    })

    expect(result.success).toBe(true)
  })
})
