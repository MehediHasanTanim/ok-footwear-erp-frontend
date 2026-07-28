// ── Orders MSW Handlers (v2 syntax) ──────────────────────────────────────────
import { http, HttpResponse } from 'msw'

import type { ApiResponse } from '@/lib/api'
import type {
  BuyerDto,
  BuyerDropdownDto,
  ArticleDto,
  OrderResponseDto,
  CreateOrderDto,
  UpdateOrderDto,
  TransitionStatusDto,
  CreateBuyerDto,
  CreateArticleDto,
  OrderStatus,
  QuotationDto,
  CreateQuotationDto,
  SampleDto,
  CreateSampleDto,
  ComplaintDto,
  CreateComplaintDto,
  CapaActionDto,
  CreateCapaDto,
} from '@/types/orders'

// ── Base URL ─────────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:7100/api'

// ── In‑memory store (reset between tests) ───────────────────────────────────
let orders: OrderResponseDto[] = []
let buyers: BuyerDto[] = []
let articles: ArticleDto[] = []
let orderCounter = 1

// ── Seed helpers ─────────────────────────────────────────────────────────────
export function seedOrder(order: OrderResponseDto): void {
  orders.push(order)
}

export function seedBuyer(buyer: BuyerDto): void {
  buyers.push(buyer)
}

export function seedArticle(article: ArticleDto): void {
  articles.push(article)
}

export function resetOrdersStore(): void {
  orders = []
  buyers = []
  articles = []
  orderCounter = 1
}

// ── Factory helpers ──────────────────────────────────────────────────────────
function makeOrder(overrides: Partial<OrderResponseDto> = {}): OrderResponseDto {
  const id = overrides.id ?? crypto.randomUUID()
  return {
    id,
    order_number: overrides.order_number ?? `ORD-${String(orderCounter++).padStart(6, '0')}`,
    buyer_id: overrides.buyer_id ?? 'buyer-1',
    buyer: overrides.buyer ?? {
      id: 'buyer-1',
      buyer_code: 'BUY001',
      name: 'Test Buyer',
      currency: 'USD',
    },
    article_id: overrides.article_id ?? 'article-1',
    article: overrides.article ?? {
      id: 'article-1',
      article_code: 'ART001',
      description: 'Test Article',
      size_system: 'EU',
    },
    order_type: overrides.order_type ?? 'bulk',
    season: overrides.season,
    status: overrides.status ?? 'draft',
    currency: overrides.currency ?? 'USD',
    unit_price: overrides.unit_price ?? 10.5,
    total_quantity: overrides.total_quantity ?? 100,
    delivery_date: overrides.delivery_date ?? '2026-12-31',
    pi_number: overrides.pi_number,
    lc_number: overrides.lc_number,
    sample_approved: overrides.sample_approved ?? false,
    remarks: overrides.remarks,
    nextAllowedStates: overrides.nextAllowedStates ?? ['confirmed', 'cancelled'],
    order_lines: overrides.order_lines ?? [],
    milestones: overrides.milestones ?? [],
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  }
}

function makeBuyer(overrides: Partial<BuyerDto> = {}): BuyerDto {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    buyer_code: overrides.buyer_code ?? 'BUY001',
    name: overrides.name ?? 'Test Buyer',
    contact_name: overrides.contact_name,
    email: overrides.email,
    phone: overrides.phone,
    address: overrides.address,
    country: overrides.country ?? 'Bangladesh',
    payment_terms: overrides.payment_terms ?? 30,
    credit_limit: overrides.credit_limit ?? 100000,
    currency: overrides.currency ?? 'USD',
    is_active: overrides.is_active ?? true,
    notes: overrides.notes,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  }
}

function makeArticle(overrides: Partial<ArticleDto> = {}): ArticleDto {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    article_code: overrides.article_code ?? 'ART001',
    description: overrides.description ?? 'Test Article',
    category: overrides.category ?? 'men',
    sub_category: overrides.sub_category,
    gender: overrides.gender,
    season: overrides.season,
    size_system: overrides.size_system ?? 'EU',
    is_active: overrides.is_active ?? true,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  }
}

