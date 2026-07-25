import fs from 'fs'
import path from 'path'

/**
 * Extract the access token from a Playwright auth storage state file.
 *
 * Our globalSetup stores auth state for each role in e2e/.auth/*.json.
 * These files contain localStorage and cookie state for the authenticated
 * browser context.  This helper reads the token so tests can make direct
 * API calls with Bearer authentication.
 *
 * NOTE: If the token is stored in an httpOnly cookie (not localStorage),
 * this approach won't work.  In that case, use page.request (which shares
 * the authenticated page's cookie context) instead of explicit headers.
 * The current Sprint 1 auth implementation stores the access token in
 * localStorage under the key 'access_token'.
 */
export function getOpsManagerToken(): string {
  const authPath = path.resolve(__dirname, '..', '.auth', 'manager.json')

  if (!fs.existsSync(authPath)) {
    throw new Error(
      `[getOpsManagerToken] Auth file not found: ${authPath}. ` +
        `Run globalSetup first: npx playwright test --project=setup`
    )
  }

  const state = JSON.parse(fs.readFileSync(authPath, 'utf-8')) as {
    origins: Array<{
      localStorage: Array<{ name: string; value: string }>
    }>
  }

  // Find the access token in localStorage across all origins
  for (const origin of state.origins ?? []) {
    const tokenEntry = origin.localStorage?.find(
      (item) => item.name === 'access_token' || item.name === 'accessToken'
    )
    if (tokenEntry?.value) {
      return tokenEntry.value
    }
  }

  throw new Error(
    '[getOpsManagerToken] access_token not found in auth storage state. ' +
      'Check localStorage key name in authStore.ts.'
  )
}

/**
 * Get the auth storage state path for a role.
 */
export function getAuthPath(role: 'admin' | 'manager' | 'operator' | 'finance'): string {
  return path.resolve(__dirname, '..', '.auth', `${role}.json`)
}
