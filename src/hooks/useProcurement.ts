// ── useProcurement — TanStack Query hooks for Sprint 5 Procurement ───────────

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'

import { unwrapPaginatedList } from '@/hooks/useOrders'
import api, { apiClient } from '@/lib/api'
import { toNumber } from '@/lib/format'
import type {
  CreateGoodsReceiptDto,
  CreatePurchaseOrderDto,
  CreateVendorCategoryDto,
  CreateVendorDto,
  CreateVendorInvoiceDto,
  GoodsReceiptDto,
  PurchaseOrderDto,
  RejectPurchaseOrderDto,
  StockItemDto,
  UpdateGrLineDto,
  UpdatePurchaseOrderDto,
  UpdateVendorCategoryDto,
  UpdateVendorDto,
  VendorCategoryDto,
  VendorDto,
  VendorInvoiceDto,
} from '@/types/procurement'

const PRC = '/procurement'

function coerceVendor(v: VendorDto): VendorDto {
  return {
    ...v,
    paymentTerms: v.paymentTerms == null ? v.paymentTerms : toNumber(v.paymentTerms),
    creditLimit: v.creditLimit == null ? v.creditLimit : toNumber(v.creditLimit),
    rating: v.rating == null ? v.rating : toNumber(v.rating),
  }
}

function coercePo(po: PurchaseOrderDto): PurchaseOrderDto {
  return {
    ...po,
    totalAmount: toNumber(po.totalAmount),
    lines: po.lines?.map((l) => ({
      ...l,
      orderedQty: toNumber(l.orderedQty),
      receivedQty: l.receivedQty == null ? l.receivedQty : toNumber(l.receivedQty),
      unitPrice: toNumber(l.unitPrice),
    })),
  }
}

