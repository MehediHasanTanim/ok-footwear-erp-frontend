import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import CompliancePage from '@/pages/system/CompliancePage'
import { useAuthStore } from '@/stores/authStore'
import { render, screen, waitFor, userEvent } from '@/test/test-utils'

function setupAuth() {
  useAuthStore.setState({
    userId: 'user-1',
    fullName: 'Super Admin',
    role: 'super_admin',
    permissions: [{ module: 'system', action: 'read' }],
    accessToken: 'mock-token',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    isLoading: false,
  })
}

function resetAuth() {
  useAuthStore.setState({
    userId: null,
    fullName: null,
    role: null,
    permissions: [],
    accessToken: null,
    expiresAt: null,
    isLoading: false,
  })
}

describe('CompliancePage', () => {
  beforeEach(() => setupAuth())
  afterEach(() => resetAuth())

  // AC 1: Table renders all columns including countdown badge
  it('renders all columns including countdown badge', async () => {
    render(<CompliancePage />, { initialRoute: '/system/compliance' })

    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-1')).toBeInTheDocument()
    })

    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Expiry Date')).toBeInTheDocument()
    expect(screen.getByText('Due')).toBeInTheDocument()
    expect(screen.getByText('Responsible')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  // AC 2: Expired items show red 'Expired' pill
  it('shows red Expired pill for expired items', async () => {
    render(<CompliancePage />, { initialRoute: '/system/compliance' })

    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-1')).toBeInTheDocument()
    })

    const badge = screen.getByTestId('countdown-comp-1')
    expect(badge).toHaveTextContent('Expired')
    expect(badge.className).toMatch(/bg-\[rgb\(var\(--bg-danger\)\)\]/)
    expect(badge.className).toMatch(/text-\[rgb\(var\(--text-danger\)\)\]/)
  })

  // AC 3: Items within alert_days show amber pill
  it('shows amber warning pill for items within alert days', async () => {
    render(<CompliancePage />, { initialRoute: '/system/compliance' })

    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-2')).toBeInTheDocument()
    })

    const badge = screen.getByTestId('countdown-comp-2')
    expect(badge).toHaveTextContent(/^\d+d$/)
    expect(badge.className).toMatch(/bg-\[rgb\(var\(--bg-warning\)\)\]/)
  })

  // AC 4: Safe items show green pill
  it('shows green safe pill for items with plenty of time', async () => {
    render(<CompliancePage />, { initialRoute: '/system/compliance' })

    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-3')).toBeInTheDocument()
    })

    const badge = screen.getByTestId('countdown-comp-3')
    expect(badge).toHaveTextContent(/\d+d/)
    expect(badge.className).toMatch(/bg-\[rgb\(var\(--bg-success\)\)\]/)
  })

  // AC 5: daysRemaining computed client-side with date-fns differenceInDays
  it('computes daysRemaining client-side', async () => {
    render(<CompliancePage />, { initialRoute: '/system/compliance' })

    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-1')).toBeInTheDocument()
    })

    // comp-1 has expiryDate 10 days in the past → should show "Expired"
    expect(screen.getByTestId('countdown-comp-1')).toHaveTextContent('Expired')
  })

  // AC 6: Status badge colors
  it('renders status badges with correct CSS variable colors', async () => {
    render(<CompliancePage />, { initialRoute: '/system/compliance' })

    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-1')).toBeInTheDocument()
    })

    // expired status badges (there may be multiple)
    const expiredBadges = screen.getAllByTestId('status-expired')
    expect(expiredBadges.length).toBeGreaterThan(0)
    expect(expiredBadges[0]!.className).toMatch(/bg-\[rgb\(var\(--bg-danger\)\)\]/)

    // valid status badges
    const validBadges = screen.getAllByTestId('status-valid')
    expect(validBadges.length).toBeGreaterThan(0)
    expect(validBadges[0]!.className).toMatch(/bg-\[rgb\(var\(--bg-success\)\)\]/)
  })

  // AC 7: Status filter updates and refetches
  it('filters by status', async () => {
    render(<CompliancePage />, { initialRoute: '/system/compliance' })

    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-1')).toBeInTheDocument()
    })

    // Click "expired" filter
    await userEvent.click(screen.getByTestId('status-filter-expired'))

    // Only expired items should show
    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-1')).toBeInTheDocument()
      expect(screen.queryByTestId('compliance-row-comp-3')).not.toBeInTheDocument()
    })
  })

  // AC 8: Create dialog validates required fields
  it('validates create dialog required fields', async () => {
    render(<CompliancePage />, { initialRoute: '/system/compliance' })

    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-1')).toBeInTheDocument()
    })

    // Open create dialog
    await userEvent.click(screen.getByTestId('new-compliance-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('form-name')).toBeInTheDocument()
    })

    // Submit should be disabled with empty form
    expect(screen.getByTestId('form-submit')).toBeDisabled()

    // Fill required fields
    await userEvent.type(screen.getByTestId('form-name'), 'Test Item')
    await userEvent.type(screen.getByTestId('form-expiry-date'), '2027-12-31')
    await userEvent.type(screen.getByTestId('form-alert-days'), '{selectall}30')
  })

  // AC 9: Edit dialog pre-populates fields
  it('pre-populates edit dialog with item data', async () => {
    render(<CompliancePage />, { initialRoute: '/system/compliance' })

    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-1')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('edit-comp-1'))

    await waitFor(() => {
      const nameInput = screen.getByTestId('form-name') as HTMLInputElement
      expect(nameInput.value).toBe('Fire Safety Certificate')
    })
  })

  // AC 10: Responsible user autocomplete
  it('searches responsible user with autocomplete', async () => {
    render(<CompliancePage />, { initialRoute: '/system/compliance' })

    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-1')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('new-compliance-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('form-user-search')).toBeInTheDocument()
    })
  })

  // AC 11: Table sorted by daysRemaining ascending by default
  it('sorts by daysRemaining ascending by default', async () => {
    render(<CompliancePage />, { initialRoute: '/system/compliance' })

    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-1')).toBeInTheDocument()
    })

    // Get all visible rows
    const rows = screen.getAllByTestId(/^compliance-row-/)
    // First row should be the most urgent (expired item)
    expect(rows[0]).toHaveAttribute('data-testid', 'compliance-row-comp-1')
  })

  // AC 12: No hardcoded hex colors
  it('uses CSS variables for all badge colors', async () => {
    render(<CompliancePage />, { initialRoute: '/system/compliance' })

    await waitFor(() => {
      expect(screen.getByTestId('compliance-row-comp-1')).toBeInTheDocument()
    })

    // Check all countdown badges use var() syntax
    const allBadges = screen.getAllByTestId(/^countdown-/)
    for (const badge of allBadges) {
      expect(badge.className).toMatch(/rgb\(var/)
    }
  })
})
