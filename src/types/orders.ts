// ── Orders Module Types ──────────────────────────────────────────────────────
// Mirrors the NestJS backend API contracts (Sprint 3).
// See: docs/design/OK_Footwear_ERP_Schema_Reference.md

import type { ISODate, ISODateTime, UUID } from './index'

// ── Enums ────────────────────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  'draft',
  'confirmed',
  'in_production',
  'qc',
  'packed',
  'delivered',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_TYPES = ['bulk', 'sample', 'repeat', 'trial'] as const
export type OrderType = (typeof ORDER_TYPES)[number]

export const MILESTONE_TYPES = [
  'material_booking',
  'pp_sample',
  'bulk_start',
  'qc',
  'packing',
  'shipment',
] as const
export type MilestoneType = (typeof MILESTONE_TYPES)[number]

export const MILESTONE_STATUSES = ['pending', 'done', 'overdue'] as const
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]

export const SIZE_SYSTEMS = ['EU', 'UK', 'US'] as const
export type SizeSystem = (typeof SIZE_SYSTEMS)[number]

export const ARTICLE_CATEGORIES = ['men', 'women', 'kids', 'safety', 'sports'] as const
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]

// ── ISO 4217 Currency Codes (subset used by OK Footwear) ─────────────────────
export const CURRENCY_CODES = [
  'USD',
  'EUR',
  'GBP',
  'BDT',
  'JPY',
  'CNY',
  'AUD',
  'CAD',
  'CHF',
  'INR',
] as const
export type CurrencyCode = (typeof CURRENCY_CODES)[number]