function coerceInvoice(inv: VendorInvoiceDto): VendorInvoiceDto {
  return {
    ...inv,
    grossAmount: toNumber(inv.grossAmount),
    tdsAmount: inv.tdsAmount == null ? inv.tdsAmount : toNumber(inv.tdsAmount),
    netPayable: inv.netPayable == null ? inv.netPayable : toNumber(inv.netPayable),
    paidAmount: inv.paidAmount == null ? inv.paidAmount : toNumber(inv.paidAmount),
    poAmount: inv.poAmount == null ? inv.poAmount : toNumber(inv.poAmount),
    grnAmount: inv.grnAmount == null ? inv.grnAmount : toNumber(inv.grnAmount),
    tolerancePct: inv.tolerancePct == null ? inv.tolerancePct : toNumber(inv.tolerancePct),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Vendors
// ═══════════════════════════════════════════════════════════════════════════════
export function useVendors() {
  const queryClient = useQueryClient()
  const keys = {
    all: ['procurement', 'vendors'] as const,
    list: (filters: Record<string, unknown>) =>
      ['procurement', 'vendors', 'list', filters] as const,
    detail: (id: string) => ['procurement', 'vendors', id] as const,
    categories: ['procurement', 'vendor-categories'] as const,
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside a custom hook (useVendors)
  function list(
    filters: {
      page?: number
      limit?: number
      search?: string
      status?: string
      dropdown?: boolean
    } = {}
  ) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: keys.list(filters),
      queryFn: async () => {
        const { data } = await api.get(`${PRC}/vendors`, { params: filters })
        const page = unwrapPaginatedList<VendorDto>(data)
        return { ...page, data: page.data.map(coerceVendor) }
      },
    })
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside a custom hook (useVendors)
  function detail(id: string) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: keys.detail(id),
      queryFn: async () => coerceVendor(await apiClient.get<VendorDto>(`${PRC}/vendors/${id}`)),
      enabled: !!id,
    })
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside a custom hook (useVendors)
  function categories() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: keys.categories,
      queryFn: async () => {
        const { data } = await api.get(`${PRC}/vendor-categories`)
        return unwrapPaginatedList<VendorCategoryDto>(data).data
      },
      staleTime: 5 * 60_000,
    })
  }

  const createCategory = useMutation({
    mutationFn: (dto: CreateVendorCategoryDto) =>
      apiClient.post<VendorCategoryDto>(`${PRC}/vendor-categories`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.categories })
    },
  })

  const updateCategory = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateVendorCategoryDto }) =>
      apiClient.patch<VendorCategoryDto>(`${PRC}/vendor-categories/${id}`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.categories })
    },
  })

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${PRC}/vendor-categories/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.categories })
    },
  })

  const create = useMutation({
    mutationFn: (dto: CreateVendorDto) => apiClient.post<VendorDto>(`${PRC}/vendors`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
    },
  })

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateVendorDto }) =>
      apiClient.patch<VendorDto>(`${PRC}/vendors/${id}`, dto),
    onSuccess: (_d, { id }) => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
      void queryClient.invalidateQueries({ queryKey: keys.detail(id) })
    },
  })

  return {
    list,
    detail,
    categories,
    createCategory,
    updateCategory,
    deleteCategory,
    create,
    update,
    keys,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Purchase Orders
// ═══════════════════════════════════════════════════════════════════════════════
export function usePurchaseOrders() {
  const queryClient = useQueryClient()
  const keys = {
    all: ['procurement', 'purchase-orders'] as const,
    list: (filters: Record<string, unknown>) =>
      ['procurement', 'purchase-orders', 'list', filters] as const,
    detail: (id: string) => ['procurement', 'purchase-orders', id] as const,
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside a custom hook (usePurchaseOrders)
  function list(
    filters: {
      page?: number
      limit?: number
      status?: string
      vendorId?: string
    } = {}
  ) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: keys.list(filters),
      queryFn: async () => {
        const { data } = await api.get(`${PRC}/purchase-orders`, { params: filters })
        const page = unwrapPaginatedList<PurchaseOrderDto>(data)
        return { ...page, data: page.data.map(coercePo) }
      },
    })
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside a custom hook (usePurchaseOrders)
  function detail(id: string, options?: { enabled?: boolean }) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: keys.detail(id),
      queryFn: async () =>
        coercePo(await apiClient.get<PurchaseOrderDto>(`${PRC}/purchase-orders/${id}`)),
      enabled: options?.enabled !== false && !!id,
    })
  }

  const create = useMutation({
    mutationFn: (dto: CreatePurchaseOrderDto) =>
      apiClient.post<PurchaseOrderDto>(`${PRC}/purchase-orders`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
    },
  })

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePurchaseOrderDto }) =>
      apiClient.patch<PurchaseOrderDto>(`${PRC}/purchase-orders/${id}`, dto),
    onSuccess: (_d, { id }) => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
      void queryClient.invalidateQueries({ queryKey: keys.detail(id) })
    },
  })

  const submit = useMutation({
    mutationFn: (id: string) =>
      apiClient.post<PurchaseOrderDto>(`${PRC}/purchase-orders/${id}/submit`),
    onSuccess: (_d, id) => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
      void queryClient.invalidateQueries({ queryKey: keys.detail(id) })
    },
  })

  const approve = useMutation({
    mutationFn: (id: string) =>
      apiClient.post<PurchaseOrderDto>(`${PRC}/purchase-orders/${id}/approve`),
    onSuccess: (_d, id) => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
      void queryClient.invalidateQueries({ queryKey: keys.detail(id) })
    },
  })

  const reject = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: RejectPurchaseOrderDto }) =>
      apiClient.post<PurchaseOrderDto>(`${PRC}/purchase-orders/${id}/reject`, dto),
    onSuccess: (_d, { id }) => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
      void queryClient.invalidateQueries({ queryKey: keys.detail(id) })
    },
  })

  return { list, detail, create, update, submit, approve, reject, keys }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Goods Receipts
