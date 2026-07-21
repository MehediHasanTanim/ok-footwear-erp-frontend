import { http, HttpResponse, type HttpHandler } from 'msw'

const BASE_URL = import.meta.env.VITE_API_URL

export interface MockUser {
  id: string
  fullName: string
  email: string
  isActive: boolean
  lastLoginAt: string | null
  roles: { id: string; name: string }[]
}

export const MOCK_USERS: MockUser[] = [
  {
    id: 'user-1',
    fullName: 'Super Admin',
    email: 'admin@okfootwear.com',
    isActive: true,
    lastLoginAt: new Date().toISOString(),
    roles: [{ id: 'role-1', name: 'super_admin' }],
  },
  {
    id: 'user-2',
    fullName: 'John Doe',
    email: 'john@okfootwear.com',
    isActive: true,
    lastLoginAt: new Date(Date.now() - 86400000).toISOString(),
    roles: [{ id: 'role-2', name: 'orders_manager' }],
  },
  {
    id: 'user-3',
    fullName: 'Jane Smith',
    email: 'jane@okfootwear.com',
    isActive: false,
    lastLoginAt: null,
    roles: [],
  },
]

export const MOCK_ROLES = [
  { id: 'role-1', name: 'super_admin', description: 'Full system access' },
  { id: 'role-2', name: 'orders_manager', description: 'Orders management' },
  { id: 'role-3', name: 'finance_viewer', description: 'Finance read-only' },
]

export const MOCK_ROLES_WITH_PERMS: Array<{
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: Array<{ id: string; module: string; action: string; description: string }>
}> = [
  {
    id: MOCK_ROLES[0]!.id,
    name: MOCK_ROLES[0]!.name,
    description: MOCK_ROLES[0]!.description,
    isSystem: true,
    permissions: [
      { id: 'perm-1', module: 'orders', action: 'read', description: 'View orders' },
      { id: 'perm-2', module: 'orders', action: 'write', description: 'Create/update orders' },
      { id: 'perm-3', module: 'system', action: 'read', description: 'View system settings' },
    ],
  },
  {
    id: MOCK_ROLES[1]!.id,
    name: MOCK_ROLES[1]!.name,
    description: MOCK_ROLES[1]!.description,
    isSystem: false,
    permissions: [
      { id: 'perm-1', module: 'orders', action: 'read', description: 'View orders' },
      { id: 'perm-2', module: 'orders', action: 'write', description: 'Create/update orders' },
    ],
  },
  {
    id: MOCK_ROLES[2]!.id,
    name: MOCK_ROLES[2]!.name,
    description: MOCK_ROLES[2]!.description,
    isSystem: false,
    permissions: [
      { id: 'perm-4', module: 'finance', action: 'read', description: 'View finance data' },
    ],
  },
]

