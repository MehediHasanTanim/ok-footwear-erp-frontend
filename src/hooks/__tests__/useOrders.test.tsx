import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { unwrapPaginatedList, useOrders } from '@/hooks/useOrders'
import { resetOrdersStore, seedOrder } from '@/mocks/handlers/orders.handlers'
import { server } from '@/mocks/server'
import type { OrderResponseDto } from '@/types/orders'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:7100/api'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return { Wrapper, queryClient }
}

function buildOrder(overrides: Partial<OrderResponseDto> = {}): OrderResponseDto {
  return {
    id: overrides.id ?? 'order-optimistic-1',
    orderNumber: overrides.orderNumber ?? 'ORD-000099',
    buyerId: 'buyer-1',
    buyer: { id: 'buyer-1', code: 'BUY001', name: 'Test Buyer', currency: 'USD' },
    articleId: 'article-1',
    article: {
      id: 'article-1',
      code: 'ART001',
      description: 'Test Article',
      sizeSystem: 'EU',
    },
    status: overrides.status ?? 'draft',
    currency: 'USD',
    totalQuantity: 100,
    deliveryDate: '2026-12-31',
    sampleApproved: false,
    nextAllowedStates: overrides.nextAllowedStates ?? ['confirmed', 'cancelled'],
    orderLines: [],
    milestones: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('unwrapPaginatedList', () => {
  it('unwraps flat ApiResponse lists', () => {
    expect(
      unwrapPaginatedList({ data: [{ id: 1 }], meta: { page: 1, limit: 20, total: 1 } })
    ).toEqual({
      data: [{ id: 1 }],
      meta: { page: 1, limit: 20, total: 1 },
    })
  })

  it('unwraps nested Nest list envelopes', () => {
    expect(
      unwrapPaginatedList({
        data: { data: [{ id: 2 }], meta: { page: 2, limit: 10, total: 5 } },
      })
    ).toEqual({
      data: [{ id: 2 }],
      meta: { page: 2, limit: 10, total: 5 },
    })
  })
})

describe('useOrders.transitionStatus', () => {
  beforeEach(() => {
    resetOrdersStore()
  })

  it('optimistically updates status and rolls back on error', async () => {
    const order = buildOrder({ status: 'draft' })
    seedOrder(order)

    const { Wrapper, queryClient } = createWrapper()
    queryClient.setQueryData(['orders', 'detail', order.id], order)

    server.use(
      http.patch(`${BASE}/orders/:id/status`, () => {
        return HttpResponse.json({ detail: 'Transition failed', status: 422 }, { status: 422 })
      })
    )

    const { result } = renderHook(() => useOrders(), { wrapper: Wrapper })

    await act(async () => {
      result.current.transitionStatus.mutate({
        id: order.id,
        dto: { toStatus: 'confirmed' },
      })
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData<OrderResponseDto>(['orders', 'detail', order.id])
      expect(cached?.status).toBe('draft')
    })

    expect(result.current.transitionStatus.isError).toBe(true)
  })

  it('optimistically updates status on successful transition', async () => {
    const order = buildOrder({ status: 'draft' })
    seedOrder(order)

    const { Wrapper, queryClient } = createWrapper()
    queryClient.setQueryData(['orders', 'detail', order.id], order)

    // Keep an active detail observer so invalidate/refetch retains cache.
    const { result } = renderHook(
      () => {
        const orders = useOrders()
        const detailQuery = orders.detail(order.id)
        return { orders, detailQuery }
      },
      { wrapper: Wrapper }
    )

    await waitFor(() => {
      expect(result.current.detailQuery.isSuccess).toBe(true)
    })

    await act(async () => {
      result.current.orders.transitionStatus.mutate({
        id: order.id,
        dto: { toStatus: 'confirmed' },
      })
    })

    // Optimistic update should land immediately
    expect(queryClient.getQueryData<OrderResponseDto>(['orders', 'detail', order.id])?.status).toBe(
      'confirmed'
    )

    await waitFor(() => {
      expect(result.current.orders.transitionStatus.isSuccess).toBe(true)
    })

    await waitFor(() => {
      expect(result.current.detailQuery.data?.status).toBe('confirmed')
    })
  })
})
