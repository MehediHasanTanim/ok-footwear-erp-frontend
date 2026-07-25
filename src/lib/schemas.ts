// ── Orders Module Zod Schemas ────────────────────────────────────────────────
// Shared validation schemas used by both the create wizard and React Hook Form.
// Define once, reuse everywhere — no ad-hoc per-step validation.

import { z } from 'zod'

import { CURRENCY_CODES, ORDER_TYPES, SIZE_SYSTEMS } from '@/types/orders'

// ── Order Line Item ──────────────────────────────────────────────────────────
export const orderLineSchema = z.object({
  size_label: z.string().min(1, 'Size label is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unit_price: z.number().positive('Unit price must be positive').nullable().optional(),
})

// ── Create Order ─────────────────────────────────────────────────────────────
export const createOrderSchema = z
  .object({
    buyer_id: z.string().uuid('Please select a buyer'),
    article_id: z.string().uuid('Please select an article'),
    order_type: z.enum(ORDER_TYPES, { message: 'Invalid order type' }),
    season: z.string().optional(),
    currency: z
      .string()
      .length(3, 'Currency must be a 3-letter ISO 4217 code')
      .refine((val) => (CURRENCY_CODES as readonly string[]).includes(val), {
        message: 'Invalid ISO 4217 currency code',
      }),
    unit_price: z.number().positive('Unit price must be greater than 0'),
    total_quantity: z.number().int().positive('Total quantity must be a positive integer'),
    delivery_date: z.string().refine(
      (val) => {
        const date = new Date(val)
        return !isNaN(date.getTime()) && date > new Date()
      },
      { message: 'Delivery date must be in the future' }
    ),
    pi_number: z.string().optional(),
    lc_number: z.string().optional(),
    remarks: z.string().optional(),
    order_lines: z.array(orderLineSchema).min(1, 'At least one size line is required'),
  })
  .refine(
    (data) => {
      const lineTotal = data.order_lines.reduce((sum, line) => sum + line.quantity, 0)
      return lineTotal === data.total_quantity
    },
    {
      message: 'Line quantities must sum to the total quantity',
      path: ['order_lines'],
    }
  )

export type CreateOrderFormData = z.infer<typeof createOrderSchema>

// ── Update Order (draft-only) ────────────────────────────────────────────────
// Zod v4: .partial() doesn't work on schemas with .refine().
// Build a separate base schema without refinements for the update case.
const updateOrderBase = z.object({
  buyer_id: z.string().uuid('Please select a buyer').optional(),
  article_id: z.string().uuid('Please select an article').optional(),
  order_type: z.enum(ORDER_TYPES, { message: 'Invalid order type' }).optional(),
  season: z.string().optional(),
  currency: z
    .string()
    .length(3, 'Currency must be a 3-letter ISO 4217 code')
    .refine((val) => (CURRENCY_CODES as readonly string[]).includes(val), {
      message: 'Invalid ISO 4217 currency code',
    })
    .optional(),
  unit_price: z.number().positive('Unit price must be greater than 0').optional(),
  total_quantity: z.number().int().positive('Total quantity must be a positive integer').optional(),
  delivery_date: z
    .string()
    .refine(
      (val) => {
        const date = new Date(val)
        return !isNaN(date.getTime()) && date > new Date()
      },
      { message: 'Delivery date must be in the future' }
    )
    .optional(),
  pi_number: z.string().optional(),
  lc_number: z.string().optional(),
  remarks: z.string().optional(),
  order_lines: z.array(orderLineSchema).optional(),
})

export const updateOrderSchema = updateOrderBase.refine(
  (data) => {
    if (!data.order_lines || !data.total_quantity) return true
    const lineTotal = data.order_lines.reduce((sum, line) => sum + line.quantity, 0)
    return lineTotal === data.total_quantity
  },
  {
    message: 'Line quantities must sum to the total quantity',
    path: ['order_lines'],
  }
)

export type UpdateOrderFormData = z.infer<typeof updateOrderSchema>

// ── Status Transition ────────────────────────────────────────────────────────
export const transitionStatusSchema = z.object({
  toStatus: z.string().min(1, 'Target status is required'),
  cancellationReason: z.string().optional(),
})

export type TransitionStatusFormData = z.infer<typeof transitionStatusSchema>

// ── Buyer ────────────────────────────────────────────────────────────────────
export const createBuyerSchema = z.object({
  buyer_code: z.string().min(1, 'Buyer code is required'),
  name: z.string().min(1, 'Buyer name is required'),
  contact_name: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  payment_terms: z.number().int().min(0, 'Payment terms must be non-negative'),
  credit_limit: z.number().min(0, 'Credit limit must be non-negative'),
  currency: z
    .string()
    .length(3, 'Currency must be a 3-letter ISO 4217 code')
    .refine((val) => (CURRENCY_CODES as readonly string[]).includes(val), {
      message: 'Invalid ISO 4217 currency code',
    }),
  notes: z.string().optional(),
})

export type CreateBuyerFormData = z.infer<typeof createBuyerSchema>

// ── Article ──────────────────────────────────────────────────────────────────
export const createArticleSchema = z.object({
  article_code: z.string().min(1, 'Article code is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  sub_category: z.string().optional(),
  gender: z.string().optional(),
  season: z.string().optional(),
  size_system: z.string().refine((val) => (SIZE_SYSTEMS as readonly string[]).includes(val), {
    message: 'Invalid size system',
  }),
})

export type CreateArticleFormData = z.infer<typeof createArticleSchema>
