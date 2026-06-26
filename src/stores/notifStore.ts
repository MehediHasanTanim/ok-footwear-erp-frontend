import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ── Types ────────────────────────────────────────────────────────────────────
export interface AppNotification {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  read: boolean
  createdAt: string
}

// ── Store shape ──────────────────────────────────────────────────────────────
// This is exported so authStore can type-reference it for the dynamic import.
export interface NotifState {
  unreadCount: number
  notifications: AppNotification[]
  sseConnected: boolean

  // SSE lifecycle — called externally by authStore.login() and authStore.clearAuth()
  connect: () => void
  disconnect: () => void

  // Internal helpers (used by SSE event handlers)
  _addNotification: (notification: AppNotification) => void
  _markRead: (id: string) => void
  _setConnected: (connected: boolean) => void
}

// ── Module-level EventSource reference (not in store state) ──────────────────
// Kept outside Zustand so it survives React re-renders and can be closed
// without mutating the store during teardown.
let eventSource: EventSource | null = null

function buildSSE(): EventSource {
  const baseUrl = import.meta.env.VITE_API_URL
  const url = `${baseUrl}/notifications/stream`

  const es = new EventSource(url, { withCredentials: true })

  es.onopen = () => {
    useNotifStore.getState()._setConnected(true)
  }

  es.onmessage = (event: MessageEvent<string>) => {
    try {
      const notification = JSON.parse(event.data) as AppNotification
      useNotifStore.getState()._addNotification(notification)
    } catch {
      // Malformed SSE payload — ignore, don't crash the connection.
    }
  }

  es.onerror = () => {
    useNotifStore.getState()._setConnected(false)
    // Browser will auto-reconnect per the EventSource spec.
    // We don't manually reconnect — that's the browser's job.
  }

  return es
}

// ── Store ───────────────────────────────────────────────────────────────────
export const useNotifStore = create<NotifState>()(
  immer((set, _get) => ({
    unreadCount: 0,
    notifications: [],
    sseConnected: false,

    connect: () => {
      // Prevent duplicate connections.
      if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
        return
      }
      // Close any stale connection before opening a new one.
      if (eventSource) {
        eventSource.close()
      }
      eventSource = buildSSE()
    },

    disconnect: () => {
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
      set((state) => {
        state.sseConnected = false
        state.notifications = []
        state.unreadCount = 0
      })
    },

    _addNotification: (notification) =>
      set((state) => {
        // Deduplicate — SSE can redeliver on reconnect.
        if (state.notifications.some((n) => n.id === notification.id)) {
          return
        }
        // Keep newest first; cap at 100 to prevent memory leaks.
        state.notifications.unshift(notification)
        if (state.notifications.length > 100) {
          state.notifications.length = 100
        }
        if (!notification.read) {
          state.unreadCount += 1
        }
      }),

    _markRead: (id) =>
      set((state) => {
        const notif = state.notifications.find((n) => n.id === id)
        if (notif && !notif.read) {
          notif.read = true
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
      }),

    _setConnected: (connected) =>
      set((state) => {
        state.sseConnected = connected
      }),
  }))
)

// ── Selectors ───────────────────────────────────────────────────────────────
export const selectUnreadCount = (state: NotifState): number => state.unreadCount
export const selectSseConnected = (state: NotifState): boolean => state.sseConnected
