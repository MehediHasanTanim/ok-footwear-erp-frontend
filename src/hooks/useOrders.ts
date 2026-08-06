// ── useOrders — TanStack Query v5 hook for Orders module ─────────────────────
// Single source of truth for all Orders API interactions.
// Components must reach through this hook — never call apiClient directly.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import api, { apiClient } from '@/lib/api'
import type {
  ArticleDto,
  BuyerDto,
  CreateOrderDto,
  OrdersFilter,
  OrderResponseDto,
  TransitionStatusDto,
  UpdateOrderDto,
} from '@/types/orders'

// ── List envelope normalizer ─────────────────────────────────────────────────
// Nest may return either:
//   { data: T[], meta }                         (ApiResponse)
//   { data: { data: T[], meta } }               (nested list DTO)
// MSW currently uses the first shape; production lists may use the second.
export interface PaginatedList<T> {
  data: T[]
  meta: { page: number; limit: number; total: number }
}

function normalizeMeta(meta?: {
  page?: number
  limit?: number
  total?: number
  totalItems?: number
  totalCount?: number
}): PaginatedList<never>['meta'] {
  return {
    page: meta?.page ?? 1,
    limit: meta?.limit ?? 20,
    total: meta?.total ?? meta?.totalItems ?? meta?.totalCount ?? 0,
  }
}

export function unwrapPaginatedList<T>(body: unknown): PaginatedList<T> {
  if (!body || typeof body !== 'object') {
    return { data: [], meta: { page: 1, limit: 20, total: 0 } }
  }

  const outer = body as {
    data?: unknown
    items?: unknown
    meta?: Parameters<typeof normalizeMeta>[0]
    total?: number
  }

  // Nested: { data: { data: T[], meta } } or { data: { items: T[], meta } }
  if (outer.data && typeof outer.data === 'object' && !Array.isArray(outer.data)) {
    const inner = outer.data as {
      data?: unknown
      items?: unknown
      meta?: Parameters<typeof normalizeMeta>[0]
      total?: number
    }
    if (Array.isArray(inner.data)) {
      return {
        data: inner.data as T[],
        meta: normalizeMeta(inner.meta ?? { total: inner.total }),
      }
    }
    if (Array.isArray(inner.items)) {
      return {
        data: inner.items as T[],
        meta: normalizeMeta(inner.meta ?? { total: inner.total }),
      }
    }
  }

  // Flat: { data: T[], meta? }
  if (Array.isArray(outer.data)) {
    const meta = normalizeMeta(outer.meta ?? { total: outer.total })
    if (!outer.meta && outer.total == null) {
      meta.limit = (outer.data as T[]).length || 20
      meta.total = (outer.data as T[]).length
    }
    return {
      data: outer.data as T[],
      meta,
    }
  }

  // Alternate: { items: T[], meta? }
  if (Array.isArray(outer.items)) {
    return {
      data: outer.items as T[],
      meta: normalizeMeta(outer.meta ?? { total: outer.total }),
    }
  }

  return { data: [], meta: { page: 1, limit: 20, total: 0 } }
}

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
      queryFn: async (): Promise<PaginatedList<OrderResponseDto>> => {
        const params: Record<string, string | number | undefined> = {
          page: filters.page ?? 1,
          limit: filters.limit ?? 20,
        }
        if (filters.status) {
          params.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status
        }
        if (filters.buyerId) params.buyerId = filters.buyerId
        if (filters.deliveryDateFrom) params.deliveryDateFrom = filters.deliveryDateFrom
        if (filters.deliveryDateTo) params.deliveryDateTo = filters.deliveryDateTo

        const { data } = await api.get('/orders', { params })
        return unwrapPaginatedList<OrderResponseDto>(data)
      },
    })
  }

  // ── Detail ─────────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside a custom hook (useOrders)
  function detail(id: string, options?: { enabled?: boolean }) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: orderKeys.detail(id),
      queryFn: async () => {
        return apiClient.get<OrderResponseDto>(`/orders/${id}`)
      },
      enabled: options?.enabled !== false && !!id,
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
      await queryClient.cancelQueries({ queryKey: orderKeys.detail(id) })

      const previous = queryClient.getQueryData<OrderResponseDto>(orderKeys.detail(id))

      if (previous) {
        queryClient.setQueryData<OrderResponseDto>(orderKeys.detail(id), {
          ...previous,
          status: dto.toStatus as OrderResponseDto['status'],
          nextAllowedStates: [],
          updatedAt: new Date().toISOString(),
        })
      }

      return { previous }
    },
    onError: (_error, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(orderKeys.detail(id), context.previous)
      }
    },
    onSettled: (_data, _error, { id }) => {
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
export type BuyersListFilters = {
  search?: string
  dropdown?: boolean
  page?: number
  limit?: number
}

export function useBuyers() {
  const queryClient = useQueryClient()

  const buyerKeys = {
    all: ['buyers'] as const,
    list: (filters?: BuyersListFilters) => ['buyers', 'list', filters ?? {}] as const,
    detail: (id: string) => ['buyers', 'detail', id] as const,
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside custom hook (useBuyers)
  function list(filters: BuyersListFilters = {}) {
    const { search, dropdown, page, limit } = filters
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: buyerKeys.list(filters),
      queryFn: async (): Promise<PaginatedList<BuyerDto>> => {
        const params: Record<string, string | number | boolean | undefined> = {}
        if (dropdown) params.dropdown = true
        if (search) params.search = search
        if (page) params.page = page
        if (limit) params.limit = limit
        const { data } = await api.get('/buyers', { params })
        return unwrapPaginatedList<BuyerDto>(data)
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

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft-delete may return an empty/partial body — avoid envelope unwrap.
      await api.delete(`/buyers/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: buyerKeys.all })
    },
  })

  return {
    list,
    create: createMutation,
    update: updateMutation,
    remove: removeMutation,
    buyerKeys,
  }
}

// ── useArticles ──────────────────────────────────────────────────────────────
export type ArticlesListFilters = {
  search?: string
  category?: string
  season?: string
  page?: number
  limit?: number
}

export function useArticles() {
  const queryClient = useQueryClient()

  const articleKeys = {
    all: ['articles'] as const,
    list: (filters?: ArticlesListFilters) => ['articles', 'list', filters ?? {}] as const,
    detail: (id: string) => ['articles', 'detail', id] as const,
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside custom hook (useArticles)
  function list(filters: ArticlesListFilters = {}) {
    const { search, category, season, page, limit } = filters
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: articleKeys.list(filters),
      queryFn: async (): Promise<PaginatedList<ArticleDto>> => {
        const params: Record<string, string | number | undefined> = {}
        if (search) params.search = search
        if (category) params.category = category
        if (season) params.season = season
        if (page) params.page = page
        if (limit) params.limit = limit
        const { data } = await api.get('/articles', { params })
        return unwrapPaginatedList<ArticleDto>(data)
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

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft-delete may return an empty/partial body — avoid envelope unwrap.
      await api.delete(`/articles/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.all })
    },
  })

  return {
    list,
    create: createMutation,
    update: updateMutation,
    remove: removeMutation,
    articleKeys,
  }
}
