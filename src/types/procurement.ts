// ── Procurement types — camelCase aligned to OpenAPI /prc schema ─────────────

export interface StatusBadgeMeta {
  labelKey: string
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
  badgeClass: string
}

// ── Vendor ───────────────────────────────────────────────────────────────────

export const VENDOR_TYPES = [
  'raw_material',
  'sole',
  'accessory',
  'packaging',
  'machine',
  'service',
] as const
export type VendorType = (typeof VENDOR_TYPES)[number]

export const VENDOR_STATUSES = ['approved', 'under_review', 'blacklisted'] as const
export type VendorStatus = (typeof VENDOR_STATUSES)[number]

export const VENDOR_STATUS_META: Record<VendorStatus, StatusBadgeMeta> = {
  approved: {
    labelKey: 'procurement.vendorStatus.approved',
    badgeVariant: 'default',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  under_review: {
    labelKey: 'procurement.vendorStatus.pending',
    badgeVariant: 'secondary',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  blacklisted: {
    labelKey: 'procurement.vendorStatus.blacklisted',
    badgeVariant: 'destructive',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
}

export interface VendorDto {
  id: string
  vendorCode: string
  name: string
  type: VendorType
  categoryId?: string | null
  contactName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  tradeLicense?: string | null
  tinNumber?: string | null
  bankName?: string | null
  bankAccount?: string | null
  paymentTerms?: number | null
  creditLimit?: number | null
  status: VendorStatus
  rating?: number | null
  notes?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CreateVendorDto {
  vendorCode: string
  name: string
  type: VendorType
  categoryId: string
  contactName: string
  email: string
  phone: string
  address: string
  tradeLicense: string
  tinNumber: string
  bankName: string
  bankAccount: string
  paymentTerms: number
  creditLimit: number
  status: VendorStatus
  notes?: string
}

export type UpdateVendorDto = Partial<CreateVendorDto>

export interface VendorCategoryDto {
  id: string
  name: string
  code: string
}

export interface CreateVendorCategoryDto {
  name: string
  code: string
}

export type UpdateVendorCategoryDto = Partial<CreateVendorCategoryDto>

export interface VendorDropdownDto {
  id: string
  vendorCode: string
  name: string
  status: VendorStatus
}

// ── Purchase Orders ──────────────────────────────────────────────────────────

export const PO_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'partially_received',
  'received',
  'cancelled',
] as const
export type PoStatus = (typeof PO_STATUSES)[number]

export const PO_STATUS_META: Record<PoStatus, StatusBadgeMeta> = {
  draft: {
    labelKey: 'procurement.poStatus.draft',
    badgeVariant: 'secondary',
    badgeClass: 'bg-slate-100 text-slate-800',
  },
  pending_approval: {
    labelKey: 'procurement.poStatus.pendingApproval',
    badgeVariant: 'secondary',
    badgeClass: 'bg-amber-100 text-amber-800',
  },
  approved: {
    labelKey: 'procurement.poStatus.approved',
    badgeVariant: 'default',
    badgeClass: 'bg-green-100 text-green-800',
  },
  partially_received: {
    labelKey: 'procurement.poStatus.partiallyReceived',
    badgeVariant: 'secondary',
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  received: {
    labelKey: 'procurement.poStatus.received',
    badgeVariant: 'default',
    badgeClass: 'bg-emerald-100 text-emerald-800',
  },
  cancelled: {
    labelKey: 'procurement.poStatus.cancelled',
    badgeVariant: 'destructive',
    badgeClass: 'bg-red-100 text-red-800',
  },
}

export interface PoLineDto {
  id?: string
  itemId: string
  itemCode?: string | null
  itemName?: string | null
  orderedQty: number
  receivedQty?: number
  unitPrice: number
  uom: string
  deliveryDate?: string | null
}

export interface PurchaseOrderDto {
  id: string
  poNumber: string
  vendorId: string
  vendor?: { id: string; name: string; vendorCode?: string; status?: VendorStatus } | null
  status: PoStatus
  currency: string
  totalAmount: number
  deliveryDate: string
  notes?: string | null
  approvedBy?: string | null
  approvedByName?: string | null
  approvedAt?: string | null
  rejectedReason?: string | null
  lines?: PoLineDto[]
  createdAt?: string
  updatedAt?: string
  createdBy?: string
}

export interface CreatePurchaseOrderDto {
  vendorId: string
  currency: string
  deliveryDate: string
  notes?: string
  lines: Array<{
    itemId: string
    orderedQty: number
    unitPrice: number
    uom: string
    deliveryDate?: string
  }>
}

export interface UpdatePurchaseOrderDto {
  deliveryDate?: string
  currency?: string
  notes?: string
  lines?: CreatePurchaseOrderDto['lines']
}

export interface RejectPurchaseOrderDto {
  reason: string
}

/** Client-side approval threshold labels (Sprint 5 backend doc). */
export type ApprovalThresholdTier = 'line_mgr' | 'manager' | 'finance' | 'md'

export function approvalThresholdForAmount(amount: number): ApprovalThresholdTier {
  if (amount < 50_000) return 'line_mgr'
  if (amount < 500_000) return 'manager'
  if (amount < 5_000_000) return 'finance'
  return 'md'
}

export const APPROVAL_THRESHOLD_LABEL_KEY: Record<ApprovalThresholdTier, string> = {
  line_mgr: 'procurement.threshold.lineMgr',
  manager: 'procurement.threshold.manager',
  finance: 'procurement.threshold.finance',
  md: 'procurement.threshold.md',
}

// ── Goods Receipts ───────────────────────────────────────────────────────────

export const GRN_STATUSES = ['draft', 'qc_pending', 'approved', 'rejected'] as const
export type GrnStatus = (typeof GRN_STATUSES)[number]

export const GRN_QC_STATUSES = ['pending', 'accepted', 'rejected', 'hold'] as const
export type GrnQcStatus = (typeof GRN_QC_STATUSES)[number]

export interface GrLineDto {
  id?: string
  poLineId: string
  receivedQty: number
  acceptedQty?: number
  rejectedQty?: number
  qcStatus?: GrnQcStatus
  rejectionReason?: string | null
  batchLot?: string | null
  unitCost?: number | null
  photos?: Array<{ id: string; url: string }>
}

export interface GoodsReceiptDto {
  id: string
  grnNumber: string
  poId: string
  receiptDate: string
  status: GrnStatus
  vehicleNo?: string | null
  notes?: string | null
  lines?: GrLineDto[]
  createdAt?: string
  updatedAt?: string
}

export interface CreateGoodsReceiptDto {
  poId: string
  receiptDate?: string
  vehicleNo?: string
  notes?: string
  lines: Array<{
    poLineId: string
    receivedQty: number
    acceptedQty?: number
    rejectedQty?: number
    qcStatus?: GrnQcStatus
    rejectionReason?: string
    batchLot?: string
    unitCost?: number
  }>
}

export interface UpdateGrLineDto {
  receivedQty?: number
  acceptedQty?: number
  rejectedQty?: number
  qcStatus?: GrnQcStatus
  rejectionReason?: string
  unitCost?: number
}

export function isValidGrnQtySplit(
  receivedQty: number,
  acceptedQty: number,
  rejectedQty: number
): boolean {
  return acceptedQty + rejectedQty <= receivedQty + 1e-9
}

// ── Vendor Invoices ──────────────────────────────────────────────────────────

export const INVOICE_STATUSES = ['pending', 'partial', 'paid', 'disputed', 'cancelled'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const DEFAULT_MATCH_TOLERANCE_PCT = 5

export interface VendorInvoiceDto {
  id: string
  vendorId: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string
  currency: string
  grossAmount: number
  tdsAmount?: number
  netPayable?: number
  paidAmount?: number
  status: InvoiceStatus
  grnId?: string | null
  poId?: string | null
  poAmount?: number | null
  grnAmount?: number | null
  tolerancePct?: number | null
  matchStatus?: string | null
  createdAt?: string
}

export interface CreateVendorInvoiceDto {
  vendorId: string
  grnId: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string
  currency?: string
  grossAmount: number
}

// ── Stock items (Sprint 6 catalog; FE uses /inventory/items) ──────────────────

export interface StockItemDto {
  id: string
  code: string
  name: string
  uom?: string
}
