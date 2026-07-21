import { http, HttpResponse, type HttpHandler } from 'msw'

const BASE_URL = import.meta.env.VITE_API_URL

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT'

interface MockAuditLog {
  id: string
  createdAt: string
  changedBy: string | null
  action: AuditAction
  tableName: string
  recordId: string
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
}

const MOCK_AUDIT_LOGS: MockAuditLog[] = [
  {
    id: 'audit-1',
    createdAt: '2026-07-19T10:30:00Z',
    changedBy: 'user-1',
    action: 'UPDATE',
    tableName: 'ord_orders',
    recordId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    oldValue: { status: 'pending', quantity: 10, price: '250.00' },
    newValue: { status: 'confirmed', quantity: 10, price: '250.00' },
  },
  {
    id: 'audit-2',
    createdAt: '2026-07-19T09:15:00Z',
    changedBy: 'user-2',
    action: 'INSERT',
    tableName: 'sys_users',
    recordId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    oldValue: null,
    newValue: {
      email: 'newuser@okfootwear.com',
      fullName: 'New User',
      status: 'active',
      role: 'orders_manager',
    },
  },
  {
    id: 'audit-3',
    createdAt: '2026-07-18T16:45:00Z',
    changedBy: 'user-1',
    action: 'DELETE',
    tableName: 'fin_gl_entries',
    recordId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    oldValue: { amount: '500.00', account: '4010', description: 'Misc expense' },
    newValue: null,
  },
  {
    id: 'audit-4',
    createdAt: '2026-07-18T14:20:00Z',
    changedBy: 'user-3',
    action: 'SELECT',
    tableName: 'hr_employees',
    recordId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    oldValue: null,
    newValue: null,
  },
  {
    id: 'audit-5',
    createdAt: '2026-07-18T11:00:00Z',
    changedBy: 'user-1',
    action: 'UPDATE',
    tableName: 'prc_purchase_orders',
    recordId: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    oldValue: { status: 'draft', vendorId: 'v1', total: '1200.00' },
    newValue: { status: 'issued', vendorId: 'v1', total: '1200.00', approvedBy: 'admin' },
  },
  {
    id: 'audit-6',
    createdAt: '2026-07-17T08:00:00Z',
    changedBy: 'user-2',
    action: 'INSERT',
    tableName: 'ord_orders',
    recordId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    oldValue: null,
    newValue: {
      buyerId: 'buyer-1',
      articleId: 'art-42',
      quantity: 5000,
      price: '3.50',
      deliveryDate: '2026-08-15',
      nested: { level1: { level2: 'deep_value' } },
    },
  },
  {
    id: 'audit-7',
    createdAt: '2026-07-17T07:30:00Z',
    changedBy: 'user-1',
    action: 'UPDATE',
    tableName: 'sys_roles',
    recordId: 'a7b8c9d0-e1f2-3456-abcd-567890123456',
    oldValue: { name: 'finance_viewer', description: 'Finance read-only' },
    newValue: { name: 'finance_viewer', description: 'Finance viewer (updated)' },
  },
  // More logs for pagination testing
  ...Array.from({ length: 25 }, (_, i) => ({
    id: `audit-bulk-${i + 8}`,
    createdAt: new Date(Date.now() - i * 3600000).toISOString(),
    changedBy: i % 2 === 0 ? 'user-1' : 'user-2',
    action: (['INSERT', 'UPDATE', 'DELETE', 'SELECT'] as AuditAction[])[i % 4]!,
    tableName: ['ord_orders', 'prc_purchase_orders', 'fin_gl_entries', 'hr_employees'][i % 4]!,
    recordId: `bulk-record-${i + 8}`,
    oldValue: i % 4 === 0 ? null : { data: `old-${i}` },
    newValue: i % 4 === 2 ? null : { data: `new-${i}` },
  })),
]

export const auditHandlers: HttpHandler[] = [
  // GET /audit-logs — list with filters & pagination
  http.get(`${BASE_URL}/audit-logs`, ({ request }) => {
    const url = new URL(request.url)

    // CSV export
    if (url.searchParams.get('format') === 'csv') {
      const csvContent =
        'id,createdAt,changedBy,action,tableName,recordId\n' +
        MOCK_AUDIT_LOGS.slice(0, 5)
          .map((log) =>
            [log.id, log.createdAt, log.changedBy, log.action, log.tableName, log.recordId].join(
              ','
            )
          )
          .join('\n')
      return new HttpResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="audit-logs.csv"',
        },
      })
    }

    // Filters
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const modules = url.searchParams.get('modules')?.split(',').filter(Boolean) ?? []
    const actions = url.searchParams.get('actions')?.split(',').filter(Boolean) ?? []
    const userId = url.searchParams.get('userId')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '20')

    let filtered = [...MOCK_AUDIT_LOGS]

    if (startDate) {
      filtered = filtered.filter((l) => l.createdAt >= `${startDate}T00:00:00Z`)
    }
    if (endDate) {
      filtered = filtered.filter((l) => l.createdAt <= `${endDate}T23:59:59Z`)
    }
    if (modules.length > 0) {
      filtered = filtered.filter((l) => {
        const schema = l.tableName.split('_')[0] ?? 'unknown'
        return modules.includes(schema)
      })
    }
    if (actions.length > 0) {
      filtered = filtered.filter((l) => actions.includes(l.action))
    }
    if (userId) {
      filtered = filtered.filter((l) => l.changedBy === userId)
    }

    const start = (page - 1) * limit
    const paginated = filtered.slice(start, start + limit)

    return HttpResponse.json({
      data: paginated,
      meta: { page, limit, totalItems: filtered.length },
    })
  }),
]
