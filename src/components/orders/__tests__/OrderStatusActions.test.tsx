import { describe, expect, it, vi } from 'vitest'

import { OrderStatusActions } from '@/components/orders/OrderStatusActions'
import { render, screen, waitFor } from '@/test/test-utils'

describe('OrderStatusActions', () => {
  it('renders a button for each nextAllowedStates entry', () => {
    render(
      <OrderStatusActions
        nextAllowedStates={['confirmed', 'cancelled']}
        currentStatus="draft"
        onTransition={vi.fn()}
      />
    )

    expect(screen.getByTestId('transition-btn-confirmed')).toBeInTheDocument()
    expect(screen.getByTestId('transition-btn-cancelled')).toBeInTheDocument()
  })

  it('renders nothing when there are no allowed transitions', () => {
    const { container } = render(
      <OrderStatusActions nextAllowedStates={[]} currentStatus="delivered" onTransition={vi.fn()} />
    )

    expect(container.querySelector('[data-testid="order-status-actions"]')).toBeNull()
  })

  it('requires cancellation reason before confirming cancel', async () => {
    const onTransition = vi.fn()
    const { user } = render(
      <OrderStatusActions
        nextAllowedStates={['cancelled']}
        currentStatus="draft"
        onTransition={onTransition}
      />
    )

    await user.click(screen.getByTestId('transition-btn-cancelled'))

    expect(await screen.findByTestId('cancellation-reason-input')).toBeInTheDocument()
    expect(screen.getByTestId('confirm-transition-btn')).toBeDisabled()

    await user.type(screen.getByTestId('cancellation-reason-input'), 'Buyer withdrew')
    await user.type(screen.getByTestId('confirm-text-input'), 'cancelled')

    await waitFor(() => {
      expect(screen.getByTestId('confirm-transition-btn')).not.toBeDisabled()
    })

    await user.click(screen.getByTestId('confirm-transition-btn'))

    expect(onTransition).toHaveBeenCalledWith('cancelled', 'Buyer withdrew')
  })

  it('requires typing status label for irreversible in_production transition', async () => {
    const onTransition = vi.fn()
    const { user } = render(
      <OrderStatusActions
        nextAllowedStates={['in_production']}
        currentStatus="confirmed"
        onTransition={onTransition}
      />
    )

    await user.click(screen.getByTestId('transition-btn-in_production'))

    expect(await screen.findByTestId('confirm-text-input')).toBeInTheDocument()
    expect(screen.getByTestId('confirm-transition-btn')).toBeDisabled()

    await user.type(screen.getByTestId('confirm-text-input'), 'in production')
    await waitFor(() => {
      expect(screen.getByTestId('confirm-transition-btn')).not.toBeDisabled()
    })

    await user.click(screen.getByTestId('confirm-transition-btn'))
    expect(onTransition).toHaveBeenCalledWith('in_production', undefined)
  })
})
