import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Bell, Info, AlertTriangle, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useNotifStore, type AppNotification } from '@/stores/notifStore'

// ── Icon by notification type ────────────────────────────────────────────────
const TYPE_ICON: Record<AppNotification['type'], typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
}

const TYPE_COLOR: Record<AppNotification['type'], string> = {
  info: 'text-blue-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
  success: 'text-green-500',
}

// ── Badge formatter ──────────────────────────────────────────────────────────
function formatBadge(count: number): string | null {
  if (count <= 0) return null
  if (count > 99) return '99+'
  return String(count)
}

// ── Component ────────────────────────────────────────────────────────────────
export function NotificationDropdown() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const notifications = useNotifStore((s) => s.notifications)
  const unreadCount = useNotifStore((s) => s.unreadCount)
  const sseConnected = useNotifStore((s) => s.sseConnected)
  const markRead = useNotifStore((s) => s.markRead)
  const markAllRead = useNotifStore((s) => s.markAllRead)

  const badge = formatBadge(unreadCount)

  // ── Mark all read mutation (optimistic with rollback) ───────────────────
  const markAllMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/mark-all-read')
    },
    onMutate: () => {
      // Snapshot for rollback
      const prev = useNotifStore.getState().notifications
      markAllRead()
      return { prev }
    },
    onError: (_err, _vars, context) => {
      // Rollback: restore previous notifications
      if (context?.prev) {
        const unreadCount = context.prev.filter((n) => !n.read).length
        useNotifStore.setState({ notifications: context.prev, unreadCount })
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // ── Mark single read mutation ────────────────────────────────────────────
  const markOneMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`)
    },
    onMutate: (id) => {
      markRead(id)
    },
  })

  // ── Handle item click ────────────────────────────────────────────────────
  const handleItemClick = useCallback(
    (notif: AppNotification) => {
      markOneMutation.mutate(notif.id)
      if (notif.reference_id) {
        setOpen(false)
        navigate(notif.reference_id)
      }
    },
    [markOneMutation, navigate]
  )

  // ── Handle mark all read ─────────────────────────────────────────────────
  const handleMarkAllRead = useCallback(() => {
    markAllMutation.mutate()
  }, [markAllMutation])

  // ── Memo: sorted notifications (newest first, already done by store) ──────
  const sortedNotifs = useMemo(() => notifications, [notifications])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="notification-bell"
          aria-label={`${unreadCount} unread notifications`}
        >
          <Bell className="h-5 w-5" />
          {badge && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
              data-testid="notification-badge"
            >
              {badge}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[380px]"
        align="end"
        sideOffset={8}
        data-testid="notification-dropdown"
      >
        {/* Header */}
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 font-normal">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {/* SSE connection dot */}
            <span
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                sseConnected ? 'bg-green-500' : 'bg-gray-400'
              )}
              data-testid="sse-dot"
              title={sseConnected ? 'Live updates active' : 'Reconnecting…'}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={handleMarkAllRead}
            disabled={markAllMutation.isPending || unreadCount === 0}
            data-testid="mark-all-read"
          >
            {markAllMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Mark all read
          </Button>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Notification list */}
        <div className="max-h-[60vh] overflow-y-auto" data-testid="notification-list">
          {sortedNotifs.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center px-4 py-12 text-sm text-muted-foreground"
              data-testid="notification-empty"
            >
              <Bell className="mb-2 h-8 w-8 opacity-30" />
              <p>No notifications yet</p>
            </div>
          ) : (
            sortedNotifs.map((notif) => {
              const Icon = TYPE_ICON[notif.type] ?? Info
              const colorClass = TYPE_COLOR[notif.type] ?? 'text-muted-foreground'

              return (
                <button
                  key={notif.id}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                    !notif.read && 'bg-muted/30'
                  )}
                  onClick={() => handleItemClick(notif)}
                  data-testid={`notification-item-${notif.id}`}
                >
                  {/* Icon */}
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', colorClass)} />

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'text-sm leading-snug',
                          notif.read ? 'font-normal' : 'font-medium'
                        )}
                      >
                        {notif.title}
                      </p>
                      {/* Unread dot */}
                      {!notif.read && (
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                          data-testid={`unread-dot-${notif.id}`}
                        />
                      )}
                    </div>
                    {notif.message && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {notif.message}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {formatTimestamp(notif.createdAt)}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTimestamp(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

export default NotificationDropdown
