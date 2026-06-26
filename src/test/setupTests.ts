// jest-dom adds custom matchers like toBeInTheDocument(), toHaveTextContent(), etc.
import '@testing-library/jest-dom/vitest'

// ── jsdom polyfills ──────────────────────────────────────────────────────────
// EventSource is not available in jsdom.  Provide a stub so the notifStore
// doesn't crash when its connect() method is called during authStore.login().
class MockEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  readyState = MockEventSource.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  url: string
  withCredentials: boolean

  constructor(url: string, config?: EventSourceInit) {
    this.url = url
    this.withCredentials = config?.withCredentials ?? false
    // Simulate successful connection on next tick
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN
      this.onopen?.()
    }, 0)
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED
  }

  // Helper to simulate receiving a message in tests
  _dispatchMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as { data: string })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).EventSource = MockEventSource

// ── MSW server ──────────────────────────────────────────────────────────────
import { startMSW } from '@/mocks/server'

startMSW()
