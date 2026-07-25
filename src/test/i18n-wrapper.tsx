// Minimal i18next test wrapper — returns keys as translation values.
// Use this for component tests that render components using useTranslation().
// It prevents "missing translation" warnings and makes assertions stable against
// changes to the actual translation string values.

import { createInstance } from 'i18next'
import type { ReactNode } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'

const i18nTest = createInstance()

// We need to suppress the init warning about missing backend.
// The missingKeyHandler returns the key as the value so that
// expect(screen.getByText('orders.status.confirmed')) works.
void i18nTest.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  // Empty resources — all keys will fall through to missingKeyHandler
  resources: { en: { translation: {} } },
  // Return the key as the translation value (identity function)
  parseMissingKeyHandler: (key: string) => key,
  // Suppress the "i18next::backendConnector" warning about missing backend
  interpolation: { escapeValue: false },
  // Avoid console noise about missing keys
  missingKeyHandler: (_lngs: readonly string[], _ns: string, key: string) => key,
  // Don't try to load from HTTP backend
  react: { useSuspense: false },
})

export function I18nTestWrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18nTest}>{children}</I18nextProvider>
}
