import { useUIStore, type Locale } from '@/stores/uiStore'

// ── Locale mapper — Zustand locale → BCP 47 tag ─────────────────────────────
const LOCALE_BCP47: Record<Locale, string> = {
  en: 'en-US',
  bn: 'bn-BD',
}

function getActiveLocale(): Locale {
  return useUIStore.getState().locale
}

function getBCP47(): string {
  return LOCALE_BCP47[getActiveLocale()]
}

// ── Date formatting ─────────────────────────────────────────────────────────
/**
 * Format a date string or Date object using Intl.DateTimeFormat.
 * Locale-aware — 'bn' renders Bengali month/day names.
 *
 * @example formatDate('2025-01-15') → 'January 15, 2025' (en) / '১৫ জানুয়ারি, ২০২৫' (bn)
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(getBCP47(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(d)
}

/**
 * Short date: 'Jan 15, 2025' or '১৫ জানু, ২০২৫'
 */
export function formatDateShort(date: string | Date): string {
  return formatDate(date, { month: 'short' })
}

/**
 * Numeric date: '01/15/2025' or '১৫/১/২০২৫'
 */
export function formatDateNumeric(date: string | Date): string {
  return formatDate(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// ── Number formatting ───────────────────────────────────────────────────────
/**
 * Coerce API scalars to a finite number.
 * Nest/Prisma Decimal fields often arrive as plain `{ s, e, d }` objects
 * (decimal.js internals) which must not be rendered as React children.
 */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  if (value && typeof value === 'object') {
    const maybeDecimal = value as {
      toNumber?: () => number
      toString?: () => string
      s?: number
      e?: number
      d?: number[]
    }
    if (typeof maybeDecimal.toNumber === 'function') {
      const n = maybeDecimal.toNumber()
      return Number.isFinite(n) ? n : fallback
    }
    if (Array.isArray(maybeDecimal.d) && typeof maybeDecimal.e === 'number') {
      const digits = maybeDecimal.d.map(String).join('')
      if (digits.length > 0) {
        const sign = maybeDecimal.s != null && maybeDecimal.s < 0 ? -1 : 1
        const n = sign * Number(`${digits}e${maybeDecimal.e - digits.length + 1}`)
        return Number.isFinite(n) ? n : fallback
      }
    }
    if (typeof maybeDecimal.toString === 'function') {
      const str = maybeDecimal.toString()
      if (str && str !== '[object Object]') {
        const n = Number(str)
        if (Number.isFinite(n)) return n
      }
    }
  }
  return fallback
}

/** Like {@link toNumber}, but preserves null/undefined as null. */
export function toNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = toNumber(value, Number.NaN)
  return Number.isFinite(n) ? n : null
}

/**
 * Format a number using Intl.NumberFormat.
 * Locale-aware — 'bn' renders Bengali numerals (০১২৩৪৫৬৭৮৯).
 */
export function formatNumber(value: unknown, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getBCP47(), options).format(toNumber(value))
}

/**
 * Format as BDT currency.
 * 'en' → '৳ 1,250.00'  /  'bn' → '১,২৫০.০০ ৳'
 */
export function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat(getBCP47(), {
    style: 'currency',
    currency: 'BDT',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value))
}

/**
 * Format as integer (no decimals). Uses group separators.
 * 'en' → '12,500'  /  'bn' → '১২,৫০০'
 */
export function formatInteger(value: unknown): string {
  return new Intl.NumberFormat(getBCP47(), {
    maximumFractionDigits: 0,
  }).format(toNumber(value))
}
