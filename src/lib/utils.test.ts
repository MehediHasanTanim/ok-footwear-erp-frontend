import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils'

describe('cn (class-name utility)', () => {
  it('merges Tailwind classes with conflict resolution', () => {
    const result = cn('px-4 py-2', 'px-6', false && 'hidden', 'font-bold')
    expect(result).toBe('py-2 px-6 font-bold')
  })

  it('handles conditional classes', () => {
    const result = cn('base', true && 'active', false && 'inactive')
    expect(result).toBe('base active')
  })

  it('returns empty string for no inputs', () => {
    const result = cn()
    expect(result).toBe('')
  })
})
