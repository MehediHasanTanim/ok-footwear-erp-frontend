// ── Orders MSW Handlers (v2 syntax) — camelCase aligned to OpenAPI ───────────
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

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:7100/api'

let orders: OrderResponseDto[] = []
let buyers: BuyerDto[] = []
let articles: ArticleDto[] = []
let quotations: QuotationDto[] = []
let samples: SampleDto[] = []
let orderCounter = 1

export function seedOrder(order: OrderResponseDto): void {
  orders.push(order)
}

export function seedBuyer(buyer: BuyerDto): void {
  buyers.push(buyer)
}

export function seedArticle(article: ArticleDto): void {
  articles.push(article)
}

export function seedSample(sample: SampleDto): void {
  samples.push(sample)
}

export function resetOrdersStore(): void {
  orders = []
  buyers = []
  articles = []
  quotations = []
  samples = []
  orderCounter = 1
}

function makeOrder(overrides: Partial<OrderResponseDto> = {}): OrderResponseDto {
  const id = overrides.id ?? crypto.randomUUID()
  return {
    id,
    orderNumber: overrides.orderNumber ?? `ORD-${String(orderCounter++).padStart(6, '0')}`,
    buyerId: overrides.buyerId ?? 'buyer-1',
    buyer: overrides.buyer ?? {
      id: 'buyer-1',
      code: 'BUY001',
      name: 'Test Buyer',
      currency: 'USD',
    },
    articleId: overrides.articleId ?? 'article-1',
    article: overrides.article ?? {
      id: 'article-1',
      code: 'ART001',
      description: 'Test Article',
      sizeSystem: 'EU',
    },
    status: overrides.status ?? 'draft',
    currency: overrides.currency ?? 'USD',
    totalQuantity: overrides.totalQuantity ?? 100,
    deliveryDate: overrides.deliveryDate ?? '2026-12-31',
    sampleApproved: overrides.sampleApproved ?? false,
    nextAllowedStates: overrides.nextAllowedStates ?? ['confirmed', 'cancelled'],
    orderLines: overrides.orderLines ?? [],
    milestones: overrides.milestones ?? [],
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  }
}

function makeBuyer(overrides: Partial<BuyerDto> = {}): BuyerDto {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? 'Test Buyer',
    currency: overrides.currency ?? 'USD',
    paymentTerms: overrides.paymentTerms ?? 'LC_SIGHT',
    creditLimit: overrides.creditLimit ?? 100000,
    country: overrides.country ?? 'Bangladesh',
    code: overrides.code,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  }
}

function makeArticle(overrides: Partial<ArticleDto> = {}): ArticleDto {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    code: overrides.code ?? 'ART001',
    description: overrides.description ?? 'Test Article',
    category: overrides.category ?? 'men',
    season: overrides.season,
    sizeSystem: overrides.sizeSystem ?? 'EU',
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  }
}

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
  if (order.status === 'confirmed' && !order.sampleApproved) {
    return base.filter((s) => s !== 'in_production')
  }
  return base
}

