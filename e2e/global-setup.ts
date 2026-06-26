import { type FullConfig, request } from '@playwright/test'
import fs from 'fs'
import path from 'path'

// ── Role configuration ──────────────────────────────────────────────────────
// Each role maps to a test account in staging.  These accounts must exist
// in the target environment's database BEFORE running E2E tests.

type Role = 'admin' | 'manager' | 'operator' | 'finance'

interface RoleConfig {
  email: string
  password: string
  /** The auth state file written for this role */
  storageState: string
}

const AUTH_DIR = path.resolve(__dirname, '.auth')

const ROLES: Record<Role, RoleConfig> = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'admin@okfootwear.com',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'admin123!',
    storageState: path.join(AUTH_DIR, 'admin.json'),
  },
  manager: {
    email: process.env.E2E_MANAGER_EMAIL ?? 'manager@okfootwear.com',
    password: process.env.E2E_MANAGER_PASSWORD ?? 'manager123!',
    storageState: path.join(AUTH_DIR, 'manager.json'),
  },
  operator: {
    email: process.env.E2E_OPERATOR_EMAIL ?? 'operator@okfootwear.com',
    password: process.env.E2E_OPERATOR_PASSWORD ?? 'operator123!',
    storageState: path.join(AUTH_DIR, 'operator.json'),
  },
  finance: {
    email: process.env.E2E_FINANCE_EMAIL ?? 'finance@okfootwear.com',
    password: process.env.E2E_FINANCE_PASSWORD ?? 'finance123!',
    storageState: path.join(AUTH_DIR, 'finance.json'),
  },
}

// ── Base URL from config ────────────────────────────────────────────────────
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'

// ── Login via API (not UI) ──────────────────────────────────────────────────
async function loginAs(role: Role): Promise<void> {
  const config = ROLES[role]
  console.log(`[global-setup] Logging in as '${role}' via API…`)

  const context = await request.newContext({ baseURL: BASE_URL })

  const loginResponse = await context.post('/api/auth/login', {
    data: { email: config.email, password: config.password },
  })

  if (!loginResponse.ok()) {
    throw new Error(
      `[global-setup] Login failed for '${role}' (${config.email}): ` +
        `${loginResponse.status()} ${loginResponse.statusText()}`
    )
  }

  const { data } = await loginResponse.json()
  // Strip the old NestJS wrapper: our API returns { data: { accessToken, ... } }
  const accessToken: string = data?.accessToken ?? data?.data?.accessToken

  if (!accessToken) {
    throw new Error(
      `[global-setup] No accessToken in login response for '${role}'. ` +
        `Response keys: ${Object.keys(data ?? {})}`
    )
  }

  // Write auth state file — Playwright loads this via storageState in test configs.
  await context.storageState({ path: config.storageState })
  await context.dispose()

  console.log(`[global-setup] ✓ Auth state saved for '${role}' → ${config.storageState}`)
}

// ── Global setup entry point ────────────────────────────────────────────────
export default async function globalSetup(_config: FullConfig): Promise<void> {
  // Ensure .auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
  }

  // Log in each role.  Run sequentially to avoid rate-limiting the backend.
  for (const role of Object.keys(ROLES) as Role[]) {
    await loginAs(role)
  }

  console.log('[global-setup] ✓ All roles authenticated.')
}

// Re-export for test fixtures
export { ROLES, type Role, type RoleConfig }
