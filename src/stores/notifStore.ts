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
  /** Optional URL to navigate to when the notification is clicked */
  reference_id?: string
}

// ── Store shape ──────────────────────────────────────────────────────────────
export interface NotifState {
  unreadCount: number
  notifications: AppNotification[]
  sseConnected: boolean

  addNotification: (notification: AppNotification) => void
  incrementUnread: () => void
  decrementUnread: () => void
  markRead: (id: string) => void
  markAllRead: () => void
  setSseConnected: (connected: boolean) => void
}

// ── Store ───────────────────────────────────────────────────────────────────
export const useNotifStore = create<NotifState>()(
  immer((set) => ({
    unreadCount: 0,
    notifications: [],
    sseConnected: false,

    addNotification: (notification) =>
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

    incrementUnread: () =>
      set((state) => {
        state.unreadCount += 1
      }),

    decrementUnread: () =>
      set((state) => {
        state.unreadCount = Math.max(0, state.unreadCount - 1)
      }),

    markRead: (id) =>
      set((state) => {
        const notif = state.notifications.find((n) => n.id === id)
        if (notif && !notif.read) {
          notif.read = true
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
      }),

    markAllRead: () =>
      set((state) => {
        for (const n of state.notifications) {
          n.read = true
        }
        state.unreadCount = 0
      }),

    setSseConnected: (connected) =>
      set((state) => {
        state.sseConnected = connected
      }),
  }))
)

// ── Selectors ───────────────────────────────────────────────────────────────
export const selectUnreadCount = (state: NotifState): number => state.unreadCount
export const selectSseConnected = (state: NotifState): boolean => state.sseConnected
