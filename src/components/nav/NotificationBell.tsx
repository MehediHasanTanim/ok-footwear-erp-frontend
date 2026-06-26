import { Bell } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { selectUnreadCount, useNotifStore } from '@/stores/notifStore'

export function NotificationBell() {
  const unreadCount = useNotifStore(selectUnreadCount)

  return (
    <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  )
}
