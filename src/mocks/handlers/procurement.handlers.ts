// ── Procurement MSW Handlers ─────────────────────────────────────────────────
import { http, HttpResponse, type HttpHandler } from 'msw'

import type {
  CreateGoodsReceiptDto,
  CreatePurchaseOrderDto,
  CreateVendorDto,
  CreateVendorInvoiceDto,
  GoodsReceiptDto,
  PoLineDto,
  PurchaseOrderDto,
  StockItemDto,
  VendorDto,
  VendorInvoiceDto,
  VendorStatus,
} from '@/types/procurement'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:7100/api/v1'

let vendors: VendorDto[] = [
  {
    id: 'vendor-1',
    vendorCode: 'VND-001',
    name: 'Leather Supply Co.',
    type: 'raw_material',
    categoryId: 'cat-1',
    status: 'approved',
    rating: 4.2,
    paymentTerms: 30,
    creditLimit: 500000,
    tradeLicense: 'TL-12345',
    tinNumber: 'TIN-998877',
    email: 'sales@leather.example',
    contactName: 'Rahim',
    phone: '+8801700000001',
    address: 'Dhaka',
    bankName: 'DBBL',
    bankAccount: '1234567890',
    notes: 'Preferred leather supplier',
  },
  {
    id: 'vendor-2',
    vendorCode: 'VND-002',
    name: 'Under Review Sole Ltd',
    type: 'sole',
    categoryId: 'cat-1',
    status: 'under_review',
    rating: null,
    paymentTerms: 45,
    creditLimit: 0,
    contactName: 'Karim',
    email: 'info@sole.example',
    phone: '+8801700000002',
    address: 'Chittagong',
    tradeLicense: 'TL-200',
    tinNumber: 'TIN-200',
    bankName: 'BRAC Bank',
    bankAccount: '99887766',
    notes: 'Pending compliance review',
  },
]

let purchaseOrders: PurchaseOrderDto[] = []
let goodsReceipts: GoodsReceiptDto[] = []
let invoices: VendorInvoiceDto[] = []
let vendorCategories = [
  { id: 'cat-1', name: 'Raw Materials', code: 'RM' },
  { id: 'cat-2', name: 'Packaging', code: 'PKG' },
]
let poCounter = 1
let grnCounter = 1

const stockItems: StockItemDto[] = [
  { id: 'item-1', code: 'RM-LEATHER-BLK', name: 'Black cow leather', uom: 'SQFT' },
  { id: 'item-2', code: 'RM-SOLE-EVA', name: 'EVA sole unit', uom: 'PCS' },
  { id: 'item-3', code: 'PKG-BOX-M', name: 'Medium shoe box', uom: 'PCS' },
]

export function resetProcurementStore(): void {
  vendors = vendors.slice(0, 2)
  purchaseOrders = []
  goodsReceipts = []
  invoices = []
  vendorCategories = [
    { id: 'cat-1', name: 'Raw Materials', code: 'RM' },
    { id: 'cat-2', name: 'Packaging', code: 'PKG' },
  ]
  poCounter = 1
  grnCounter = 1
}