export const usersHandlers: HttpHandler[] = [
  // GET /users — list users (paginated)
  http.get(`${BASE_URL}/users`, ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')?.toLowerCase() ?? ''
    const page = Number(url.searchParams.get('page') ?? 1)
    const limit = Number(url.searchParams.get('limit') ?? 20)

    let filtered = MOCK_USERS
    if (search) {
      filtered = MOCK_USERS.filter(
        (u) => u.fullName.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)
      )
    }

    const start = (page - 1) * limit
    const paginated = filtered.slice(start, start + limit)

    return HttpResponse.json({
      data: paginated,
      meta: { page, limit, total: filtered.length },
    })
  }),

  // POST /users — create user
  http.post(`${BASE_URL}/users`, async ({ request }) => {
    const body = (await request.json()) as {
      fullName: string
      email: string
      password: string
      roleIds: string[]
    }
    const newUser: MockUser = {
      id: `user-${Date.now()}`,
      fullName: body.fullName,
      email: body.email,
      isActive: true,
      lastLoginAt: null,
      roles: MOCK_ROLES.filter((r) => body.roleIds?.includes(r.id)),
    }
    MOCK_USERS.push(newUser)
    return HttpResponse.json({ data: newUser }, { status: 201 })
  }),

  // PATCH /users/:id — update user
  http.patch(`${BASE_URL}/users/:id`, async ({ request, params }) => {
    const body = (await request.json()) as { fullName?: string; email?: string; roleIds?: string[] }
    const user = MOCK_USERS.find((u) => u.id === params.id)
    if (!user) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    if (body.fullName) user.fullName = body.fullName
    if (body.email) user.email = body.email
    if (body.roleIds) user.roles = MOCK_ROLES.filter((r) => body.roleIds!.includes(r.id))
    return HttpResponse.json({ data: user })
  }),

  // DELETE /users/:id — soft-delete
  http.delete(`${BASE_URL}/users/:id`, ({ params }) => {
    const idx = MOCK_USERS.findIndex((u) => u.id === params.id)
    if (idx === -1) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    MOCK_USERS.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // GET /permissions — list all available permissions in the system
  http.get(`${BASE_URL}/permissions`, () => {
    type PermDef = { id: string; module: string; action: string; description: string }
    const allPerms: PermDef[] = [
      { id: 'perm-orders-read', module: 'orders', action: 'read', description: 'View orders' },
      {
        id: 'perm-orders-write',
        module: 'orders',
        action: 'write',
        description: 'Create/update orders',
      },
      {
        id: 'perm-orders-delete',
        module: 'orders',
        action: 'delete',
        description: 'Delete orders',
      },
      {
        id: 'perm-orders-approve',
        module: 'orders',
        action: 'approve',
        description: 'Approve orders',
      },
      {
        id: 'perm-orders-export',
        module: 'orders',
        action: 'export',
        description: 'Export orders',
      },
      {
        id: 'perm-procurement-read',
        module: 'procurement',
        action: 'read',
        description: 'View procurement',
      },
      {
        id: 'perm-procurement-write',
        module: 'procurement',
        action: 'write',
        description: 'Manage procurement',
      },
      {
        id: 'perm-procurement-approve',
        module: 'procurement',
        action: 'approve',
        description: 'Approve POs',
      },
      {
        id: 'perm-manufacturing-read',
        module: 'manufacturing',
        action: 'read',
        description: 'View production',
      },
      {
        id: 'perm-manufacturing-write',
        module: 'manufacturing',
        action: 'write',
        description: 'Manage production',
      },
      {
        id: 'perm-inventory-read',
        module: 'inventory',
        action: 'read',
        description: 'View inventory',
      },
      {
        id: 'perm-inventory-write',
        module: 'inventory',
        action: 'write',
        description: 'Manage inventory',
      },
      { id: 'perm-finance-read', module: 'finance', action: 'read', description: 'View finance' },
      {
        id: 'perm-finance-write',
        module: 'finance',
        action: 'write',
        description: 'Manage finance',
      },
      {
        id: 'perm-finance-approve',
        module: 'finance',
        action: 'approve',
        description: 'Approve finance',
      },
      {
        id: 'perm-finance-export',
        module: 'finance',
        action: 'export',
        description: 'Export finance reports',
      },
      { id: 'perm-hr-read', module: 'hr', action: 'read', description: 'View HR' },
      { id: 'perm-hr-write', module: 'hr', action: 'write', description: 'Manage HR' },
      { id: 'perm-board-read', module: 'board', action: 'read', description: 'View board' },
      { id: 'perm-board-write', module: 'board', action: 'write', description: 'Manage board' },
      {
        id: 'perm-system-read',
        module: 'system',
        action: 'read',
        description: 'View system settings',
      },
      {
        id: 'perm-system-write',
        module: 'system',
        action: 'write',
        description: 'Manage system settings',
      },
    ]
    return HttpResponse.json({ data: allPerms })
  }),

  // GET /roles — list roles
  http.get(`${BASE_URL}/roles`, () => {
    return HttpResponse.json({ data: MOCK_ROLES_WITH_PERMS })
  }),

  // GET /roles/:id — fetch a single role with permissions
  http.get(`${BASE_URL}/roles/:id`, ({ params }) => {
    const role = MOCK_ROLES_WITH_PERMS.find((r) => r.id === params.id)
    if (!role) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json({ data: role })
  }),

  // POST /roles/:id/permissions — add a permission to a role
  http.post(`${BASE_URL}/roles/:id/permissions`, async ({ request, params }) => {
    const body = (await request.json()) as { permissionId: string; module: string; action: string }
    const role = MOCK_ROLES_WITH_PERMS.find((r) => r.id === params.id)
    if (!role) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const permStr = `${body.module}:${body.action}`
    const alreadyExists = role.permissions.some((p) => `${p.module}:${p.action}` === permStr)
    if (!alreadyExists) {
      role.permissions.push({
        id: body.permissionId,
        module: body.module,
        action: body.action,
        description: '',
      })
    }
    return HttpResponse.json({ data: role })
  }),

  // DELETE /roles/:id/permissions/:permId — remove a permission from a role
  http.delete(`${BASE_URL}/roles/:id/permissions/:permId`, ({ params }) => {
    const role = MOCK_ROLES_WITH_PERMS.find((r) => r.id === params.id)
    if (!role) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const permId = params.permId as string // UUID of the permission
    role.permissions = role.permissions.filter((p) => p.id !== permId)
    return new HttpResponse(null, { status: 204 })
  }),

  // POST /roles — create role
  http.post(`${BASE_URL}/roles`, async ({ request }) => {
    const body = (await request.json()) as { name: string; description?: string }
    const newRole = {
      id: `role-${Date.now()}`,
      name: body.name,
      description: body.description ?? null,
      isSystem: false,
      permissions: [] as Array<{ id: string; module: string; action: string; description: string }>,
    }
    MOCK_ROLES_WITH_PERMS.push(newRole)
    MOCK_ROLES.push({ id: newRole.id, name: newRole.name, description: newRole.description ?? '' })
    return HttpResponse.json({ data: newRole }, { status: 201 })
  }),

  // PATCH /roles/:id — update a role
  http.patch(`${BASE_URL}/roles/:id`, async ({ request, params }) => {
    const body = (await request.json()) as { name?: string; description?: string }
    const role = MOCK_ROLES_WITH_PERMS.find((r) => r.id === params.id)
    if (!role) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    if (body.name !== undefined) role.name = body.name
    if (body.description !== undefined) role.description = body.description
    // Also update the plain MOCK_ROLES list
    const plainRole = MOCK_ROLES.find((r) => r.id === params.id)
    if (plainRole) {
      if (body.name !== undefined) plainRole.name = body.name
      if (body.description !== undefined) plainRole.description = body.description
    }
    return HttpResponse.json({ data: role })
  }),

  // DELETE /roles/:id — delete a role
  http.delete(`${BASE_URL}/roles/:id`, ({ params }) => {
    const idx = MOCK_ROLES_WITH_PERMS.findIndex((r) => r.id === params.id)
    if (idx === -1) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    if (MOCK_ROLES_WITH_PERMS[idx]!.isSystem) {
      return HttpResponse.json({ detail: 'System roles cannot be deleted' }, { status: 403 })
    }
    MOCK_ROLES_WITH_PERMS.splice(idx, 1)
    const plainIdx = MOCK_ROLES.findIndex((r) => r.id === params.id)
    if (plainIdx !== -1) MOCK_ROLES.splice(plainIdx, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]
