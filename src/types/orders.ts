// ── Orders Module Types ──────────────────────────────────────────────────────
// Aligned to NestJS OpenAPI at /api/docs-json (camelCase request/response DTOs).

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

export const SIZE_SYSTEMS = ['EU', 'UK', 'US'] as const
export type SizeSystem = (typeof SIZE_SYSTEMS)[number]

/** UI presets for article category (API accepts free string). */
export const ARTICLE_CATEGORIES = ['men', 'women', 'kids', 'safety', 'sports'] as const
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]

export const PAYMENT_TERMS = ['LC_SIGHT', 'LC_USANCE', 'TT_ADVANCE', 'TT_30_DAYS'] as const
export type PaymentTerms = (typeof PAYMENT_TERMS)[number]

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

export const SIZE_RUN_MAP: Record<SizeSystem, string[]> = {
  EU: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  UK: ['3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '8', '9', '10', '11'],
  US: ['4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '9', '10', '11', '12'],
}

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

// ── Order Status Meta ───────────────────────────────────────────────────────

export interface OrderStatusMeta {
  labelKey: string
  descriptionKey: string
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
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

// ── Buyers ───────────────────────────────────────────────────────────────────

export interface BuyerDto {
  id: UUID
  name: string
  currency: CurrencyCode
  paymentTerms: PaymentTerms
  creditLimit?: number
  country?: string
  isActive?: boolean
  /** Present when backend exposes a buyer code */
  code?: string
  createdAt?: ISODateTime
  updatedAt?: ISODateTime
}

export interface BuyerDropdownDto {
  id: UUID
  name: string
  country?: string
  code?: string
}

export interface CreateBuyerDto {
  name: string
  currency: CurrencyCode
  paymentTerms: PaymentTerms
  creditLimit?: number
  country?: string
}

export interface UpdateBuyerDto {
  name?: string
  currency?: CurrencyCode
  paymentTerms?: PaymentTerms
  creditLimit?: number
  country?: string
  isActive?: boolean
}

// ── Articles ─────────────────────────────────────────────────────────────────

export interface ArticleDto {
  id: UUID
  code: string
  description: string
  sizeSystem?: SizeSystem
  category?: string
  season?: string | null
  isActive?: boolean
  createdAt?: ISODateTime
  updatedAt?: ISODateTime
}

export interface CreateArticleDto {
  code: string
  description: string
  sizeSystem?: SizeSystem
  category?: string
  season?: string
}

export interface UpdateArticleDto {
  code?: string
  description?: string
  sizeSystem?: SizeSystem
  category?: string
  season?: string
  isActive?: boolean
}

// ── Orders ───────────────────────────────────────────────────────────────────

export interface OrderLineDto {
  id?: UUID
  orderId?: UUID
  sizeLabel: string
  quantity: number
  unitPrice: number
  createdAt?: ISODateTime
}

export interface OrderMilestoneDto {
  id: UUID
  orderId?: UUID
  milestoneType: MilestoneType
  plannedDate: ISODate
  actualDate?: ISODate | null
  status: MilestoneStatus
}

export interface OrderResponseDto {
  id: UUID
  orderNumber: string
  buyerId: UUID
  buyer: Pick<BuyerDto, 'id' | 'name' | 'currency'> & { code?: string }
  articleId: UUID
  article: Pick<ArticleDto, 'id' | 'code' | 'description' | 'sizeSystem'>
  status: OrderStatus
  currency: CurrencyCode
  totalQuantity: number
  deliveryDate: ISODate
  sampleApproved: boolean
  nextAllowedStates: OrderStatus[]
  orderLines?: OrderLineDto[]
  milestones?: OrderMilestoneDto[]
  createdAt?: ISODateTime
  updatedAt?: ISODateTime
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
  buyerId: UUID
  articleId: UUID
  totalQuantity: number
  deliveryDate: ISODate
  currency: CurrencyCode
  orderLines: Array<{
    sizeLabel: string
    quantity: number
    unitPrice: number
  }>
}

export interface UpdateOrderDto {
  articleId?: UUID
  totalQuantity?: number
  deliveryDate?: ISODate
  currency?: CurrencyCode
  sampleApproved?: boolean
}

export interface TransitionStatusDto {
  toStatus: OrderStatus
  cancellationReason?: string
}

// ── Filters ──────────────────────────────────────────────────────────────────

export interface OrdersFilter {
  status?: OrderStatus | OrderStatus[]
  buyerId?: UUID
  deliveryDateFrom?: ISODate
  deliveryDateTo?: ISODate
  page?: number
  limit?: number
}

export interface BuyersFilter {
  dropdown?: boolean
  search?: string
  page?: number
  limit?: number
}

export interface ArticlesFilter {
  search?: string
  category?: string
  season?: string
  page?: number
  limit?: number
}

// ── Quotations ───────────────────────────────────────────────────────────────

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
  quotationNumber?: string
  orderId: UUID
  buyerId?: UUID
  articleId?: UUID
  version?: number
  currency: CurrencyCode
  quotedPrice?: number | null
  winProbability?: number | null
  status: QuotationStatus
  sentAt?: ISODateTime | null
  outcomeReason?: string | null
  createdAt?: ISODateTime
  updatedAt?: ISODateTime
}

export interface CreateQuotationDto {
  currency: CurrencyCode
  quotedPrice?: number
  winProbability?: number
  bomVersionId?: string
}

export interface PopulateFromBomDto {
  bomVersionId?: string
}

export interface CloseQuotationDto {
  outcome: 'won' | 'lost'
  outcomeReason?: string
}

// ── Samples ──────────────────────────────────────────────────────────────────

export const SAMPLE_TYPES = ['PP', 'counter', 'size_set', 'TOP'] as const
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
  orderId: UUID
  roundNumber?: number
  sampleType: SampleType
  dispatchDate?: ISODate | null
  receivedDate?: ISODate | null
  approvalStatus?: SampleApprovalStatus
  remarks?: string | null
  createdAt?: ISODateTime
  updatedAt?: ISODateTime
}

export interface CreateSampleDto {
  sampleType: SampleType
  roundNumber?: number
  dispatchDate?: ISODate
  receivedDate?: ISODate
  remarks?: string
}

export interface RejectSampleDto {
  remarks: string
}

// ── Complaints & CAPA ────────────────────────────────────────────────────────

export const COMPLAINT_TYPES = [
  'quality',
  'delivery',
  'packaging',
  'documentation',
  'other',
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
  complaintNo?: string
  orderId: UUID
  complaintDate?: ISODate
  type: ComplaintType
  severity: ComplaintSeverity
  description: string
  status: ComplaintStatus
  rootCause?: string | null
  createdAt?: ISODateTime
  updatedAt?: ISODateTime
}

export interface CapaActionDto {
  id: UUID
  complaintId?: UUID
  description: string
  ownerId: UUID
  ownerName?: string
  dueDate: ISODate
  status: CapaStatus
  closedAt?: ISODateTime | null
  createdAt?: ISODateTime
}

export interface CreateComplaintDto {
  type: ComplaintType
  severity: ComplaintSeverity
  description: string
}

export interface CreateCapaDto {
  description: string
  ownerId: UUID
  dueDate: ISODate
}

export interface UpdateRootCauseDto {
  rootCause: string
}

export interface UpdateCapaStatusDto {
  status: CapaStatus
}

/** @deprecated Kept for UI that still references order types locally */
export const ORDER_TYPES = ['bulk', 'sample', 'repeat', 'trial'] as const
export type OrderType = (typeof ORDER_TYPES)[number]
