import { describe, expect, it } from 'vitest'

import {
  approvalThresholdForAmount,
  isValidGrnQtySplit,
  VENDOR_STATUS_META,
} from '@/types/procurement'

describe('approvalThresholdForAmount', () => {
  it('maps amount tiers from Sprint 5 thresholds', () => {
    expect(approvalThresholdForAmount(10_000)).toBe('line_mgr')
    expect(approvalThresholdForAmount(49_999)).toBe('line_mgr')
    expect(approvalThresholdForAmount(50_000)).toBe('manager')
    expect(approvalThresholdForAmount(499_999)).toBe('manager')
    expect(approvalThresholdForAmount(500_000)).toBe('finance')
    expect(approvalThresholdForAmount(4_999_999)).toBe('finance')
    expect(approvalThresholdForAmount(5_000_000)).toBe('md')
  })
})

describe('isValidGrnQtySplit', () => {
  it('allows accepted + rejected within received', () => {
    expect(isValidGrnQtySplit(100, 80, 20)).toBe(true)
    expect(isValidGrnQtySplit(100, 100, 0)).toBe(true)
    expect(isValidGrnQtySplit(100, 0, 0)).toBe(true)
  })

  it('rejects when accepted + rejected exceeds received', () => {
    expect(isValidGrnQtySplit(100, 80, 30)).toBe(false)
    expect(isValidGrnQtySplit(10, 10, 0.01)).toBe(false)
  })
})

describe('VENDOR_STATUS_META', () => {
  it('maps under_review to pending label key', () => {
    expect(VENDOR_STATUS_META.under_review.labelKey).toBe('procurement.vendorStatus.pending')
  })
})
