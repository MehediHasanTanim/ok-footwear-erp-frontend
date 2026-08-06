// ── Orders Module Zod Schemas ────────────────────────────────────────────────
// Field names match NestJS OpenAPI DTOs (camelCase).

import { z } from 'zod'

import { CURRENCY_CODES, PAYMENT_TERMS, SIZE_SYSTEMS } from '@/types/orders'
import { VENDOR_TYPES, VENDOR_STATUSES } from '@/types/procurement'

export const orderLineSchema = z.object({
  sizeLabel: z.string().min(1, 'Size label is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unitPrice: z.number().positive('Unit price must be greater than 0'),
})

export const createOrderSchema = z
  .object({
    buyerId: z.string().min(1, 'Please select a buyer'),
    articleId: z.string().min(1, 'Please select an article'),
    currency: z
      .string()
      .length(3, 'Currency must be a 3-letter ISO 4217 code')
      .refine((val) => (CURRENCY_CODES as readonly string[]).includes(val), {
        message: 'Invalid ISO 4217 currency code',
      }),
    /** UI-only: applied to every order line as unitPrice on submit */
    unitPrice: z.number().positive('Unit price must be greater than 0'),
    totalQuantity: z.number().int().positive('Total quantity must be a positive integer'),
    deliveryDate: z.string().refine(
      (val) => {
        const date = new Date(val)
        return !isNaN(date.getTime()) && date > new Date()
      },
      { message: 'Delivery date must be in the future' }
    ),
    orderLines: z.array(orderLineSchema).min(1, 'At least one size line is required'),
  })
  .refine(
    (data) => {
      const lineTotal = data.orderLines.reduce((sum, line) => sum + line.quantity, 0)
      return lineTotal === data.totalQuantity
    },
    {
      message: 'Line quantities must sum to the total quantity',
      path: ['orderLines'],
    }
  )

export type CreateOrderFormData = z.infer<typeof createOrderSchema>

const updateOrderBase = z.object({
  articleId: z.string().min(1, 'Please select an article').optional(),
  currency: z
    .string()
    .length(3, 'Currency must be a 3-letter ISO 4217 code')
    .refine((val) => (CURRENCY_CODES as readonly string[]).includes(val), {
      message: 'Invalid ISO 4217 currency code',
    })
    .optional(),
  unitPrice: z.number().positive('Unit price must be greater than 0').optional(),
  totalQuantity: z.number().int().positive('Total quantity must be a positive integer').optional(),
  deliveryDate: z
    .string()
    .refine(
      (val) => {
        const date = new Date(val)
        return !isNaN(date.getTime()) && date > new Date()
      },
      { message: 'Delivery date must be in the future' }
    )
    .optional(),
  sampleApproved: z.boolean().optional(),
  orderLines: z.array(orderLineSchema).optional(),
})

export const updateOrderSchema = updateOrderBase.refine(
  (data) => {
    if (!data.orderLines || !data.totalQuantity) return true
    const lineTotal = data.orderLines.reduce((sum, line) => sum + line.quantity, 0)
    return lineTotal === data.totalQuantity
  },
  {
    message: 'Line quantities must sum to the total quantity',
    path: ['orderLines'],
  }
)

export type UpdateOrderFormData = z.infer<typeof updateOrderSchema>

export const transitionStatusSchema = z.object({
  toStatus: z.string().min(1, 'Target status is required'),
  cancellationReason: z.string().optional(),
})

export type TransitionStatusFormData = z.infer<typeof transitionStatusSchema>

export const createBuyerSchema = z.object({
  name: z.string().min(1, 'Buyer name is required'),
  currency: z
    .string()
    .length(3, 'Currency must be a 3-letter ISO 4217 code')
    .refine((val) => (CURRENCY_CODES as readonly string[]).includes(val), {
      message: 'Invalid ISO 4217 currency code',
    }),
  paymentTerms: z.enum(PAYMENT_TERMS, { message: 'Invalid payment terms' }),
  creditLimit: z.number().min(0, 'Credit limit must be non-negative').optional(),
  country: z.string().optional(),
})

export type CreateBuyerFormData = z.infer<typeof createBuyerSchema>

export const createArticleSchema = z.object({
  code: z.string().min(1, 'Article code is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().optional(),
  season: z.string().optional(),
  sizeSystem: z
    .string()
    .optional()
    .refine((val) => !val || (SIZE_SYSTEMS as readonly string[]).includes(val), {
      message: 'Invalid size system',
    }),
})

export type CreateArticleFormData = z.infer<typeof createArticleSchema>

// ── Procurement schemas ──────────────────────────────────────────────────────
export const createVendorSchema = z.object({
  vendorCode: z.string().min(1, 'Vendor code is required'),
  name: z.string().min(1, 'Vendor name is required'),
  type: z.enum(VENDOR_TYPES, { message: 'Invalid vendor type' }),
  categoryId: z.string().min(1, 'Category is required'),
  contactName: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().min(1, 'Address is required'),
  tradeLicense: z.string().min(1, 'Trade licence is required'),
  tinNumber: z.string().min(1, 'TIN is required'),
  bankName: z.string().min(1, 'Bank name is required'),
  bankAccount: z.string().min(1, 'Bank account is required'),
  paymentTerms: z.number().int().min(0, 'Payment terms must be ≥ 0'),
  creditLimit: z.number().min(0, 'Credit limit must be ≥ 0'),
  status: z.enum(VENDOR_STATUSES, { message: 'Status is required' }),
  notes: z.string().optional(),
})
export type CreateVendorFormData = z.infer<typeof createVendorSchema>
export const vendorFormSchema = createVendorSchema
export type VendorFormData = CreateVendorFormData

export const createPoLineSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  orderedQty: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price must be non-negative'),
  uom: z.string().min(1, 'UOM is required'),
  deliveryDate: z.string().optional(),
})

export const createPoSchema = z.object({
  vendorId: z.string().min(1, 'Please select a vendor'),
  currency: z.string().length(3),
  deliveryDate: z.string().min(1, 'Delivery date is required'),
  notes: z.string().optional(),
  lines: z.array(createPoLineSchema).min(1, 'Add at least one line'),
})
export type CreatePoFormData = z.infer<typeof createPoSchema>

export const createVendorInvoiceSchema = z.object({
  vendorId: z.string().min(1),
  grnId: z.string().min(1),
  invoiceNo: z.string().min(1),
  invoiceDate: z.string().min(1),
  dueDate: z.string().min(1),
  currency: z.string().length(3).optional(),
  grossAmount: z.number().positive(),
})
export type CreateVendorInvoiceFormData = z.infer<typeof createVendorInvoiceSchema>
