// eslint-disable-next-line import/no-named-as-default, import/no-named-as-default-member
import i18n from 'i18next'
import Backend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

import { useUIStore, type Locale } from '@/stores/uiStore'

// ── Supported locales ───────────────────────────────────────────────────────
export const SUPPORTED_LOCALES: Locale[] = ['en', 'bn']
export const DEFAULT_LOCALE: Locale = 'en'
export const FALLBACK_LOCALE: Locale = 'en'

// ── Label map for LanguageSwitcher ──────────────────────────────────────────
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  bn: 'বাংলা',
}

// ── Init ────────────────────────────────────────────────────────────────────
// Read the persisted locale from uiStore BEFORE initializing i18next.
// This ensures the language survives page reload without a flash of wrong content.
const savedLocale = useUIStore.getState().locale
const initialLocale =
  savedLocale && SUPPORTED_LOCALES.includes(savedLocale) ? savedLocale : DEFAULT_LOCALE

// eslint-disable-next-line import/no-named-as-default-member
void i18n
  .use(Backend)
  .use(initReactI18next)
  .init({
    lng: initialLocale,
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,

    // i18next-http-backend loads /locales/{lng}/translation.json from /public
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },

    interpolation: {
      escapeValue: false, // React already escapes by default
    },

    react: {
      // useSuspense: false prevents the Suspense boundary from flashing on
      // first render when the locale file hasn't finished loading yet.
      useSuspense: false,
    },

    // Don't preload all languages at startup — load on demand.
    // Bengali translations stay on disk until the user switches.
    preload: false,
  })

// ── Language change handler ─────────────────────────────────────────────────
// Call this from the LanguageSwitcher.  Persists to uiStore so the choice
// survives page reload.
export async function changeLanguage(locale: Locale): Promise<void> {
  // eslint-disable-next-line import/no-named-as-default-member
  await i18n.changeLanguage(locale)
  useUIStore.getState().setLocale(locale)
}

// ── Re-export for convenience ───────────────────────────────────────────────
export default i18n