// ═══════════════════════════════════════════════════════════════════════════════
export function useGoodsReceipts() {
  const queryClient = useQueryClient()
  const keys = {
    all: ['procurement', 'goods-receipts'] as const,
    detail: (id: string) => ['procurement', 'goods-receipts', id] as const,
    byPo: (poId: string) => ['procurement', 'goods-receipts', 'by-po', poId] as const,
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside a custom hook (useGoodsReceipts)
  function detail(id: string) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: keys.detail(id),
      queryFn: () => apiClient.get<GoodsReceiptDto>(`${PRC}/goods-receipts/${id}`),
      enabled: !!id,
    })
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside a custom hook (useGoodsReceipts)
  function byPo(poId: string) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: keys.byPo(poId),
      queryFn: async () => {
        const raw = await apiClient.get<GoodsReceiptDto[] | { data: GoodsReceiptDto[] }>(
          `${PRC}/goods-receipts/by-po/${poId}`
        )
        if (Array.isArray(raw)) return raw
        if (raw && typeof raw === 'object' && Array.isArray((raw as { data: unknown }).data)) {
          return (raw as { data: GoodsReceiptDto[] }).data
        }
        return []
      },
      enabled: !!poId,
    })
  }

  const create = useMutation({
    mutationFn: (dto: CreateGoodsReceiptDto) =>
      apiClient.post<GoodsReceiptDto>(`${PRC}/goods-receipts`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
    },
  })

  const updateLine = useMutation({
    mutationFn: ({ grnId, lineId, dto }: { grnId: string; lineId: string; dto: UpdateGrLineDto }) =>
      apiClient.patch(`${PRC}/goods-receipts/${grnId}/lines/${lineId}`, dto),
    onSuccess: (_d, { grnId }) => {
      void queryClient.invalidateQueries({ queryKey: keys.detail(grnId) })
      void queryClient.invalidateQueries({ queryKey: keys.all })
    },
  })

  const uploadPhoto = useMutation({
    mutationFn: async ({ grnId, lineId, file }: { grnId: string; lineId: string; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post(
        `${PRC}/goods-receipts/${grnId}/lines/${lineId}/photos`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data
    },
    onSuccess: (_d, { grnId }) => {
      void queryClient.invalidateQueries({ queryKey: keys.detail(grnId) })
    },
  })

  const submitQc = useMutation({
    mutationFn: (id: string) => apiClient.post(`${PRC}/goods-receipts/${id}/submit-qc`),
    onSuccess: (_d, id) => {
      void queryClient.invalidateQueries({ queryKey: keys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: keys.all })
    },
  })

  return { detail, byPo, create, updateLine, uploadPhoto, submitQc, keys }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Vendor Invoices
// ═══════════════════════════════════════════════════════════════════════════════
export function useVendorInvoices() {
  const queryClient = useQueryClient()
  const keys = {
    all: ['procurement', 'vendor-invoices'] as const,
    list: (filters: Record<string, unknown>) =>
      ['procurement', 'vendor-invoices', 'list', filters] as const,
    detail: (id: string) => ['procurement', 'vendor-invoices', id] as const,
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside a custom hook (useVendorInvoices)
  function list(
    filters: {
      page?: number
      limit?: number
      vendorId?: string
      status?: string
    } = {}
  ) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: keys.list(filters),
      queryFn: async () => {
        const { data } = await api.get(`${PRC}/vendor-invoices`, { params: filters })
        const page = unwrapPaginatedList<VendorInvoiceDto>(data)
        return { ...page, data: page.data.map(coerceInvoice) }
      },
    })
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- nested inside a custom hook (useVendorInvoices)
  function detail(id: string) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: keys.detail(id),
      queryFn: async () =>
        coerceInvoice(await apiClient.get<VendorInvoiceDto>(`${PRC}/vendor-invoices/${id}`)),
      enabled: !!id,
    })
  }

  const create = useMutation({
    mutationFn: (dto: CreateVendorInvoiceDto) =>
      apiClient.post<VendorInvoiceDto>(`${PRC}/vendor-invoices`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
    },
  })

  return { list, detail, create, keys }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stock items search (Inventory module — may 404 until Sprint 6)
// ═══════════════════════════════════════════════════════════════════════════════
export function useItemsSearch(search: string, enabled = true) {
  return useQuery({
    queryKey: ['inventory', 'items', 'search', search],
    queryFn: async (): Promise<{ items: StockItemDto[]; unavailable: boolean }> => {
      if (!search.trim()) return { items: [], unavailable: false }
      try {
        const { data } = await api.get('/inventory/items', {
          params: { search, limit: 10 },
        })
        return { items: unwrapPaginatedList<StockItemDto>(data).data, unavailable: false }
      } catch (err) {
        if (
          err instanceof AxiosError &&
          (err.response?.status === 404 || err.response?.status === 501)
        ) {
          return { items: [], unavailable: true }
        }
        throw err
      }
    },
    enabled: enabled && search.trim().length > 0,
    retry: false,
  })
}
