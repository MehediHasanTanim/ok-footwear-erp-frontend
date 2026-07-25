// ── useOrders — TanStack Query v5 hook for Orders module ─────────────────────
// Single source of truth for all Orders API interactions.
// Components must reach through this hook — never call apiClient directly.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import api, { apiClient } from '@/lib/api'
import type {
  CreateOrderDto,
  OrdersFilter,
  OrderListResponseDto,
  OrderResponseDto,
  TransitionStatusDto,
  UpdateOrderDto,
} from '@/types/orders'

// ── Query Key Factory ────────────────────────────────────────────────────────
const orderKeys = {
  all: ['orders'] as const,
  list: (filters?: OrdersFilter) => ['orders', 'list', filters ?? {}] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useOrders() {
  const queryClient = useQueryClient()

  // ── List ──────────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside a custom hook (useOrders)
  function list(filters: OrdersFilter = {}) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: orderKeys.list(filters),
      queryFn: async (): Promise<{
        data: OrderResponseDto[]
        meta: { page: number; limit: number; total: number }
      }> => {
        const params: Record<string, string | number | undefined> = {
          page: filters.page ?? 1,
          limit: filters.limit ?? 20,
        }
        if (filters.status) {
          params.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status
        }
        if (filters.buyer_id) params.buyer_id = filters.buyer_id
        if (filters.delivery_date_from) params.delivery_date_from = filters.delivery_date_from
        if (filters.delivery_date_to) params.delivery_date_to = filters.delivery_date_to
        if (filters.search) params.search = filters.search

        // Use the raw api instance to get the full response envelope
        const { data } = await api.get<{ data: OrderListResponseDto }>('/orders', { params })
        return data.data
      },
    })
  }

  // ── Detail ─────────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside a custom hook (useOrders)
  function detail(id: string) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: orderKeys.detail(id),
      queryFn: async () => {
        return apiClient.get<OrderResponseDto>(`/orders/${id}`)
      },
      enabled: !!id,
    })
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (dto: CreateOrderDto) => {
      return apiClient.post<OrderResponseDto>('/orders', dto)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })

  // ── Update (draft only) ────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateOrderDto }) => {
      return apiClient.patch<OrderResponseDto>(`/orders/${id}`, dto)
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })

  // ── Transition Status (with optimistic update + rollback) ──────────────────
  const transitionStatus = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: TransitionStatusDto }) => {
      return apiClient.patch<OrderResponseDto>(`/orders/${id}/status`, dto)
    },
    onMutate: async ({ id, dto }) => {
      // Cancel any in-flight queries for this order
      await queryClient.cancelQueries({ queryKey: orderKeys.detail(id) })

      // Snapshot previous value for rollback
      const previous = queryClient.getQueryData<OrderResponseDto>(orderKeys.detail(id))

      // Optimistically update the cache
      if (previous) {
        queryClient.setQueryData<OrderResponseDto>(orderKeys.detail(id), {
          ...previous,
          status: dto.toStatus as OrderResponseDto['status'],
          nextAllowedStates: [], // temporary — backend will correct this on refetch
          updatedAt: new Date().toISOString(),
        })
      }

      return { previous }
    },
    onError: (_error, { id }, context) => {
      // Roll back to the previous value on error
      if (context?.previous) {
        queryClient.setQueryData(orderKeys.detail(id), context.previous)
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Always refetch the detail + invalidate lists to ensure consistency
      void queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })

  return {
    list,
    detail,
    create: createMutation,
    update: updateMutation,
    transitionStatus,
    orderKeys,
  }
}

// ── useBuyers ────────────────────────────────────────────────────────────────
export function useBuyers() {
  const queryClient = useQueryClient()

  const buyerKeys = {
    all: ['buyers'] as const,
    list: (filters?: { search?: string; dropdown?: boolean; page?: number; limit?: number }) =>
      ['buyers', 'list', filters ?? {}] as const,
    detail: (id: string) => ['buyers', 'detail', id] as const,
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside custom hook (useBuyers)
  function list(
    filters: { search?: string; dropdown?: boolean; page?: number; limit?: number } = {}
  ) {
    const { search, dropdown, page, limit } = filters
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: buyerKeys.list(filters),
      queryFn: async () => {
        const params: Record<string, string | number | boolean | undefined> = {}
        if (dropdown) params.dropdown = 'true'
        if (search) params.search = search
        if (page) params.page = page
        if (limit) params.limit = limit
        const { data } = await api.get<{ data: unknown }>('/buyers', { params })
        return data.data
      },
    })
  }

  const createMutation = useMutation({
    mutationFn: async (dto: unknown) => {
      return apiClient.post('/buyers', dto)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: buyerKeys.all })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: unknown }) => {
      return apiClient.patch(`/buyers/${id}`, dto)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: buyerKeys.all })
    },
  })

  return {
    list,
    create: createMutation,
    update: updateMutation,
    buyerKeys,
  }
}

// ── useArticles ──────────────────────────────────────────────────────────────
export function useArticles() {
  const queryClient = useQueryClient()

  const articleKeys = {
    all: ['articles'] as const,
    list: (filters?: {
      search?: string
      category?: string
      season?: string
      page?: number
      limit?: number
    }) => ['articles', 'list', filters ?? {}] as const,
    detail: (id: string) => ['articles', 'detail', id] as const,
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside custom hook (useArticles)
  function list(
    filters: {
      search?: string
      category?: string
      season?: string
      page?: number
      limit?: number
    } = {}
  ) {
    const { search, category, season, page, limit } = filters
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: articleKeys.list(filters),
      queryFn: async () => {
        const params: Record<string, string | number | undefined> = {}
        if (search) params.search = search
        if (category) params.category = category
        if (season) params.season = season
        if (page) params.page = page
        if (limit) params.limit = limit
        const { data } = await api.get<{ data: unknown }>('/articles', { params })
        return data.data
      },
    })
  }

  const createMutation = useMutation({
    mutationFn: async (dto: unknown) => {
      return apiClient.post('/articles', dto)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.all })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: unknown }) => {
      return apiClient.patch(`/articles/${id}`, dto)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.all })
    },
  })

  return {
    list,
    create: createMutation,
    update: updateMutation,
    articleKeys,
  }
}
