import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SIZE_RUN_MAP, type SizeSystem } from '@/types/orders'

// ── Types ────────────────────────────────────────────────────────────────────
export type SizeRunMap = Record<string, number> // size_label → quantity

interface SizeRunInputGridProps {
  /** The size system determines which columns to render */
  sizeSystem: SizeSystem
  /** Current size→quantity map */
  value: SizeRunMap
  /** Called when any size quantity changes */
  onChange: (value: SizeRunMap) => void
  /** Optional unit price — if provided, shows a value column */
  unitPrice?: number
  /** If true, renders in read-only mode */
  readOnly?: boolean
  className?: string
}

// ── Component ────────────────────────────────────────────────────────────────
export function SizeRunInputGrid({
  sizeSystem,
  value,
  onChange,
  unitPrice,
  readOnly = false,
  className,
}: SizeRunInputGridProps) {
  const { t } = useTranslation()
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null)

  const sizes = useMemo(() => SIZE_RUN_MAP[sizeSystem] ?? SIZE_RUN_MAP['EU'], [sizeSystem])

  // ── Derived values ────────────────────────────────────────────────────────
  const totalQuantity = useMemo(
    () => Object.values(value).reduce((sum, qty) => sum + qty, 0),
    [value]
  )

  const totalValue = useMemo(
    () => (unitPrice != null ? totalQuantity * unitPrice : 0),
    [totalQuantity, unitPrice]
  )

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, sizeIndex: number) => {
      const { key } = e

      // Tab / Shift+Tab: move to next/previous cell
      if (key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        const nextIndex = sizeIndex + 1
        if (nextIndex < sizes.length) {
          const nextSize = sizes[nextIndex]!
          const nextEl = inputRefs.current.get(nextSize)
          nextEl?.focus()
        }
      } else if (key === 'Tab' && e.shiftKey) {
        e.preventDefault()
        const prevIndex = sizeIndex - 1
        if (prevIndex >= 0) {
          const prevSize = sizes[prevIndex]!
          const prevEl = inputRefs.current.get(prevSize)
          prevEl?.focus()
        }
      }
      // Allow only numeric input (and Backspace/Delete/Arrow keys)
      else if (
        !/^[0-9]$/.test(key) &&
        ![
          'Backspace',
          'Delete',
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Tab',
          'Enter',
          'Escape',
        ].includes(key)
      ) {
        e.preventDefault()
      }
    },
    [sizes]
  )

  const handleChange = useCallback(
    (sizeLabel: string, rawValue: string) => {
      if (readOnly) return
      // Parse as integer, clamp to non-negative
      const parsed = parseInt(rawValue.replace(/[^0-9]/g, ''), 10)
      const newQuantity = isNaN(parsed) ? 0 : Math.max(0, parsed)
      onChange({ ...value, [sizeLabel]: newQuantity })
    },
    [value, onChange, readOnly]
  )

  // ── Set ref for each input ────────────────────────────────────────────────
  const setInputRef = useCallback((sizeLabel: string, el: HTMLInputElement | null) => {
    if (el) {
      inputRefs.current.set(sizeLabel, el)
    } else {
      inputRefs.current.delete(sizeLabel)
    }
  }, [])

  return (
    <div className={cn('space-y-1', className)} data-testid="size-run-grid">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                {t('orders.sizeGrid.size')}
              </th>
              {sizes.map((size) => (
                <th
                  key={size}
                  className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[64px]"
                >
                  {size}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                {t('orders.sizeGrid.total')}
              </th>
              {unitPrice != null && (
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                  {t('orders.sizeGrid.value')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-1 font-medium">{t('orders.sizeGrid.quantity')}</td>
              {sizes.map((size, idx) => (
                <td key={size} className="px-2 py-1 text-center">
                  {readOnly ? (
                    <span className="inline-block w-full text-center py-2">{value[size] ?? 0}</span>
                  ) : (
                    <Input
                      ref={(el) => setInputRef(size, el)}
                      type="text"
                      inputMode="numeric"
                      value={value[size] ?? ''}
                      onChange={(e) => handleChange(size, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      onFocus={() => setFocusedCell({ row: 0, col: idx + 1 })}
                      onBlur={() => setFocusedCell(null)}
                      className={cn(
                        'h-10 w-16 text-center tabular-nums',
                        focusedCell?.col === idx + 1 && 'ring-2 ring-primary'
                      )}
                      aria-label={`${t('orders.sizeGrid.size')} ${size} ${t('orders.sizeGrid.quantity')}`}
                      data-testid={`size-input-${size}`}
                    />
                  )}
                </td>
              ))}
              <td
                className="px-3 py-1 text-center font-bold tabular-nums"
                data-testid="size-run-total"
              >
                {totalQuantity}
              </td>
              {unitPrice != null && (
                <td className="px-3 py-1 text-center tabular-nums text-muted-foreground">
                  {totalValue.toFixed(2)}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
