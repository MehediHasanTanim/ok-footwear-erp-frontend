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
const API_BASE = process.env.E2E_API_BASE_URL ?? BASE_URL

// ── Seed IDs file ───────────────────────────────────────────────────────────
const SEED_IDS_PATH = path.resolve(__dirname, 'fixtures', 'seed-ids.json')

interface SeedIds {
  buyerId: string
  articleId: string
  confirmedOrderId: string
}

// ── Login via API (not UI) ──────────────────────────────────────────────────
async function loginAs(role: Role): Promise<void> {
  const config = ROLES[role]
  console.log(`[global-setup] Logging in as '${role}' via API…`)

  const context = await request.newContext({ baseURL: API_BASE })

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

// ── Seed test data ──────────────────────────────────────────────────────────
async function seedTestData(): Promise<SeedIds> {
  console.log('[global-setup] Seeding test data for Orders E2E…')

  // Use admin auth for seeding
  const context = await request.newContext({
    baseURL: API_BASE,
    storageState: ROLES.admin.storageState,
  })

  let buyerId = ''
  let articleId = ''
  let confirmedOrderId = ''

  // 1. Create a test buyer
  try {
    const buyerResp = await context.post('/api/buyers', {
      data: {
        buyer_code: 'E2E-BUY-001',
        name: 'Test Buyer Co.',
        contact_name: 'E2E Contact',
        email: 'e2e-buyer@test.com',
        phone: '+8801700000000',
        address: 'E2E Test Address, Dhaka',
        country: 'Bangladesh',
        payment_terms: 30,
        credit_limit: 100000,
        currency: 'USD',
        notes: 'E2E test buyer — auto-created by globalSetup',
      },
    })
    if (buyerResp.ok()) {
      const { data: buyerData } = await buyerResp.json()
      buyerId = buyerData?.id ?? buyerData?.data?.id ?? ''
      console.log(`[global-setup] ✓ Created test buyer: ${buyerId}`)
    } else {
      // Buyer may already exist from a previous run — try to fetch
      const listResp = await context.get('/api/buyers?search=E2E-BUY-001')
      if (listResp.ok()) {
        const { data: listData } = await listResp.json()
        const buyers = listData?.data ?? listData ?? []
        if (Array.isArray(buyers) && buyers.length > 0) {
          buyerId = buyers[0].id
          console.log(`[global-setup] ✓ Found existing test buyer: ${buyerId}`)
        }
      }
      if (!buyerId) {
        throw new Error(`Failed to create or find test buyer: ${buyerResp.status()}`)
      }
    }
  } catch (err) {
    console.warn('[global-setup] ⚠ Could not seed buyer:', err)
  }

  // 2. Create a test article
  try {
    const articleResp = await context.post('/api/articles', {
      data: {
        article_code: 'E2E-ART-001',
        description: 'Test Boot',
        category: 'men',
        sub_category: 'boots',
        gender: 'male',
        season: 'AW26',
        size_system: 'EU',
      },
    })
    if (articleResp.ok()) {
      const { data: articleData } = await articleResp.json()
      articleId = articleData?.id ?? articleData?.data?.id ?? ''
      console.log(`[global-setup] ✓ Created test article: ${articleId}`)
    } else {
      const listResp = await context.get('/api/articles?search=E2E-ART-001')
      if (listResp.ok()) {
        const { data: listData } = await listResp.json()
        const articles = listData?.data ?? listData ?? []
        if (Array.isArray(articles) && articles.length > 0) {
          articleId = articles[0].id
          console.log(`[global-setup] ✓ Found existing test article: ${articleId}`)
        }
      }
      if (!articleId) {
        throw new Error(`Failed to create or find test article: ${articleResp.status()}`)
      }
    }
  } catch (err) {
    console.warn('[global-setup] ⚠ Could not seed article:', err)
  }

  // 3. Create a confirmed order (no sample approval) for TC-E2E-ORD-003
  try {
    if (buyerId && articleId) {
      // First create a draft order
      const orderResp = await context.post('/api/orders', {
        data: {
          buyer_id: buyerId,
          article_id: articleId,
          order_type: 'bulk',
          currency: 'USD',
          unit_price: 15.0,
          total_quantity: 200,
          delivery_date: '2027-06-01',
          order_lines: [
            { size_label: '38', quantity: 50 },
            { size_label: '39', quantity: 50 },
            { size_label: '40', quantity: 50 },
            { size_label: '41', quantity: 50 },
          ],
        },
      })
      if (orderResp.ok()) {
        const { data: orderData } = await orderResp.json()
        const draftId = orderData?.id ?? orderData?.data?.id ?? ''
        if (draftId) {
          // Transition to confirmed (with sample_approved: false)
          const transitionResp = await context.patch(`/api/orders/${draftId}/status`, {
            data: { toStatus: 'confirmed' },
          })
          if (transitionResp.ok()) {
            confirmedOrderId = draftId
            console.log(`[global-setup] ✓ Created confirmed order: ${confirmedOrderId}`)
          } else {
            console.warn(`[global-setup] ⚠ Created draft ${draftId} but could not confirm: ${transitionResp.status()}`)
          }
        }
      } else {
        console.warn(`[global-setup] ⚠ Could not create seed order: ${orderResp.status()}`)
      }
    } else {
      console.warn('[global-setup] ⚠ Skipping order seed — missing buyer/article')
    }
  } catch (err) {
    console.warn('[global-setup] ⚠ Could not seed order:', err)
  }

  await context.dispose()

  const ids: SeedIds = { buyerId, articleId, confirmedOrderId }
  return ids
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

  // Seed test data for Orders E2E suite
  console.log('[global-setup] Seeding Orders E2E test data…')
  const seedIds = await seedTestData()

  // Write seed IDs JSON for tests to reference
  fs.writeFileSync(SEED_IDS_PATH, JSON.stringify(seedIds, null, 2), 'utf-8')
  console.log(`[global-setup] ✓ Seed IDs written to ${SEED_IDS_PATH}`)
}

// Re-export for test fixtures
export { ROLES, type Role, type RoleConfig }
