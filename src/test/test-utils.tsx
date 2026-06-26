import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, type RenderOptions, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactElement, type ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'

import i18n from '@/lib/i18n'
import { server } from '@/mocks/server'

// ── Fresh QueryClient per test — prevents cache pollution between tests ──────
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Turn off retries in tests — we assert on the first result.
        retry: false,
        // gcTime: 0 means cache is cleared immediately after the test.
        gcTime: 0,
      },
    },
  })
}

// ── Provider wrapper ────────────────────────────────────────────────────────
interface AllProvidersProps {
  children: ReactNode
  /** Initial route for MemoryRouter. Default: '/' */
  initialRoute?: string
}

function AllProviders({ children, initialRoute = '/' }: AllProvidersProps) {
  const queryClient = createTestQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

// ── Custom render ───────────────────────────────────────────────────────────
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string
}

export function render(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const { initialRoute, ...rtlOptions } = options ?? {}

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AllProviders initialRoute={initialRoute}>{children}</AllProviders>
  )

  const result = rtlRender(ui, { wrapper: Wrapper, ...rtlOptions })

  return {
    ...result,
    user: userEvent.setup(),
  }
}

// ── Re-exports ──────────────────────────────────────────────────────────────
// Re-export RTL utilities, but NOT render — our custom render replaces it.
export { screen, waitFor, within, act, fireEvent } from '@testing-library/react'
export { userEvent, server }
export { createTestQueryClient, AllProviders }