// ── Size Run Lookup ──────────────────────────────────────────────────────────
// TODO(Tanim): These are placeholder ranges. Replace with real size-run data
// per size_system from the production database or reference data.
export const SIZE_RUN_MAP: Record<SizeSystem, string[]> = {
  EU: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  UK: ['3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '8', '9', '10', '11'],
  US: ['4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '9', '10', '11', '12'],
}

// ── Order Status Meta ───────────────────────────────────────────────────────
// Single source of truth for status labels, colours, and descriptions.
// Reused by OrderStatusBadge, OrderStatusActions, and any reporting UI.
export interface OrderStatusMeta {
  labelKey: string // i18next translation key
  descriptionKey: string // i18next translation key for tooltip
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
  /** Tailwind classes appended to the badge variant */
  badgeClass: string
}

export const ORDER_STATUS_META: Record<OrderStatus, OrderStatusMeta> = {
  draft: {
    labelKey: 'orders.status.draft',
    descriptionKey: 'orders.statusDesc.draft',
    badgeVariant: 'secondary',
    badgeClass: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
  confirmed: {
    labelKey: 'orders.status.confirmed',
    descriptionKey: 'orders.statusDesc.confirmed',
    badgeVariant: 'default',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  in_production: {
    labelKey: 'orders.status.in_production',
    descriptionKey: 'orders.statusDesc.in_production',
    badgeVariant: 'default',
    badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  qc: {
    labelKey: 'orders.status.qc',
    descriptionKey: 'orders.statusDesc.qc',
    badgeVariant: 'default',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  packed: {
    labelKey: 'orders.status.packed',
    descriptionKey: 'orders.statusDesc.packed',
    badgeVariant: 'default',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  },
  delivered: {
    labelKey: 'orders.status.delivered',
    descriptionKey: 'orders.statusDesc.delivered',
    badgeVariant: 'default',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  cancelled: {
    labelKey: 'orders.status.cancelled',
    descriptionKey: 'orders.statusDesc.cancelled',
    badgeVariant: 'destructive',
    badgeClass: '',
  },
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface BuyerDto {
  id: UUID
  buyer_code: string
  name: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  country: string
  payment_terms: number
  credit_limit: number
  currency: CurrencyCode
  is_active: boolean
  notes?: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface BuyerDropdownDto {
  id: UUID
  buyer_code: string
  name: string
  country: string
}

export interface ArticleDto {
  id: UUID
  article_code: string
  description: string
  category: ArticleCategory
  sub_category?: string
  gender?: string
  season?: string
  size_system: SizeSystem
  is_active: boolean
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface OrderLineDto {
  id: UUID
  order_id: UUID
  size_label: string
  quantity: number
  unit_price?: number | null
  createdAt: ISODateTime
}

export interface OrderMilestoneDto {
  id: UUID
  order_id: UUID
  milestone_type: MilestoneType
  planned_date: ISODate
  actual_date?: ISODate | null
  status: MilestoneStatus
}

export interface OrderResponseDto {
  id: UUID
  order_number: string
  buyer_id: UUID
  buyer: Pick<BuyerDto, 'id' | 'buyer_code' | 'name' | 'currency'>
  article_id: UUID
  article: Pick<ArticleDto, 'id' | 'article_code' | 'description' | 'size_system'>
  order_type: OrderType
  season?: string
  status: OrderStatus
  currency: CurrencyCode
  unit_price: number
  total_quantity: number
  delivery_date: ISODate
  pi_number?: string | null
  lc_number?: string | null
  sample_approved: boolean
  remarks?: string | null
  nextAllowedStates: OrderStatus[]
  order_lines?: OrderLineDto[]
  milestones?: OrderMilestoneDto[]
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface OrderListResponseDto {
  data: OrderResponseDto[]
  meta: {
    page: number
    limit: number
    total: number
  }
}

export interface CreateOrderDto {
  buyer_id: UUID
  article_id: UUID
  order_type: OrderType
  season?: string
  currency: CurrencyCode
  unit_price: number
  total_quantity: number
  delivery_date: ISODate
  pi_number?: string
  lc_number?: string
  remarks?: string
  order_lines: Array<{
    size_label: string
    quantity: number
    unit_price?: number | null
  }>
}

export interface UpdateOrderDto {
  order_type?: OrderType
  season?: string
  currency?: CurrencyCode
  unit_price?: number
  total_quantity?: number
  delivery_date?: ISODate
  pi_number?: string
  lc_number?: string
  remarks?: string
  order_lines?: Array<{
    size_label: string
    quantity: number
    unit_price?: number | null
  }>
}

export interface TransitionStatusDto {
  toStatus: OrderStatus
  cancellationReason?: string
}

export interface CreateBuyerDto {
  buyer_code: string
  name: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  country: string
  payment_terms: number
  credit_limit: number
  currency: CurrencyCode
  notes?: string
}

export interface UpdateBuyerDto {
  buyer_code?: string
  name?: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  country?: string
  payment_terms?: number
  credit_limit?: number
  currency?: CurrencyCode
  is_active?: boolean
  notes?: string
}

export interface CreateArticleDto {
  article_code: string
  description: string
  category: ArticleCategory
  sub_category?: string
  gender?: string
  season?: string
  size_system: SizeSystem
}

export interface UpdateArticleDto {
  article_code?: string
  description?: string
  category?: ArticleCategory
  sub_category?: string
  gender?: string
  season?: string
  size_system?: SizeSystem
  is_active?: boolean
}

// ── Filter DTOs ──────────────────────────────────────────────────────────────

export interface OrdersFilter {
  status?: OrderStatus | OrderStatus[]
  buyer_id?: UUID
  delivery_date_from?: ISODate
  delivery_date_to?: ISODate
  page?: number
  limit?: number
  search?: string
}

export interface BuyersFilter {
  dropdown?: boolean
  search?: string
  page?: number
  limit?: number
}

export interface ArticlesFilter {
  search?: string
  category?: ArticleCategory
  season?: string
  page?: number
  limit?: number
}

// ── Sprint 4: Quotations ────────────────────────────────────────────────────

export const QUOTATION_STATUSES = ['draft', 'sent', 'won', 'lost'] as const
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number]

export const QUOTATION_STATUS_META: Record<QuotationStatus, OrderStatusMeta> = {
  draft: {
    labelKey: 'quotations.status.draft',
    descriptionKey: 'quotations.statusDesc.draft',
    badgeVariant: 'secondary',
    badgeClass: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
  sent: {
    labelKey: 'quotations.status.sent',
    descriptionKey: 'quotations.statusDesc.sent',
    badgeVariant: 'default',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  won: {
    labelKey: 'quotations.status.won',
    descriptionKey: 'quotations.statusDesc.won',
    badgeVariant: 'default',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  lost: {
    labelKey: 'quotations.status.lost',
    descriptionKey: 'quotations.statusDesc.lost',
    badgeVariant: 'destructive',
    badgeClass: '',
  },
}

export interface QuotationDto {
  id: UUID
  quotation_number: string
  order_id: UUID
  buyer_id: UUID
  article_id: UUID
  version: number
  currency: CurrencyCode
  total_cost?: number | null
  margin_pct?: number | null
  quoted_price: number
  win_probability?: number | null
  valid_until: ISODate
  status: QuotationStatus
  sent_at?: ISODateTime | null
  outcome_reason?: string | null
  notes?: string | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface CreateQuotationDto {
  quoted_price: number
  currency: CurrencyCode
  win_probability?: number
  notes?: string
}

export interface CloseQuotationDto {
  outcome: 'won' | 'lost'
  outcomeReason: string
}

// ── Sprint 4: Samples ────────────────────────────────────────────────────────

export const SAMPLE_TYPES = [
  'pp_sample',
  'counter_sample',
  'size_set',
  'top_of_production',
] as const
export type SampleType = (typeof SAMPLE_TYPES)[number]

export const SAMPLE_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const
export type SampleApprovalStatus = (typeof SAMPLE_APPROVAL_STATUSES)[number]

export const SAMPLE_APPROVAL_STATUS_META: Record<SampleApprovalStatus, OrderStatusMeta> = {
  pending: {
    labelKey: 'samples.approval.pending',
    descriptionKey: 'samples.approvalDesc.pending',
    badgeVariant: 'secondary',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  approved: {
    labelKey: 'samples.approval.approved',
    descriptionKey: 'samples.approvalDesc.approved',
    badgeVariant: 'default',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  rejected: {
    labelKey: 'samples.approval.rejected',
    descriptionKey: 'samples.approvalDesc.rejected',
    badgeVariant: 'destructive',
    badgeClass: '',
  },
}

export interface SampleDto {
  id: UUID
  order_id: UUID
  round_number: number
  sample_type: SampleType
  dispatch_date?: ISODate | null
  received_date?: ISODate | null
  courier?: string | null
  tracking_no?: string | null
  approval_status: SampleApprovalStatus
  buyer_comment?: string | null
  remarks?: string | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface CreateSampleDto {
  sample_type: SampleType
  dispatch_date?: ISODate
}

// ── Sprint 4: Complaints & CAPA ──────────────────────────────────────────────

export const COMPLAINT_TYPES = [
  'quality_defect',
  'wrong_style',
  'wrong_size',
  'short_shipment',
  'packaging',
] as const
export type ComplaintType = (typeof COMPLAINT_TYPES)[number]

export const COMPLAINT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export type ComplaintSeverity = (typeof COMPLAINT_SEVERITIES)[number]

export const COMPLAINT_STATUSES = ['open', 'under_investigation', 'resolved'] as const
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number]

export const COMPLAINT_STATUS_META: Record<ComplaintStatus, OrderStatusMeta> = {
  open: {
    labelKey: 'complaints.status.open',
    descriptionKey: 'complaints.statusDesc.open',
    badgeVariant: 'default',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  under_investigation: {
    labelKey: 'complaints.status.investigation',
    descriptionKey: 'complaints.statusDesc.investigation',
    badgeVariant: 'default',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  resolved: {
    labelKey: 'complaints.status.resolved',
    descriptionKey: 'complaints.statusDesc.resolved',
    badgeVariant: 'default',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
}

export const CAPA_STATUSES = ['open', 'in_progress', 'done'] as const
export type CapaStatus = (typeof CAPA_STATUSES)[number]

export const CAPA_STATUS_META: Record<CapaStatus, OrderStatusMeta> = {
  open: {
    labelKey: 'capa.status.open',
    descriptionKey: 'capa.statusDesc.open',
    badgeVariant: 'secondary',
    badgeClass: 'bg-gray-200 text-gray-700',
  },
  in_progress: {
    labelKey: 'capa.status.inProgress',
    descriptionKey: 'capa.statusDesc.inProgress',
    badgeVariant: 'default',
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  done: {
    labelKey: 'capa.status.done',
    descriptionKey: 'capa.statusDesc.done',
    badgeVariant: 'default',
    badgeClass: 'bg-green-100 text-green-800',
  },
}

export interface ComplaintDto {
  id: UUID
  complaint_no: string
  order_id: UUID
  complaint_date: ISODate
  type: ComplaintType
  severity: ComplaintSeverity
  description: string
  status: ComplaintStatus
  root_cause?: string | null
  quantity?: number | null
  resolved_at?: ISODateTime | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface CapaActionDto {
  id: UUID
  complaint_id: UUID
  action_type: 'corrective' | 'preventive'
  description: string
  owner_user_id: UUID
  owner_name?: string
  due_date: ISODate
  status: CapaStatus
  closed_at?: ISODateTime | null
  createdAt: ISODateTime
}

export interface CreateComplaintDto {
  type: ComplaintType
  severity: ComplaintSeverity
  description: string
}

export interface CreateCapaDto {
  description: string
  owner_user_id: UUID
  due_date: ISODate
}

export interface UpdateCapaStatusDto {
  status: CapaStatus
}
