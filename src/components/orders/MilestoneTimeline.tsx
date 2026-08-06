import { CheckCircle2, AlertTriangle, Circle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { OrderMilestoneDto, MilestoneStatus, MilestoneType } from '@/types/orders'

// ── Milestone display order ──────────────────────────────────────────────────
const MILESTONE_ORDER: MilestoneType[] = [
  'material_booking',
  'pp_sample',
  'bulk_start',
  'qc',
  'packing',
  'shipment',
]

// ── Props ────────────────────────────────────────────────────────────────────
interface MilestoneTimelineProps {
  milestones: OrderMilestoneDto[]
  className?: string
}

// ── Status icon & colour map ─────────────────────────────────────────────────
function MilestoneIcon({ status }: { status: MilestoneStatus }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
    case 'overdue':
      return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
    case 'pending':
    default:
      return <Circle className="h-5 w-5 text-gray-400 dark:text-gray-500" />
  }
}

function statusLineClass(status: MilestoneStatus): string {
  switch (status) {
    case 'done':
      return 'bg-green-500'
    case 'overdue':
      return 'bg-red-500'
    case 'pending':
    default:
      return 'bg-gray-300 dark:bg-gray-600'
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export function MilestoneTimeline({ milestones, className }: MilestoneTimelineProps) {
  const { t } = useTranslation()

  // Sort milestones in chronological order by plannedDate,
  // then by the predefined MILESTONE_ORDER for ties.
  const sorted = [...milestones].sort((a, b) => {
    const dateA = a.plannedDate
    const dateB = b.plannedDate
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return MILESTONE_ORDER.indexOf(a.milestoneType) - MILESTONE_ORDER.indexOf(b.milestoneType)
  })

  return (
    <div className={cn('space-y-0', className)} data-testid="milestone-timeline">
      {sorted.map((ms, idx) => {
        const isLast = idx === sorted.length - 1
        const milestoneKey = `orders.milestones.${ms.milestoneType}`

        return (
          <div key={ms.id} className="flex gap-3" data-testid={`milestone-${ms.milestoneType}`}>
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <MilestoneIcon status={ms.status} />
              {!isLast && (
                <div className={cn('w-0.5 flex-1 min-h-[24px]', statusLineClass(ms.status))} />
              )}
            </div>

            {/* Milestone content */}
            <div className={cn('pb-4', isLast && 'pb-0')}>
              <p className="text-sm font-medium">{t(milestoneKey)}</p>
              <p className="text-xs text-muted-foreground">
                <span>{t('orders.milestones.planned')}: </span>
                <span
                  className={cn(
                    ms.status === 'overdue' &&
                      !ms.actualDate &&
                      'text-red-600 dark:text-red-400 font-medium'
                  )}
                >
                  {ms.plannedDate}
                </span>
              </p>
              {ms.actualDate && (
                <p className="text-xs text-green-700 dark:text-green-400">
                  <span>{t('orders.milestones.actual')}: </span>
                  <span>{ms.actualDate}</span>
                </p>
              )}
              {ms.status === 'overdue' && !ms.actualDate && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {t('orders.milestones.overdue')}
                </p>
              )}
              {ms.status === 'done' && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                  {t('orders.milestones.completed')}
                </p>
              )}
            </div>
          </div>
        )
      })}

      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">{t('orders.milestones.none')}</p>
      )}
    </div>
  )
}
