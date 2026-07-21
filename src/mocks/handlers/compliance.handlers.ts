import { http, HttpResponse, type HttpHandler } from 'msw'

const BASE_URL = import.meta.env.VITE_API_URL

type ComplianceStatus = 'valid' | 'expiring_soon' | 'expired' | 'renewed'

interface MockComplianceItem {
  id: string
  name: string
  category: string
  expiryDate: string
  responsibleUserId: string
  responsibleUser: string
  alertDays: number
  documentUrl: string | null
  status: ComplianceStatus
  createdAt: string
  updatedAt: string
}

const now = new Date()
const daysFromNow = (d: number) => {
  const dt = new Date(now)
  dt.setDate(dt.getDate() + d)
  return dt.toISOString().substring(0, 10)
}

const MOCK_COMPLIANCE: MockComplianceItem[] = [
  {
    id: 'comp-1',
    name: 'Fire Safety Certificate',
    category: 'certification',
    expiryDate: daysFromNow(-10), // expired
    responsibleUserId: 'user-1',
    responsibleUser: 'Super Admin',
    alertDays: 30,
    documentUrl: 'https://example.com/fire-cert.pdf',
    status: 'expired',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'comp-2',
    name: 'ISO 9001 Audit',
    category: 'audit',
    expiryDate: daysFromNow(5), // within alert (5 days ≤ 14)
    responsibleUserId: 'user-2',
    responsibleUser: 'John Doe',
    alertDays: 14,
    documentUrl: null,
    status: 'expiring_soon',
    createdAt: '2025-03-15T00:00:00Z',
    updatedAt: '2025-03-15T00:00:00Z',
  },
  {
    id: 'comp-3',
    name: 'Environmental Permit',
    category: 'license',
    expiryDate: daysFromNow(60), // safe
    responsibleUserId: 'user-1',
    responsibleUser: 'Super Admin',
    alertDays: 30,
    documentUrl: 'https://example.com/env-permit.pdf',
    status: 'valid',
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
  },
  {
    id: 'comp-4',
    name: 'Data Privacy Policy',
    category: 'policy',
    expiryDate: daysFromNow(90),
    responsibleUserId: 'user-3',
    responsibleUser: 'Jane Smith',
    alertDays: 60,
    documentUrl: null,
    status: 'valid',
    createdAt: '2025-02-10T00:00:00Z',
    updatedAt: '2025-02-10T00:00:00Z',
  },
  {
    id: 'comp-5',
    name: 'Building Safety Inspection',
    category: 'certification',
    expiryDate: daysFromNow(-2), // expired
    responsibleUserId: 'user-2',
    responsibleUser: 'John Doe',
    alertDays: 20,
    documentUrl: null,
    status: 'expired',
    createdAt: '2025-04-20T00:00:00Z',
    updatedAt: '2025-04-20T00:00:00Z',
  },
  {
    id: 'comp-6',
    name: 'Export License Renewal',
    category: 'license',
    expiryDate: daysFromNow(3), // within alert
    responsibleUserId: 'user-1',
    responsibleUser: 'Super Admin',
    alertDays: 7,
    documentUrl: 'https://example.com/export.pdf',
    status: 'renewed',
    createdAt: '2025-05-10T00:00:00Z',
    updatedAt: '2025-07-18T00:00:00Z',
  },
]

export const complianceHandlers: HttpHandler[] = [
  // GET /compliance-items
  http.get(`${BASE_URL}/compliance-items`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')

    let filtered = [...MOCK_COMPLIANCE]
    if (status) {
      filtered = filtered.filter((c) => c.status === status)
    }

    return HttpResponse.json({
      data: {
        data: filtered,
        meta: { page: 1, limit: 100, totalItems: filtered.length },
      },
    })
  }),

  // POST /compliance-items
  http.post(`${BASE_URL}/compliance-items`, async ({ request }) => {
    const body = (await request.json()) as {
      name: string
      category: string
      expiryDate: string
      responsibleUserId: string
      alertDays: number
      documentUrl?: string
    }
    const newItem: MockComplianceItem = {
      id: `comp-${Date.now()}`,
      name: body.name,
      category: body.category,
      expiryDate: body.expiryDate,
      responsibleUserId: body.responsibleUserId,
      responsibleUser:
        body.responsibleUserId === 'user-1'
          ? 'Super Admin'
          : body.responsibleUserId === 'user-2'
            ? 'John Doe'
            : 'Jane Smith',
      alertDays: body.alertDays,
      documentUrl: body.documentUrl ?? null,
      status: 'valid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    MOCK_COMPLIANCE.push(newItem)
    return HttpResponse.json({ data: newItem }, { status: 201 })
  }),

  // PATCH /compliance-items/:id
  http.patch(`${BASE_URL}/compliance-items/:id`, async ({ request, params }) => {
    const body = (await request.json()) as {
      name?: string
      category?: string
      expiryDate?: string
      responsibleUserId?: string
      alertDays?: number
      documentUrl?: string
    }
    const item = MOCK_COMPLIANCE.find((c) => c.id === params.id)
    if (!item) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })

    if (body.name !== undefined) item.name = body.name
    if (body.category !== undefined) item.category = body.category
    if (body.expiryDate !== undefined) item.expiryDate = body.expiryDate
    if (body.responsibleUserId !== undefined) item.responsibleUserId = body.responsibleUserId
    if (body.alertDays !== undefined) item.alertDays = body.alertDays
    if (body.documentUrl !== undefined) item.documentUrl = body.documentUrl
    item.updatedAt = new Date().toISOString()

    return HttpResponse.json({ data: item })
  }),

  // DELETE /compliance-items/:id
  http.delete(`${BASE_URL}/compliance-items/:id`, ({ params }) => {
    const idx = MOCK_COMPLIANCE.findIndex((c) => c.id === params.id)
    if (idx === -1) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    MOCK_COMPLIANCE.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]
