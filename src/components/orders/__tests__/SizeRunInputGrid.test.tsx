// ── TC-FE-C-008, TC-FE-C-009 ─────────────────────────────────────────────────
// SizeRunInputGrid: running total computation and non-numeric input rejection.
//
// NOTE: The component uses <input type="text" inputMode="numeric"> (Option B —
// onChange sanitisation), not <input type="number">. This means:
//   - toHaveValue('') for empty (not toHaveValue(null))
//   - role="textbox" (not role="spinbutton")
//   - Non-numeric chars are stripped in onChange, not prevented in onKeyDown
//     (though onKeyDown also filters them for better UX)
//
// The component takes sizeSystem (e.g. 'EU') and derives sizes from
// SIZE_RUN_MAP. For isolated tests we use 'EU' which gives us 36-46.

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { SizeRunInputGrid, type SizeRunMap } from '@/components/orders/SizeRunInputGrid'
import { I18nTestWrapper } from '@/test/i18n-wrapper'

// ── Test harness: controlled wrapper to observe onChange ─────────────────────
function Harness({
  sizeSystem = 'EU' as const,
  initialValue = {},
}: {
  sizeSystem?: 'EU' | 'UK' | 'US'
  initialValue?: SizeRunMap
}) {
  const [value, setValue] = useState<SizeRunMap>(initialValue)

  const externalTotal = Object.values(value).reduce((s, n) => s + n, 0)

  return (
    <I18nTestWrapper>
      <SizeRunInputGrid sizeSystem={sizeSystem} value={value} onChange={setValue} />
      {/* Belt-and-suspenders: verify onChange payload matches internal total */}
      <div data-testid="external-total">{externalTotal}</div>
    </I18nTestWrapper>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TC-FE-C-008 — running total computed correctly
// ═══════════════════════════════════════════════════════════════════════════════
describe('SizeRunInputGrid — TC-FE-C-008', () => {
  it('updates running total as quantities are entered', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    // Component uses data-testid="size-input-{size}" and type="text"
    const input38 = screen.getByTestId('size-input-36')
    const input39 = screen.getByTestId('size-input-37')
    const input40 = screen.getByTestId('size-input-38')
    const totalDisplay = screen.getByTestId('size-run-total')
    const externalTotal = screen.getByTestId('external-total')

    // Enter 50 in size 36
    await user.clear(input38)
    await user.type(input38, '50')
    expect(totalDisplay).toHaveTextContent('50')
    expect(externalTotal).toHaveTextContent('50')

    // Enter 30 in size 37 → total should be 80
    await user.clear(input39)
    await user.type(input39, '30')
    expect(totalDisplay).toHaveTextContent('80')
    expect(externalTotal).toHaveTextContent('80')

    // Enter 20 in size 38 → total should be 100
    await user.clear(input40)
    await user.type(input40, '20')
    expect(totalDisplay).toHaveTextContent('100')
    expect(externalTotal).toHaveTextContent('100')

    // Clear size 36 → total should drop to 50
    await user.clear(input38)
    expect(totalDisplay).toHaveTextContent('50')
    expect(externalTotal).toHaveTextContent('50')
  })

  it('starts with zero total when no quantities are entered', () => {
    render(<Harness />)

    const totalDisplay = screen.getByTestId('size-run-total')
    expect(totalDisplay).toHaveTextContent('0')

    const externalTotal = screen.getByTestId('external-total')
    expect(externalTotal).toHaveTextContent('0')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TC-FE-C-009 — non-numeric input rejected
// ═══════════════════════════════════════════════════════════════════════════════
describe('SizeRunInputGrid — TC-FE-C-009', () => {
  it('does not accept non-numeric input in size cells', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <I18nTestWrapper>
        <SizeRunInputGrid sizeSystem="EU" value={{}} onChange={onChange} />
      </I18nTestWrapper>
    )

    const input36 = screen.getByTestId('size-input-36')
    await user.click(input36)

    // Type alphabetic characters only
    await user.keyboard('abc')

    // onChange should not have been called with NaN or non-numeric values
    const calls = onChange.mock.calls
    for (const [calledWith] of calls) {
      const val = calledWith['36']
      // Either undefined (not in the map) or a valid number
      expect(typeof val === 'undefined' || (typeof val === 'number' && !isNaN(val))).toBe(true)
    }

    // The input value should be empty or only contain digits
    // Since we typed 'abc', the sanitisation should strip all chars → empty
    // (type="text" with inputMode="numeric", so value is empty string)
    expect(input36).toHaveValue('')
  })

  it('strips non-numeric characters from mixed input', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const input36 = screen.getByTestId('size-input-36')
    const totalDisplay = screen.getByTestId('size-run-total')
    const externalTotal = screen.getByTestId('external-total')

    await user.click(input36)

    // Type mixed: digits + letters + more digits
    // Since onKeyDown preventDefaults non-numeric keys, letters are blocked.
    // Only digits pass through to onChange, which sanitises via .replace(/[^0-9]/g, '').
    // Result: '12' + (blocked a,b,c) + '34' = '1234'
    await user.keyboard('12abc34')

    // After all keystrokes, the running total should be 1234
    expect(totalDisplay).toHaveTextContent('1234')
    expect(externalTotal).toHaveTextContent('1234')

    // The input field itself should contain the sanitised digits
    expect(input36).toHaveValue('1234')
  })

  it('running total does not display NaN after non-numeric input', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const input36 = screen.getByTestId('size-input-36')
    const totalDisplay = screen.getByTestId('size-run-total')

    await user.click(input36)
    await user.keyboard('abc')

    // The most user-visible failure mode: total showing NaN
    expect(totalDisplay).not.toHaveTextContent('NaN')
    // Should remain at 0 since no valid numbers were entered
    expect(totalDisplay).toHaveTextContent('0')
  })
})