// ── State machine logic (mirrors backend for nextAllowedStates) ────────────
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['in_production', 'cancelled'],
  in_production: ['qc'],
  qc: ['packed'],
  packed: ['delivered'],
  delivered: [],
  cancelled: [],
}

function computeNextAllowed(order: OrderResponseDto): OrderStatus[] {
  const base = STATUS_TRANSITIONS[order.status] ?? []
  // Sample‑approval gate: block confirmed → in_production when sample_approved is false
  if (order.status === 'confirmed' && !order.sample_approved) {
    return base.filter((s) => s !== 'in_production')
  }
  return base
}

// ── Handlers ─────────────────────────────────────────────────────────────────
export const ordersHandlers = [
  // GET /orders — paginated list
  http.get(`${BASE}/orders`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)
    const status = url.searchParams.get('status')?.split(',')
    const buyerId = url.searchParams.get('buyer_id')
    const dateFrom = url.searchParams.get('delivery_date_from')
    const dateTo = url.searchParams.get('delivery_date_to')
    const search = url.searchParams.get('search')?.toLowerCase()

    let filtered = [...orders]

    if (status && status.length > 0) {
      filtered = filtered.filter((o) => status.includes(o.status))
    }
    if (buyerId) {
      filtered = filtered.filter((o) => o.buyer_id === buyerId)
    }
    if (dateFrom) {
      filtered = filtered.filter((o) => o.delivery_date >= dateFrom)
    }
    if (dateTo) {
      filtered = filtered.filter((o) => o.delivery_date <= dateTo)
    }
    if (search) {
      filtered = filtered.filter(
        (o) =>
          o.order_number.toLowerCase().includes(search) ||
          o.buyer.name.toLowerCase().includes(search) ||
          o.article.article_code.toLowerCase().includes(search)
      )
    }

    const total = filtered.length
    const start = (page - 1) * limit
    const paged = filtered.slice(start, start + limit).map((o) => ({
      ...o,
      nextAllowedStates: computeNextAllowed(o),
      order_lines: undefined,
      milestones: undefined,
    }))

    const resp: ApiResponse<OrderResponseDto[]> = {
      data: paged,
      meta: { page, limit, total },
    }
    return HttpResponse.json(resp)
  }),

  // POST /orders — create
  http.post(`${BASE}/orders`, async ({ request }) => {
    const body = (await request.json()) as CreateOrderDto
    const now = new Date().toISOString()
    const order = makeOrder({
      ...body,
      status: 'draft',
      order_lines:
        body.order_lines?.map((l) => ({
          id: crypto.randomUUID(),
          order_id: '',
          size_label: l.size_label,
          quantity: l.quantity,
          unit_price: l.unit_price ?? null,
          createdAt: now,
        })) ?? [],
      createdAt: now,
      updatedAt: now,
    })
    orders.unshift(order)
    const resp: ApiResponse<OrderResponseDto> = {
      data: { ...order, nextAllowedStates: computeNextAllowed(order) },
    }
    return HttpResponse.json(resp, { status: 201 })
  }),

  // GET /orders/:id — detail
  http.get(`${BASE}/orders/:id`, ({ params }) => {
    const order = orders.find((o) => o.id === params.id)
    if (!order) {
      return HttpResponse.json(
        { detail: `Order ${params.id} not found`, status: 404 },
        { status: 404 }
      )
    }
    const resp: ApiResponse<OrderResponseDto> = {
      data: { ...order, nextAllowedStates: computeNextAllowed(order) },
    }
    return HttpResponse.json(resp)
  }),

  // PATCH /orders/:id — update (draft only)
  http.patch(`${BASE}/orders/:id`, async ({ params, request }) => {
    const order = orders.find((o) => o.id === params.id)
    if (!order) {
      return HttpResponse.json(
        { detail: `Order ${params.id} not found`, status: 404 },
        { status: 404 }
      )
    }
    if (order.status !== 'draft') {
      return HttpResponse.json(
        { detail: 'Only draft orders can be edited', status: 422 },
        { status: 422 }
      )
    }
    const body = (await request.json()) as UpdateOrderDto
    Object.assign(order, body, { updatedAt: new Date().toISOString() })
    // Update order_lines if provided
    if (body.order_lines) {
      const now = new Date().toISOString()
      order.order_lines = body.order_lines.map((l) => ({
        id: crypto.randomUUID(),
        order_id: order.id,
        size_label: l.size_label,
        quantity: l.quantity,
        unit_price: l.unit_price ?? null,
        createdAt: now,
      }))
    }
    const resp: ApiResponse<OrderResponseDto> = {
      data: { ...order, nextAllowedStates: computeNextAllowed(order) },
    }
    return HttpResponse.json(resp)
  }),

  // PATCH /orders/:id/status — transition
  http.patch(`${BASE}/orders/:id/status`, async ({ params, request }) => {
    const order = orders.find((o) => o.id === params.id)
    if (!order) {
      return HttpResponse.json(
        { detail: `Order ${params.id} not found`, status: 404 },
        { status: 404 }
      )
    }
    const body = (await request.json()) as TransitionStatusDto
    const allowed = computeNextAllowed(order)

    if (!allowed.includes(body.toStatus)) {
      return HttpResponse.json(
        {
          detail: `Cannot transition from '${order.status}' to '${body.toStatus}'. Allowed: ${allowed.join(', ')}`,
          status: 422,
        },
        { status: 422 }
      )
    }

    // Sample gate on confirmed → in_production
    if (
      order.status === 'confirmed' &&
      body.toStatus === 'in_production' &&
      !order.sample_approved
    ) {
      return HttpResponse.json(
        {
          detail:
            'Sample approval is required before moving to production. Please approve the PP sample first.',
          status: 422,
          errors: { sample_approved: ['Sample must be approved before production'] },
        },
        { status: 422 }
      )
    }

    // Cancellation reason required
    if (body.toStatus === 'cancelled' && !body.cancellationReason) {
      return HttpResponse.json(
        {
          detail: 'Cancellation reason is required',
          status: 422,
          errors: { cancellationReason: ['Cancellation reason is required'] },
        },
        { status: 422 }
      )
    }

    order.status = body.toStatus as OrderStatus
    order.updatedAt = new Date().toISOString()

    if (body.toStatus === 'cancelled') {
      order.remarks = body.cancellationReason ?? order.remarks
    }

    const resp: ApiResponse<OrderResponseDto> = {
      data: { ...order, nextAllowedStates: computeNextAllowed(order) },
    }
    return HttpResponse.json(resp)
  }),

  // GET /buyers — list with optional dropdown/search
  http.get(`${BASE}/buyers`, ({ request }) => {
    const url = new URL(request.url)
    const dropdown = url.searchParams.get('dropdown') === 'true'
    const search = url.searchParams.get('search')?.toLowerCase()
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

    let filtered = buyers.filter((b) => b.is_active)

    if (search) {
      filtered = filtered.filter(
        (b) => b.name.toLowerCase().includes(search) || b.buyer_code.toLowerCase().includes(search)
      )
    }

    if (dropdown) {
      const dropdownData: BuyerDropdownDto[] = filtered.map((b) => ({
        id: b.id,
        buyer_code: b.buyer_code,
        name: b.name,
        country: b.country,
      }))
      return HttpResponse.json({ data: dropdownData })
    }

    const total = filtered.length
    const start = (page - 1) * limit
    const paged = filtered.slice(start, start + limit)

    return HttpResponse.json({
      data: paged,
      meta: { page, limit, total },
    })
  }),

  // GET /buyers/:id
  http.get(`${BASE}/buyers/:id`, ({ params }) => {
    const buyer = buyers.find((b) => b.id === params.id)
    if (!buyer) {
      return HttpResponse.json({ detail: 'Buyer not found', status: 404 }, { status: 404 })
    }
    return HttpResponse.json({ data: buyer })
  }),

  // POST /buyers
  http.post(`${BASE}/buyers`, async ({ request }) => {
    const body = (await request.json()) as CreateBuyerDto
    const buyer = makeBuyer(body)
    buyers.unshift(buyer)
    return HttpResponse.json({ data: buyer }, { status: 201 })
  }),

  // PATCH /buyers/:id
  http.patch(`${BASE}/buyers/:id`, async ({ params, request }) => {
    const buyer = buyers.find((b) => b.id === params.id)
    if (!buyer) {
      return HttpResponse.json({ detail: 'Buyer not found', status: 404 }, { status: 404 })
    }
    const body = (await request.json()) as Partial<BuyerDto>
    Object.assign(buyer, body, { updatedAt: new Date().toISOString() })
    return HttpResponse.json({ data: buyer })
  }),

  // GET /articles — list
  http.get(`${BASE}/articles`, ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')?.toLowerCase()
    const category = url.searchParams.get('category')
    const season = url.searchParams.get('season')
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

    let filtered = articles.filter((a) => a.is_active)

    if (search) {
      filtered = filtered.filter(
        (a) =>
          a.description.toLowerCase().includes(search) ||
          a.article_code.toLowerCase().includes(search)
      )
    }
    if (category) {
      filtered = filtered.filter((a) => a.category === category)
    }
    if (season) {
      filtered = filtered.filter((a) => a.season === season)
    }

    const total = filtered.length
    const start = (page - 1) * limit
    const paged = filtered.slice(start, start + limit)

    return HttpResponse.json({
      data: paged,
      meta: { page, limit, total },
    })
  }),

  // GET /articles/:id
  http.get(`${BASE}/articles/:id`, ({ params }) => {
    const article = articles.find((a) => a.id === params.id)
    if (!article) {
      return HttpResponse.json({ detail: 'Article not found', status: 404 }, { status: 404 })
    }
    return HttpResponse.json({ data: article })
  }),

  // POST /articles
  http.post(`${BASE}/articles`, async ({ request }) => {
    const body = (await request.json()) as CreateArticleDto
    const article = makeArticle(body)
    articles.unshift(article)
    return HttpResponse.json({ data: article }, { status: 201 })
  }),

  // PATCH /articles/:id
  http.patch(`${BASE}/articles/:id`, async ({ params, request }) => {
    const article = articles.find((a) => a.id === params.id)
    if (!article) {
      return HttpResponse.json({ detail: 'Article not found', status: 404 }, { status: 404 })
    }
    const body = (await request.json()) as Partial<ArticleDto>
    Object.assign(article, body, { updatedAt: new Date().toISOString() })
    return HttpResponse.json({ data: article })
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Sprint 4: Quotations, Samples, Complaints, CAPA
  // ═══════════════════════════════════════════════════════════════════════════

  // POST /orders/:orderId/quotations — create quotation
  http.post(`${BASE}/orders/:orderId/quotations`, async ({ params, request }) => {
    const body = (await request.json()) as CreateQuotationDto
    const orderId = params.orderId as string
    const quotation: QuotationDto = {
      id: crypto.randomUUID(),
      quotation_number: `QT-${String(Date.now()).slice(-6)}`,
      order_id: orderId,
      buyer_id: orders.find((o) => o.id === orderId)?.buyer_id ?? '',
      article_id: orders.find((o) => o.id === orderId)?.article_id ?? '',
      version: 1,
      currency: body.currency,
      total_cost: null,
      margin_pct: null,
      quoted_price: body.quoted_price,
      win_probability: body.win_probability ?? null,
      valid_until: new Date(Date.now() + 30 * 24 * 3600_000).toISOString().split('T')[0]!,
      status: 'draft',
      sent_at: null,
      outcome_reason: null,
      notes: body.notes ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return HttpResponse.json({ data: quotation }, { status: 201 })
  }),

  // GET /orders/:orderId/quotations — list
  http.get(`${BASE}/orders/:orderId/quotations`, () => {
    return HttpResponse.json({ data: [] })
  }),

  // POST /orders/:orderId/quotations/:id/send
  http.post(`${BASE}/orders/:orderId/quotations/:id/send`, () => {
    return HttpResponse.json({ data: { status: 'sent' } })
  }),

  // POST /orders/:orderId/quotations/:id/close — win/loss
  http.post(`${BASE}/orders/:orderId/quotations/:id/close`, async ({ request }) => {
    const body = (await request.json()) as { outcome: string; outcomeReason: string }
    // Simulate 409 Conflict when trying to mark as won
    if (body.outcome === 'won') {
      return HttpResponse.json(
        { detail: 'Another quotation has already been marked as won for this order.' },
        { status: 409 }
      )
    }
    return HttpResponse.json({ data: { status: 'lost' } })
  }),

  // POST /orders/:orderId/quotations/:id/bom-populate — stub 501
  http.post(`${BASE}/orders/:orderId/quotations/:id/bom-populate`, () => {
    return HttpResponse.json(
      { detail: 'BOM cost auto-population is not yet available.' },
      { status: 501 }
    )
  }),

  // POST /orders/:orderId/samples — create sample round
  http.post(`${BASE}/orders/:orderId/samples`, async ({ params, request }) => {
    const body = (await request.json()) as CreateSampleDto
    const orderId = params.orderId as string
    const sample: SampleDto = {
      id: crypto.randomUUID(),
      order_id: orderId,
      round_number: 1,
      sample_type: body.sample_type,
      dispatch_date: body.dispatch_date ?? null,
      received_date: null,
      courier: null,
      tracking_no: null,
      approval_status: 'pending',
      buyer_comment: null,
      remarks: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return HttpResponse.json({ data: sample }, { status: 201 })
  }),

  // GET /orders/:orderId/samples — list
  http.get(`${BASE}/orders/:orderId/samples`, () => {
    return HttpResponse.json({ data: [] })
  }),

  // POST /orders/:orderId/samples/:id/approve
  http.post(`${BASE}/orders/:orderId/samples/:id/approve`, ({ params }) => {
    // Update the order's sample_approved flag
    const order = orders.find((o) => o.id === params.orderId)
    if (order) order.sample_approved = true
    return HttpResponse.json({ data: { approval_status: 'approved' } })
  }),

  // POST /orders/:orderId/samples/:id/reject
  http.post(`${BASE}/orders/:orderId/samples/:id/reject`, () => {
    return HttpResponse.json({ data: { approval_status: 'rejected' } })
  }),

  // POST /orders/:orderId/complaints
  http.post(`${BASE}/orders/:orderId/complaints`, async ({ params, request }) => {
    const body = (await request.json()) as CreateComplaintDto
    const orderId = params.orderId as string
    const complaint: ComplaintDto = {
      id: crypto.randomUUID(),
      complaint_no: `CMP-${String(Date.now()).slice(-6)}`,
      order_id: orderId,
      complaint_date: new Date().toISOString().split('T')[0]!,
      type: body.type,
      severity: body.severity,
      description: body.description,
      status: 'open',
      root_cause: null,
      quantity: null,
      resolved_at: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return HttpResponse.json({ data: complaint }, { status: 201 })
  }),

  // GET /orders/:orderId/complaints — list
  http.get(`${BASE}/orders/:orderId/complaints`, () => {
    return HttpResponse.json({ data: [] })
  }),

  // PATCH /orders/:orderId/complaints/:id/root-cause
  http.patch(`${BASE}/orders/:orderId/complaints/:id/root-cause`, async ({ request }) => {
    const body = (await request.json()) as { root_cause: string }
    return HttpResponse.json({ data: { root_cause: body.root_cause } })
  }),

  // POST /orders/:orderId/complaints/:complaintId/capa
  http.post(`${BASE}/orders/:orderId/complaints/:complaintId/capa`, async ({ params, request }) => {
    const body = (await request.json()) as CreateCapaDto
    const complaintId = params.complaintId as string
    const capa: CapaActionDto = {
      id: crypto.randomUUID(),
      complaint_id: complaintId,
      action_type: 'corrective',
      description: body.description,
      owner_user_id: body.owner_user_id,
      due_date: body.due_date,
      status: 'open',
      closed_at: null,
      createdAt: new Date().toISOString(),
    }
    return HttpResponse.json({ data: capa }, { status: 201 })
  }),

  // GET /orders/:orderId/complaints/:complaintId/capa
  http.get(`${BASE}/orders/:orderId/complaints/:complaintId/capa`, () => {
    return HttpResponse.json({ data: [] })
  }),

  // PATCH /orders/:orderId/complaints/:complaintId/capa/:capaId/status
  http.patch(
    `${BASE}/orders/:orderId/complaints/:complaintId/capa/:capaId/status`,
    async ({ request }) => {
      const body = (await request.json()) as { status: string }
      return HttpResponse.json({ data: { status: body.status } })
    }
  ),
]