export const ordersHandlers = [
  http.get(`${BASE}/orders`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)
    const status = url.searchParams.get('status')?.split(',')
    const buyerId = url.searchParams.get('buyerId')
    const dateFrom = url.searchParams.get('deliveryDateFrom')
    const dateTo = url.searchParams.get('deliveryDateTo')

    let filtered = [...orders]

    if (status && status.length > 0) {
      filtered = filtered.filter((o) => status.includes(o.status))
    }
    if (buyerId) {
      filtered = filtered.filter((o) => o.buyerId === buyerId)
    }
    if (dateFrom) {
      filtered = filtered.filter((o) => o.deliveryDate >= dateFrom)
    }
    if (dateTo) {
      filtered = filtered.filter((o) => o.deliveryDate <= dateTo)
    }

    const total = filtered.length
    const start = (page - 1) * limit
    const paged = filtered.slice(start, start + limit).map((o) => ({
      ...o,
      nextAllowedStates: computeNextAllowed(o),
      orderLines: undefined,
      milestones: undefined,
    }))

    const resp: ApiResponse<OrderResponseDto[]> = {
      data: paged,
      meta: { page, limit, total },
    }
    return HttpResponse.json(resp)
  }),

  http.post(`${BASE}/orders`, async ({ request }) => {
    const body = (await request.json()) as CreateOrderDto
    const now = new Date().toISOString()
    const order = makeOrder({
      buyerId: body.buyerId,
      articleId: body.articleId,
      currency: body.currency,
      totalQuantity: body.totalQuantity,
      deliveryDate: body.deliveryDate,
      status: 'draft',
      orderLines:
        body.orderLines?.map((l) => ({
          id: crypto.randomUUID(),
          orderId: '',
          sizeLabel: l.sizeLabel,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
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
    const resp: ApiResponse<OrderResponseDto> = {
      data: { ...order, nextAllowedStates: computeNextAllowed(order) },
    }
    return HttpResponse.json(resp)
  }),

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

    if (
      order.status === 'confirmed' &&
      body.toStatus === 'in_production' &&
      !order.sampleApproved
    ) {
      return HttpResponse.json(
        {
          detail:
            'Sample approval is required before moving to production. Please approve the PP sample first.',
          status: 422,
          errors: { sampleApproved: ['Sample must be approved before production'] },
        },
        { status: 422 }
      )
    }

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

    const resp: ApiResponse<OrderResponseDto> = {
      data: { ...order, nextAllowedStates: computeNextAllowed(order) },
    }
    return HttpResponse.json(resp)
  }),

  http.get(`${BASE}/buyers`, ({ request }) => {
    const url = new URL(request.url)
    const dropdown = url.searchParams.get('dropdown') === 'true'
    const search = url.searchParams.get('search')?.toLowerCase()
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

    let filtered = buyers.filter((b) => b.isActive !== false)

    if (search) {
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(search) || (b.code?.toLowerCase().includes(search) ?? false)
      )
    }

    if (dropdown) {
      const dropdownData: BuyerDropdownDto[] = filtered.map((b) => ({
        id: b.id,
        code: b.code,
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

  http.get(`${BASE}/buyers/:id`, ({ params }) => {
    const buyer = buyers.find((b) => b.id === params.id)
    if (!buyer) {
      return HttpResponse.json({ detail: 'Buyer not found', status: 404 }, { status: 404 })
    }
    return HttpResponse.json({ data: buyer })
  }),

  http.post(`${BASE}/buyers`, async ({ request }) => {
    const body = (await request.json()) as CreateBuyerDto
    const buyer = makeBuyer(body)
    buyers.unshift(buyer)
    return HttpResponse.json({ data: buyer }, { status: 201 })
  }),

  http.patch(`${BASE}/buyers/:id`, async ({ params, request }) => {
    const buyer = buyers.find((b) => b.id === params.id)
    if (!buyer) {
      return HttpResponse.json({ detail: 'Buyer not found', status: 404 }, { status: 404 })
    }
    const body = (await request.json()) as Partial<BuyerDto>
    Object.assign(buyer, body, { updatedAt: new Date().toISOString() })
    return HttpResponse.json({ data: buyer })
  }),

  http.delete(`${BASE}/buyers/:id`, ({ params }) => {
    const buyer = buyers.find((b) => b.id === params.id)
    if (!buyer) {
      return HttpResponse.json({ detail: 'Buyer not found', status: 404 }, { status: 404 })
    }
    buyer.isActive = false
    buyer.updatedAt = new Date().toISOString()
    return HttpResponse.json({ data: buyer })
  }),

  http.get(`${BASE}/articles`, ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')?.toLowerCase()
    const category = url.searchParams.get('category')
    const season = url.searchParams.get('season')
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

    let filtered = articles.filter((a) => a.isActive !== false)

    if (search) {
      filtered = filtered.filter(
        (a) => a.description.toLowerCase().includes(search) || a.code.toLowerCase().includes(search)
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

  http.get(`${BASE}/articles/:id`, ({ params }) => {
    const article = articles.find((a) => a.id === params.id)
    if (!article) {
      return HttpResponse.json({ detail: 'Article not found', status: 404 }, { status: 404 })
    }
    return HttpResponse.json({ data: article })
  }),

  http.post(`${BASE}/articles`, async ({ request }) => {
    const body = (await request.json()) as CreateArticleDto
    const article = makeArticle(body)
    articles.unshift(article)
    return HttpResponse.json({ data: article }, { status: 201 })
  }),

  http.patch(`${BASE}/articles/:id`, async ({ params, request }) => {
    const article = articles.find((a) => a.id === params.id)
    if (!article) {
      return HttpResponse.json({ detail: 'Article not found', status: 404 }, { status: 404 })
    }
    const body = (await request.json()) as Partial<ArticleDto>
    Object.assign(article, body, { updatedAt: new Date().toISOString() })
    return HttpResponse.json({ data: article })
  }),

  http.delete(`${BASE}/articles/:id`, ({ params }) => {
    const article = articles.find((a) => a.id === params.id)
    if (!article) {
      return HttpResponse.json({ detail: 'Article not found', status: 404 }, { status: 404 })
    }
    article.isActive = false
    article.updatedAt = new Date().toISOString()
    return HttpResponse.json({ data: article })
  }),

  http.post(`${BASE}/orders/:orderId/quotations`, async ({ params, request }) => {
    const body = (await request.json()) as CreateQuotationDto
    const orderId = params.orderId as string
    const quotation: QuotationDto = {
      id: crypto.randomUUID(),
      quotationNumber: `QT-${String(Date.now()).slice(-6)}`,
      orderId,
      buyerId: orders.find((o) => o.id === orderId)?.buyerId,
      articleId: orders.find((o) => o.id === orderId)?.articleId,
      version: 1,
      currency: body.currency,
      quotedPrice: body.quotedPrice,
      winProbability: body.winProbability ?? null,
      status: 'draft',
      sentAt: null,
      outcomeReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    quotations.push(quotation)
    return HttpResponse.json({ data: quotation }, { status: 201 })
  }),

  http.get(`${BASE}/orders/:orderId/quotations`, ({ params }) => {
    const list = quotations.filter((q) => q.orderId === params.orderId)
    return HttpResponse.json({ data: list })
  }),

  http.post(`${BASE}/orders/:orderId/quotations/:id/send`, ({ params }) => {
    const quotation = quotations.find((q) => q.id === params.id)
    if (quotation) {
      quotation.status = 'sent'
      quotation.sentAt = new Date().toISOString()
      quotation.updatedAt = new Date().toISOString()
    }
    return HttpResponse.json({ data: quotation ?? { status: 'sent' } })
  }),

  http.post(`${BASE}/orders/:orderId/quotations/:id/close`, async ({ params, request }) => {
    const body = (await request.json()) as { outcome: string; outcomeReason: string }
    if (body.outcome === 'won') {
      return HttpResponse.json(
        { detail: 'Another quotation has already been marked as won for this order.' },
        { status: 409 }
      )
    }
    const quotation = quotations.find((q) => q.id === params.id)
    if (quotation) {
      quotation.status = 'lost'
      quotation.outcomeReason = body.outcomeReason
      quotation.updatedAt = new Date().toISOString()
    }
    return HttpResponse.json({ data: quotation ?? { status: 'lost' } })
  }),

  http.post(`${BASE}/orders/:orderId/quotations/:id/populate-from-bom`, () => {
    return HttpResponse.json(
      {
        statusCode: 501,
        message: 'Not Implemented',
        detail:
          'BOM cost auto-population is not yet available. This endpoint will be enabled once the Manufacturing/BOM module is complete.',
      },
      { status: 501 }
    )
  }),

  http.post(`${BASE}/orders/:orderId/samples`, async ({ params, request }) => {
    const body = (await request.json()) as CreateSampleDto
    const orderId = params.orderId as string
    const existingForOrder = samples.filter((s) => s.orderId === orderId)
    const nextRound =
      body.roundNumber ??
      (existingForOrder.length > 0
        ? Math.max(...existingForOrder.map((s) => s.roundNumber ?? 0)) + 1
        : 1)
    const sample: SampleDto = {
      id: crypto.randomUUID(),
      orderId,
      roundNumber: nextRound,
      sampleType: body.sampleType,
      dispatchDate: body.dispatchDate ?? null,
      receivedDate: body.receivedDate ?? null,
      approvalStatus: 'pending',
      remarks: body.remarks ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    samples.push(sample)
    return HttpResponse.json({ data: sample }, { status: 201 })
  }),

  http.get(`${BASE}/orders/:orderId/samples`, ({ params }) => {
    const list = samples.filter((s) => s.orderId === params.orderId)
    return HttpResponse.json({ data: list })
  }),

  http.post(`${BASE}/orders/:orderId/samples/:id/approve`, ({ params }) => {
    const order = orders.find((o) => o.id === params.orderId)
    if (order) order.sampleApproved = true
    const sample = samples.find((s) => s.id === params.id)
    if (sample) {
      sample.approvalStatus = 'approved'
      sample.updatedAt = new Date().toISOString()
    }
    return HttpResponse.json({ data: sample ?? { approvalStatus: 'approved' } })
  }),

  http.post(`${BASE}/orders/:orderId/samples/:id/reject`, async ({ params, request }) => {
    const body = (await request.json()) as { remarks: string }
    if (!body.remarks) {
      return HttpResponse.json({ detail: 'remarks is required', status: 422 }, { status: 422 })
    }
    const sample = samples.find((s) => s.id === params.id)
    if (sample) {
      sample.approvalStatus = 'rejected'
      sample.remarks = body.remarks
      sample.updatedAt = new Date().toISOString()
    }
    return HttpResponse.json({
      data: sample ?? { approvalStatus: 'rejected', remarks: body.remarks },
    })
  }),

  http.post(`${BASE}/orders/:orderId/complaints`, async ({ params, request }) => {
    const body = (await request.json()) as CreateComplaintDto
    const orderId = params.orderId as string
    const complaint: ComplaintDto = {
      id: crypto.randomUUID(),
      complaintNo: `CMP-${String(Date.now()).slice(-6)}`,
      orderId,
      complaintDate: new Date().toISOString().split('T')[0]!,
      type: body.type,
      severity: body.severity,
      description: body.description,
      status: 'open',
      rootCause: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return HttpResponse.json({ data: complaint }, { status: 201 })
  }),

  http.get(`${BASE}/orders/:orderId/complaints`, () => {
    return HttpResponse.json({ data: [] })
  }),

  http.patch(`${BASE}/orders/:orderId/complaints/:id/root-cause`, async ({ request }) => {
    const body = (await request.json()) as { rootCause: string }
    return HttpResponse.json({ data: { rootCause: body.rootCause } })
  }),

  http.post(`${BASE}/orders/:orderId/complaints/:complaintId/capa`, async ({ params, request }) => {
    const body = (await request.json()) as CreateCapaDto
    const complaintId = params.complaintId as string
    const capa: CapaActionDto = {
      id: crypto.randomUUID(),
      complaintId,
      description: body.description,
      ownerId: body.ownerId,
      dueDate: body.dueDate,
      status: 'open',
      closedAt: null,
      createdAt: new Date().toISOString(),
    }
    return HttpResponse.json({ data: capa }, { status: 201 })
  }),

  http.get(`${BASE}/orders/:orderId/complaints/:complaintId/capa`, () => {
    return HttpResponse.json({ data: [] })
  }),

  http.patch(
    `${BASE}/orders/:orderId/complaints/:complaintId/capa/:capaId/status`,
    async ({ request }) => {
      const body = (await request.json()) as { status: string }
      return HttpResponse.json({ data: { status: body.status } })
    }
  ),
]
