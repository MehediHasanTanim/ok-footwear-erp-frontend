import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export type Locale = 'en' | 'bn'
export type Theme = 'light' | 'dark' | 'system'

interface UIState {
  locale: Locale
  theme: Theme
  sidebarCollapsed: boolean
  mobileMenuOpen: boolean

  setLocale: (locale: Locale) => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleMobileMenu: () => void
  setMobileMenuOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    immer((set) => ({
      locale: 'en',
      theme: 'system',
      sidebarCollapsed: false,
      mobileMenuOpen: false,

      setLocale: (locale) =>
        set((state) => {
          state.locale = locale
        }),

      setTheme: (theme) =>
        set((state) => {
          state.theme = theme
        }),

      toggleSidebar: () =>
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed
        }),

      setSidebarCollapsed: (collapsed) =>
        set((state) => {
          state.sidebarCollapsed = collapsed
        }),

      toggleMobileMenu: () =>
        set((state) => {
          state.mobileMenuOpen = !state.mobileMenuOpen
        }),

      setMobileMenuOpen: (open) =>
        set((state) => {
          state.mobileMenuOpen = open
        }),
    })),
    {
      name: 'ok-erp-ui',
      // Persist ALL ui state — locale and theme must survive page reload.
    }
  )
)
