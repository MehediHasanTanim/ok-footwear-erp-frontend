import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { useNotifications } from '@/hooks/useNotifications'
import { useAuthStore } from '@/stores/authStore'
import { useNotifStore } from '@/stores/notifStore'

// ── Mock EventSource class ───────────────────────────────────────────────────
class MockEventSource {
  static instances: MockEventSource[] = []
  static reset() {
    MockEventSource.instances = []
  }

  url: string
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: (() => void) | null = null
  readyState: number = 0
  private listeners: Record<string, EventListener[]> = {}

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type]!.push(listener)
  }

  close() {
    this.readyState = 2 // CLOSED
  }

  // Test helpers
  simulateOpen() {
    this.onopen?.()
  }
  simulateMessage(data: unknown) {
    const event = new MessageEvent('message', { data: JSON.stringify(data) })
    this.onmessage?.(event as MessageEvent<string>)
  }
  simulateError() {
    this.onerror?.()
  }
}

// Replace global EventSource
vi.stubGlobal('EventSource', MockEventSource)

// ── Helpers ──────────────────────────────────────────────────────────────────
function setupAuth(token = 'mock-token') {
  useAuthStore.setState({
    userId: 'user-1',
    fullName: 'Test',
    role: 'admin',
    permissions: [],
    accessToken: token,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    isLoading: false,
  })
}

function resetStores() {
  useAuthStore.setState({
    userId: null,
    fullName: null,
    role: null,
    permissions: [],
    accessToken: null,
    expiresAt: null,
    isLoading: false,
  })
  useNotifStore.setState({ notifications: [], unreadCount: 0, sseConnected: false })
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('useNotifications', () => {
  beforeEach(() => {
    MockEventSource.reset()
    resetStores()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // AC 1: EventSource URL includes ?token=
  it('creates EventSource with ?token= query param', () => {
    setupAuth('my-jwt-token')
    renderHook(() => useNotifications())

    expect(MockEventSource.instances.length).toBe(1)
    expect(MockEventSource.instances[0]!.url).toContain('?token=my-jwt-token')
  })

  // AC 2 & 3: Received messages dispatched to store, unreadCount increments
  it('dispatches received messages to notifStore', () => {
    setupAuth()
    renderHook(() => useNotifications())

    const es = MockEventSource.instances[0]!
    const notif = {
      id: 'n1',
      type: 'info' as const,
      title: 'Test',
      message: 'Hello',
      read: false,
      createdAt: new Date().toISOString(),
    }

    act(() => es.simulateMessage(notif))

    const state = useNotifStore.getState()
    expect(state.notifications).toHaveLength(1)
    expect(state.notifications[0]!.id).toBe('n1')
    expect(state.unreadCount).toBe(1)
  })

  // AC 4: sseConnected=true on open, false on error
  it('sets sseConnected on open and error', () => {
    setupAuth()
    renderHook(() => useNotifications())

    const es = MockEventSource.instances[0]!

    act(() => es.simulateOpen())
    expect(useNotifStore.getState().sseConnected).toBe(true)

    act(() => es.simulateError())
    expect(useNotifStore.getState().sseConnected).toBe(false)
  })

  // AC 5 & 6: Reconnect with exponential backoff
  it('attempts reconnect with exponential backoff', () => {
    setupAuth()
    renderHook(() => useNotifications())

    const es = MockEventSource.instances[0]!

    // First error → should schedule reconnect after 1s
    act(() => es.simulateError())
    expect(MockEventSource.instances.length).toBe(1) // old closed, no new yet

    // After 1s, a new ES should be created
    act(() => vi.advanceTimersByTime(1000))
    expect(MockEventSource.instances.length).toBe(2) // new instance
  })

  // AC 7: After 5 failed reconnects, stops
  it('stops reconnecting after 5 failed attempts', () => {
    setupAuth()
    renderHook(() => useNotifications())

    // Simulate 6 errors (initial + 5 reconnects)
    for (let i = 0; i <= 5; i++) {
      const es = MockEventSource.instances[MockEventSource.instances.length - 1]!
      act(() => es.simulateError())
      // Advance timer to trigger next reconnect (except after last)
      if (i < 5) {
        const delay = Math.min(1000 * Math.pow(2, i), 30000)
        act(() => vi.advanceTimersByTime(delay))
      }
    }

    // After 5 reconnects, no more instances should be created
    const countAfterStop = MockEventSource.instances.length
    act(() => vi.advanceTimersByTime(30000))
    expect(MockEventSource.instances.length).toBe(countAfterStop)
  })

  // AC 8: Successful reconnect resets counter
  it('resets backoff counter on successful connection', () => {
    setupAuth()
    renderHook(() => useNotifications())

    // Error → reconnect → then successful open
    let es = MockEventSource.instances[0]!
    act(() => es.simulateError())

    act(() => vi.advanceTimersByTime(1000))
    es = MockEventSource.instances[1]!
    act(() => es.simulateOpen())

    // Next error should start at 1s again (not 2s)
    act(() => es.simulateError())
    act(() => vi.advanceTimersByTime(1000))
    expect(MockEventSource.instances.length).toBe(3) // reconnected
  })

  // AC 9: On accessToken change, old closed, new opened
  it('reconnects on accessToken change', () => {
    setupAuth('token-v1')
    const { rerender } = renderHook(() => useNotifications())

    const es1 = MockEventSource.instances[0]!
    expect(es1.url).toContain('token-v1')

    // Change token
    act(() => {
      useAuthStore.setState({ accessToken: 'token-v2' })
    })
    rerender()

    // Should have created a new EventSource with new token
    const allUrls = MockEventSource.instances.map((e) => e.url)
    expect(allUrls.some((u) => u.includes('token-v2'))).toBe(true)
  })

  // AC 10: On unmount, EventSource.close() called
  it('closes EventSource on unmount', () => {
    setupAuth()
    const { unmount } = renderHook(() => useNotifications())

    const es = MockEventSource.instances[0]!
    const closeSpy = vi.spyOn(es, 'close')

    unmount()
    expect(closeSpy).toHaveBeenCalled()
  })

  // AC 11: Hook has no return value
  it('has no return value', () => {
    setupAuth()
    const { result } = renderHook(() => useNotifications())
    expect(result.current).toBeUndefined()
  })

  // AC 12: Deduplication prevents duplicate notifications
  it('deduplicates notifications on redelivery', () => {
    setupAuth()
    renderHook(() => useNotifications())

    const es = MockEventSource.instances[0]!
    const notif = {
      id: 'n1',
      type: 'info' as const,
      title: 'T',
      message: '',
      read: false,
      createdAt: new Date().toISOString(),
    }

    act(() => es.simulateMessage(notif))
    act(() => es.simulateMessage(notif)) // duplicate

    expect(useNotifStore.getState().notifications).toHaveLength(1)
  })
})
