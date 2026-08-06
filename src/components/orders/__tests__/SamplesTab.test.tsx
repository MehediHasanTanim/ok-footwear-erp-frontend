import { beforeEach, describe, expect, it } from 'vitest'

import { SamplesTab } from '@/components/orders/SamplesTab'
import { resetOrdersStore, seedSample } from '@/mocks/handlers/orders.handlers'
import { render, screen, waitFor, within } from '@/test/test-utils'
import type { SampleDto } from '@/types/orders'

const ORDER_ID = 'order-samples-1'

function buildSample(overrides: Partial<SampleDto> = {}): SampleDto {
  return {
    id: overrides.id ?? 'sample-1',
    orderId: ORDER_ID,
    roundNumber: overrides.roundNumber ?? 1,
    sampleType: overrides.sampleType ?? 'PP',
    dispatchDate: overrides.dispatchDate ?? null,
    receivedDate: overrides.receivedDate ?? null,
    approvalStatus: overrides.approvalStatus ?? 'pending',
    remarks: overrides.remarks ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    ...overrides,
  }
}

describe('SamplesTab', () => {
  beforeEach(() => {
    resetOrdersStore()
  })

  it('opens approve confirmation dialog', async () => {
    seedSample(buildSample())
    const { user } = render(<SamplesTab orderId={ORDER_ID} sampleApproved={false} />)

    expect(await screen.findByTestId('sample-round-row')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /approve/i }))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /approve/i })).toBeInTheDocument()
  })

  it('requires remarks before reject can submit', async () => {
    seedSample(buildSample({ id: 'sample-reject-1' }))
    const { user } = render(<SamplesTab orderId={ORDER_ID} sampleApproved={false} />)

    expect(await screen.findByTestId('sample-round-row')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /reject/i }))

    const dialog = await screen.findByRole('alertdialog')
    const confirmReject = within(dialog).getByRole('button', { name: /reject/i })
    expect(confirmReject).toBeDisabled()

    await user.type(within(dialog).getByRole('textbox'), 'Wrong last')
    await waitFor(() => {
      expect(confirmReject).not.toBeDisabled()
    })
  })
})
