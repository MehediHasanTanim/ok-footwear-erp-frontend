// Shared domain types for OK Footwear ERP
// All entities follow the backend schema: docs/design/OK_Footwear_ERP_Schema.sql

/** ISO-8601 date string, e.g. "2026-01-15" */
export type ISODate = string

/** ISO-8601 datetime string, e.g. "2026-01-15T10:30:00Z" */
export type ISODateTime = string

/** UUID v4 primary key */
export type UUID = string

/** Audited entity with create/update timestamps */
export interface AuditedEntity {
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

// Re-export order types
export type {
  OrderStatus,
  OrderType,
  MilestoneType,
  MilestoneStatus,
  SizeSystem,
  ArticleCategory,
  CurrencyCode,
  OrderResponseDto,
  OrderListResponseDto,
  OrderLineDto,
  OrderMilestoneDto,
  CreateOrderDto,
  UpdateOrderDto,
  TransitionStatusDto,
  BuyerDto,
  BuyerDropdownDto,
  ArticleDto,
  CreateBuyerDto,
  UpdateBuyerDto,
  CreateArticleDto,
  UpdateArticleDto,
  OrdersFilter,
  BuyersFilter,
  ArticlesFilter,
} from './orders'

export {
  ORDER_STATUSES,
  ORDER_TYPES,
  MILESTONE_TYPES,
  MILESTONE_STATUSES,
  SIZE_SYSTEMS,
  ARTICLE_CATEGORIES,
  CURRENCY_CODES,
  SIZE_RUN_MAP,
  ORDER_STATUS_META,
} from './orders'