export const procurementHandlers: HttpHandler[] = [
  http.get(`${BASE}/procurement/vendors`, ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')?.toLowerCase() ?? ''
    const status = url.searchParams.get('status') as VendorStatus | null
    const dropdown = url.searchParams.get('dropdown') === 'true'
    let filtered = [...vendors]
    if (search) {
      filtered = filtered.filter(
        (v) => v.name.toLowerCase().includes(search) || v.vendorCode.toLowerCase().includes(search)
      )
    }
    if (status) filtered = filtered.filter((v) => v.status === status)
    if (dropdown) {
      filtered = filtered.filter((v) => v.status === 'approved')
      return HttpResponse.json({
        data: filtered.map((v) => ({
          id: v.id,
          vendorCode: v.vendorCode,
          name: v.name,
          status: v.status,
        })),
        meta: { page: 1, limit: filtered.length, total: filtered.length },
      })
    }
    return HttpResponse.json({
      data: filtered,
      meta: { page: 1, limit: 20, total: filtered.length },
    })
  }),

  http.post(`${BASE}/procurement/vendors`, async ({ request }) => {
    const body = (await request.json()) as CreateVendorDto
    const vendor: VendorDto = {
      id: crypto.randomUUID(),
      vendorCode: body.vendorCode,
      name: body.name,
      type: body.type,
      categoryId: body.categoryId,
      status: body.status ?? 'under_review',
      contactName: body.contactName,
      email: body.email,
      phone: body.phone,
      address: body.address,
      tradeLicense: body.tradeLicense,
      tinNumber: body.tinNumber,
      bankName: body.bankName,
      bankAccount: body.bankAccount,
      paymentTerms: body.paymentTerms ?? 30,
      creditLimit: body.creditLimit ?? 0,
      notes: body.notes,
      rating: null,
      createdAt: new Date().toISOString(),
    }
    vendors.push(vendor)
    return HttpResponse.json({ data: vendor }, { status: 201 })
  }),

  http.get(`${BASE}/procurement/vendors/:id`, ({ params }) => {
    const vendor = vendors.find((v) => v.id === params.id)
    if (!vendor) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json({ data: vendor })
  }),

  http.patch(`${BASE}/procurement/vendors/:id`, async ({ params, request }) => {
    const idx = vendors.findIndex((v) => v.id === params.id)
    if (idx < 0) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const body = (await request.json()) as Partial<CreateVendorDto>
    vendors[idx] = { ...vendors[idx]!, ...body }
    return HttpResponse.json({ data: vendors[idx] })
  }),

  http.get(`${BASE}/procurement/vendor-categories`, () => {
    return HttpResponse.json({
      data: vendorCategories,
      meta: { page: 1, limit: 50, total: vendorCategories.length },
    })
  }),

  http.post(`${BASE}/procurement/vendor-categories`, async ({ request }) => {
    const body = (await request.json()) as { name: string; code: string }
    const exists = vendorCategories.some((c) => c.code.toLowerCase() === body.code.toLowerCase())
    if (exists) {
      return HttpResponse.json({ detail: 'Category code already exists' }, { status: 409 })
    }
    const category = {
      id: crypto.randomUUID(),
      name: body.name,
      code: body.code,
    }
    vendorCategories.push(category)
    return HttpResponse.json({ data: category }, { status: 201 })
  }),

  http.patch(`${BASE}/procurement/vendor-categories/:id`, async ({ params, request }) => {
    const idx = vendorCategories.findIndex((c) => c.id === params.id)
    if (idx < 0) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const body = (await request.json()) as { name?: string; code?: string }
    if (body.code) {
      const clash = vendorCategories.some(
        (c, i) => i !== idx && c.code.toLowerCase() === body.code!.toLowerCase()
      )
      if (clash) {
        return HttpResponse.json({ detail: 'Category code already exists' }, { status: 409 })
      }
    }
    vendorCategories[idx] = {
      ...vendorCategories[idx]!,
      ...(body.name != null ? { name: body.name } : {}),
      ...(body.code != null ? { code: body.code } : {}),
    }
    return HttpResponse.json({ data: vendorCategories[idx] })
  }),

  http.delete(`${BASE}/procurement/vendor-categories/:id`, ({ params }) => {
    const idx = vendorCategories.findIndex((c) => c.id === params.id)
    if (idx < 0) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const inUse = vendors.some((v) => v.categoryId === params.id)
    if (inUse) {
      return HttpResponse.json(
        { detail: 'Cannot delete category while vendors are assigned to it.' },
        { status: 409 }
      )
    }
    vendorCategories.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${BASE}/procurement/purchase-orders`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const vendorId = url.searchParams.get('vendorId')
    let filtered = [...purchaseOrders]
    if (status) filtered = filtered.filter((p) => p.status === status)
    if (vendorId) filtered = filtered.filter((p) => p.vendorId === vendorId)
    return HttpResponse.json({
      data: filtered,
      meta: { page: 1, limit: 50, total: filtered.length },
    })
  }),

  http.post(`${BASE}/procurement/purchase-orders`, async ({ request }) => {
    const body = (await request.json()) as CreatePurchaseOrderDto
    const vendor = vendors.find((v) => v.id === body.vendorId)
    if (vendor?.status === 'blacklisted') {
      return HttpResponse.json({ detail: 'Vendor is blacklisted' }, { status: 422 })
    }
    const lines: PoLineDto[] = body.lines.map((l) => {
      const item = stockItems.find((i) => i.id === l.itemId)
      return {
        id: crypto.randomUUID(),
        ...l,
        itemCode: item?.code,
        itemName: item?.name,
        receivedQty: 0,
      }
    })
    const totalAmount = lines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0)
    const po: PurchaseOrderDto = {
      id: crypto.randomUUID(),
      poNumber: `PO-2026-${String(poCounter++).padStart(6, '0')}`,
      vendorId: body.vendorId,
      vendor: vendor
        ? { id: vendor.id, name: vendor.name, vendorCode: vendor.vendorCode, status: vendor.status }
        : null,
      status: 'draft',
      currency: body.currency,
      totalAmount,
      deliveryDate: body.deliveryDate,
      notes: body.notes,
      lines,
      createdAt: new Date().toISOString(),
    }
    purchaseOrders.push(po)
    return HttpResponse.json({ data: po }, { status: 201 })
  }),

  http.get(`${BASE}/procurement/purchase-orders/:id`, ({ params }) => {
    const po = purchaseOrders.find((p) => p.id === params.id)
    if (!po) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json({ data: po })
  }),

  http.post(`${BASE}/procurement/purchase-orders/:id/submit`, ({ params }) => {
    const po = purchaseOrders.find((p) => p.id === params.id)
    if (!po) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    po.status = 'pending_approval'
    return HttpResponse.json({ data: po })
  }),

  http.post(`${BASE}/procurement/purchase-orders/:id/approve`, ({ params }) => {
    const po = purchaseOrders.find((p) => p.id === params.id)
    if (!po) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    po.status = 'approved'
    po.approvedAt = new Date().toISOString()
    po.approvedByName = 'Approver User'
    return HttpResponse.json({ data: po })
  }),

  http.post(`${BASE}/procurement/purchase-orders/:id/reject`, async ({ params, request }) => {
    const po = purchaseOrders.find((p) => p.id === params.id)
    if (!po) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const body = (await request.json()) as { reason: string }
    po.status = 'cancelled'
    po.rejectedReason = body.reason
    return HttpResponse.json({ data: po })
  }),

  http.post(`${BASE}/procurement/goods-receipts`, async ({ request }) => {
    const body = (await request.json()) as CreateGoodsReceiptDto
    const grn: GoodsReceiptDto = {
      id: crypto.randomUUID(),
      grnNumber: `GRN-2026-${String(grnCounter++).padStart(6, '0')}`,
      poId: body.poId,
      receiptDate: body.receiptDate ?? new Date().toISOString().slice(0, 10),
      status: 'draft',
      vehicleNo: body.vehicleNo,
      notes: body.notes,
      lines: body.lines.map((l) => ({ id: crypto.randomUUID(), ...l })),
    }
    goodsReceipts.push(grn)
    return HttpResponse.json({ data: grn }, { status: 201 })
  }),

  http.get(`${BASE}/procurement/goods-receipts/by-po/:poId`, ({ params }) => {
    const list = goodsReceipts.filter((g) => g.poId === params.poId)
    return HttpResponse.json({ data: list })
  }),

  http.get(`${BASE}/procurement/goods-receipts/:id`, ({ params }) => {
    const grn = goodsReceipts.find((g) => g.id === params.id)
    if (!grn) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json({ data: grn })
  }),

  http.patch(
    `${BASE}/procurement/goods-receipts/:id/lines/:lineId`,
    async ({ params, request }) => {
      const grn = goodsReceipts.find((g) => g.id === params.id)
      if (!grn) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
      const body = (await request.json()) as Record<string, unknown>
      const line = grn.lines?.find((l) => l.id === params.lineId)
      if (!line) return HttpResponse.json({ detail: 'Line not found' }, { status: 404 })
      Object.assign(line, body)
      return HttpResponse.json({ data: line })
    }
  ),

  http.post(`${BASE}/procurement/goods-receipts/:id/lines/:lineId/photos`, async ({ params }) => {
    const grn = goodsReceipts.find((g) => g.id === params.id)
    const line = grn?.lines?.find((l) => l.id === params.lineId)
    if (!line) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const photo = { id: crypto.randomUUID(), url: 'https://example.com/photo.jpg' }
    line.photos = [...(line.photos ?? []), photo]
    return HttpResponse.json({ data: photo }, { status: 201 })
  }),

  http.post(`${BASE}/procurement/goods-receipts/:id/submit-qc`, ({ params }) => {
    const grn = goodsReceipts.find((g) => g.id === params.id)
    if (!grn) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    grn.status = 'qc_pending'
    return HttpResponse.json({ data: grn })
  }),

  http.get(`${BASE}/procurement/vendor-invoices`, ({ request }) => {
    const url = new URL(request.url)
    const vendorId = url.searchParams.get('vendorId')
    let filtered = [...invoices]
    if (vendorId) filtered = filtered.filter((i) => i.vendorId === vendorId)
    return HttpResponse.json({
      data: filtered,
      meta: { page: 1, limit: 50, total: filtered.length },
    })
  }),

  http.post(`${BASE}/procurement/vendor-invoices`, async ({ request }) => {
    const body = (await request.json()) as CreateVendorInvoiceDto
    const grn = goodsReceipts.find((g) => g.id === body.grnId)
    const po = purchaseOrders.find((p) => p.id === grn?.poId)
    const poAmount = po?.totalAmount ?? 0
    const grnAmount =
      grn?.lines?.reduce((s, l) => s + (l.acceptedQty ?? 0) * (l.unitCost ?? 0), 0) ?? poAmount
    const tolerance = 0.05
    const maxAllowed = poAmount * (1 + tolerance)
    if (body.grossAmount > maxAllowed && poAmount > 0) {
      return HttpResponse.json(
        { detail: 'Invoice amount exceeds three-way match tolerance' },
        { status: 422 }
      )
    }
    const tdsAmount = Math.round(body.grossAmount * 0.05 * 100) / 100
    const inv: VendorInvoiceDto = {
      id: crypto.randomUUID(),
      vendorId: body.vendorId,
      grnId: body.grnId,
      poId: po?.id,
      invoiceNo: body.invoiceNo,
      invoiceDate: body.invoiceDate,
      dueDate: body.dueDate,
      currency: body.currency ?? 'BDT',
      grossAmount: body.grossAmount,
      tdsAmount,
      netPayable: body.grossAmount - tdsAmount,
      paidAmount: 0,
      status: 'pending',
      poAmount,
      grnAmount,
      tolerancePct: 5,
      matchStatus: 'matched',
      createdAt: new Date().toISOString(),
    }
    invoices.push(inv)
    return HttpResponse.json({ data: inv }, { status: 201 })
  }),

  http.get(`${BASE}/procurement/vendor-invoices/:id`, ({ params }) => {
    const inv = invoices.find((i) => i.id === params.id)
    if (!inv) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json({ data: inv })
  }),

  http.get(`${BASE}/inventory/items`, ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')?.toLowerCase() ?? ''
    const filtered = stockItems.filter(
      (i) => i.code.toLowerCase().includes(search) || i.name.toLowerCase().includes(search)
    )
    return HttpResponse.json({
      data: filtered,
      meta: { page: 1, limit: 10, total: filtered.length },
    })
  }),
]
