import { useEffect, useRef, useState, useCallback } from 'react'

import { useAuthStore } from '@/stores/authStore'
import { useNotifStore, type AppNotification } from '@/stores/notifStore'

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_RECONNECT_ATTEMPTS = 5
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30_000

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useNotifications(): void {
  const accessToken = useAuthStore((s) => s.accessToken)
  const addNotification = useNotifStore((s) => s.addNotification)
  const setSseConnected = useNotifStore((s) => s.setSseConnected)

  // Incrementing this triggers effect re-run for reconnection
  const [reconnectTick, setReconnectTick] = useState(0)

  const esRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)

  const cleanup = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!accessToken) {
      cleanup()
      setSseConnected(false)
      return
    }

    const baseUrl = import.meta.env.VITE_API_URL
    const url = `${baseUrl}/notifications/stream?token=${encodeURIComponent(accessToken)}`

    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      setSseConnected(true)
      attemptRef.current = 0
    }

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const notification = JSON.parse(event.data) as AppNotification
        addNotification(notification)
      } catch {
        // Malformed SSE payload — ignore
      }
    }

    es.addEventListener('notification', ((event: MessageEvent<string>) => {
      try {
        const notification = JSON.parse(event.data) as AppNotification
        addNotification(notification)
      } catch {
        // ignore
      }
    }) as EventListener)

    es.onerror = () => {
      setSseConnected(false)
      es.close()
      esRef.current = null

      const attempts = attemptRef.current + 1
      attemptRef.current = attempts

      if (attempts > MAX_RECONNECT_ATTEMPTS) {
        console.warn('[useNotifications] Max reconnection attempts reached, stopping.')
        return
      }

      const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempts - 1), MAX_BACKOFF_MS)

      reconnectTimeoutRef.current = setTimeout(() => {
        setReconnectTick((n) => n + 1)
      }, delay)
    }

    return () => {
      cleanup()
    }
  }, [accessToken, reconnectTick, addNotification, setSseConnected, cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
      setSseConnected(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
