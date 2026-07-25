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
