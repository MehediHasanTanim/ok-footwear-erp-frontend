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
 * Format a number using Intl.NumberFormat.
 * Locale-aware — 'bn' renders Bengali numerals (০১২৩৪৫৬৭৮৯).
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getBCP47(), options).format(value)
}

/**
 * Format as BDT currency.
 * 'en' → '৳ 1,250.00'  /  'bn' → '১,২৫০.০০ ৳'
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(getBCP47(), {
    style: 'currency',
    currency: 'BDT',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format as integer (no decimals). Uses group separators.
 * 'en' → '12,500'  /  'bn' → '১২,৫০০'
 */
export function formatInteger(value: number): string {
  return new Intl.NumberFormat(getBCP47(), {
    maximumFractionDigits: 0,
  }).format(value)
}
