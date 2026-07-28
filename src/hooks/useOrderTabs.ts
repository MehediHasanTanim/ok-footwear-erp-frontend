// ── Sprint 4: useQuotations / useSamples / useComplaints ─────────────────────
// TanStack Query v5 hooks for quotations, sample tracking, and complaints/CAPA.
// Modeled on useOrders from Sprint 3.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/api'
import type {
  QuotationDto,
  CreateQuotationDto,
  CloseQuotationDto,
  SampleDto,
  CreateSampleDto,
  ComplaintDto,
  CreateComplaintDto,
  CapaActionDto,
  CreateCapaDto,
  UpdateCapaStatusDto,
} from '@/types/orders'

// ═══════════════════════════════════════════════════════════════════════════════
// useQuotations
// ═══════════════════════════════════════════════════════════════════════════════
export function useQuotations(orderId: string) {
  const queryClient = useQueryClient()

  const keys = {
    list: ['quotations', orderId] as const,
    detail: (id: string) => ['quotations', orderId, id] as const,
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const listQuery = useQuery({
    queryKey: keys.list,
    queryFn: () => apiClient.get<QuotationDto[]>(`/orders/${orderId}/quotations`),
    enabled: !!orderId,
  })

  const createMutation = useMutation({
    mutationFn: (dto: CreateQuotationDto) =>
      apiClient.post<QuotationDto>(`/orders/${orderId}/quotations`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list })
    },
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post<QuotationDto>(`/orders/${orderId}/quotations/${id}/send`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: keys.list })
      const previous = queryClient.getQueryData<QuotationDto[]>(keys.list)
      if (previous) {
        queryClient.setQueryData<QuotationDto[]>(
          keys.list,
          previous.map((q) => (q.id === id ? { ...q, status: 'sent' as const } : q))
        )
      }
      return { previous }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(keys.list, ctx.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list })
    },
  })

  const closeMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CloseQuotationDto }) =>
      apiClient.post<QuotationDto>(`/orders/${orderId}/quotations/${id}/close`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list })
      void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] })
    },
  })

  return {
    list: listQuery,
    create: createMutation,
    send: sendMutation,
    close: closeMutation,
    keys,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// useSamples
// ═══════════════════════════════════════════════════════════════════════════════
export function useSamples(orderId: string) {
  const queryClient = useQueryClient()

  const keys = {
    list: ['samples', orderId] as const,
    detail: (id: string) => ['samples', orderId, id] as const,
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const listQuery = useQuery({
    queryKey: keys.list,
    queryFn: () => apiClient.get<SampleDto[]>(`/orders/${orderId}/samples`),
    enabled: !!orderId,
  })

  const createMutation = useMutation({
    mutationFn: (dto: CreateSampleDto) =>
      apiClient.post<SampleDto>(`/orders/${orderId}/samples`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list })
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post<SampleDto>(`/orders/${orderId}/samples/${id}/approve`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list })
      // Invalidate order detail — sample_approved flag has changed
      void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) =>
      apiClient.post<SampleDto>(`/orders/${orderId}/samples/${id}/reject`, { remarks }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list })
    },
  })

  return {
    list: listQuery,
    create: createMutation,
    approve: approveMutation,
    reject: rejectMutation,
    keys,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// useComplaints
// ═══════════════════════════════════════════════════════════════════════════════
export function useComplaints(orderId: string) {
  const queryClient = useQueryClient()

  const keys = {
    list: ['complaints', orderId] as const,
    detail: (id: string) => ['complaints', orderId, id] as const,
    capaList: (complaintId: string) => ['capa', complaintId] as const,
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const listQuery = useQuery({
    queryKey: keys.list,
    queryFn: () => apiClient.get<ComplaintDto[]>(`/orders/${orderId}/complaints`),
    enabled: !!orderId,
  })

  const createMutation = useMutation({
    mutationFn: (dto: CreateComplaintDto) =>
      apiClient.post<ComplaintDto>(`/orders/${orderId}/complaints`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list })
    },
  })

  const updateRootCauseMutation = useMutation({
    mutationFn: ({ id, root_cause }: { id: string; root_cause: string }) =>
      apiClient.patch<ComplaintDto>(`/orders/${orderId}/complaints/${id}/root-cause`, {
        root_cause,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.list })
    },
  })

  // CAPA sub-resource
  function capaList(complaintId: string) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: keys.capaList(complaintId),
      queryFn: () =>
        apiClient.get<CapaActionDto[]>(`/orders/${orderId}/complaints/${complaintId}/capa`),
      enabled: !!complaintId,
    })
  }

  const capaCreateMutation = useMutation({
    mutationFn: ({ complaintId, dto }: { complaintId: string; dto: CreateCapaDto }) =>
      apiClient.post<CapaActionDto>(`/orders/${orderId}/complaints/${complaintId}/capa`, dto),
    onSuccess: (_data, { complaintId }) => {
      void queryClient.invalidateQueries({ queryKey: keys.capaList(complaintId) })
      void queryClient.invalidateQueries({ queryKey: keys.list })
    },
  })

  const capaUpdateStatusMutation = useMutation({
    mutationFn: ({
      complaintId,
      capaId,
      dto,
    }: {
      complaintId: string
      capaId: string
      dto: UpdateCapaStatusDto
    }) =>
      apiClient.patch<CapaActionDto>(
        `/orders/${orderId}/complaints/${complaintId}/capa/${capaId}/status`,
        dto
      ),
    onSuccess: (_data, { complaintId }) => {
      void queryClient.invalidateQueries({ queryKey: keys.capaList(complaintId) })
      void queryClient.invalidateQueries({ queryKey: keys.list })
    },
  })

  return {
    list: listQuery,
    create: createMutation,
    updateRootCause: updateRootCauseMutation,
    capaList,
    capaCreate: capaCreateMutation,
    capaUpdateStatus: capaUpdateStatusMutation,
    keys,
  }
}
