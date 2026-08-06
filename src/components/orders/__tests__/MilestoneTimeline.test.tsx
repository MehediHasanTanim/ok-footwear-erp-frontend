import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MilestoneTimeline } from '@/components/orders/MilestoneTimeline'
import { I18nTestWrapper } from '@/test/i18n-wrapper'
import type { OrderMilestoneDto } from '@/types/orders'

const milestones: OrderMilestoneDto[] = [
  {
    id: 'ms-1',
    orderId: 'ord-1',
    milestoneType: 'material_booking',
    plannedDate: '2026-08-01',
    actualDate: '2026-07-30',
    status: 'done',
  },
  {
    id: 'ms-2',
    orderId: 'ord-1',
    milestoneType: 'pp_sample',
    plannedDate: '2026-08-10',
    actualDate: null,
    status: 'overdue',
  },
  {
    id: 'ms-3',
    orderId: 'ord-1',
    milestoneType: 'bulk_start',
    plannedDate: '2026-09-01',
    actualDate: null,
    status: 'pending',
  },
]

describe('MilestoneTimeline', () => {
  it('renders planned vs actual dates with overdue and completed markers', () => {
    render(
      <I18nTestWrapper>
        <MilestoneTimeline milestones={milestones} />
      </I18nTestWrapper>
    )

    expect(screen.getByTestId('milestone-timeline')).toBeInTheDocument()
    expect(screen.getByTestId('milestone-material_booking')).toBeInTheDocument()
    expect(screen.getByTestId('milestone-pp_sample')).toBeInTheDocument()

    expect(screen.getByText('orders.milestones.completed')).toBeInTheDocument()
    expect(screen.getByText('orders.milestones.overdue')).toBeInTheDocument()
    expect(screen.getByText('2026-07-30')).toBeInTheDocument()
  })

  it('shows empty state when there are no milestones', () => {
    render(
      <I18nTestWrapper>
        <MilestoneTimeline milestones={[]} />
      </I18nTestWrapper>
    )
    expect(screen.getByText('orders.milestones.none')).toBeInTheDocument()
  })
})
