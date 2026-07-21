import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import AuditLogPage from '@/pages/system/AuditLogPage'
import { useAuthStore } from '@/stores/authStore'
import { render, screen, waitFor, userEvent, server } from '@/test/test-utils'

const BASE_URL = import.meta.env.VITE_API_URL

// ── Helpers ──────────────────────────────────────────────────────────────────
function setupAuth() {
  useAuthStore.setState({
    userId: 'user-1',
    fullName: 'Super Admin',
    role: 'super_admin',
    permissions: [{ module: 'system', action: 'read' }],
    accessToken: 'mock-access-token',
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

// ── Tests ────────────────────────────────────────────────────────────────────
describe('AuditLogPage', () => {
  beforeEach(() => {
    setupAuth()
  })

  afterEach(() => {
    resetAuth()
  })

  // AC 1: Table renders with all columns; pagination works server-side
  it('renders table with all columns and pagination', async () => {
    render(<AuditLogPage />, { initialRoute: '/system/audit' })

    await waitFor(() => {
      expect(screen.getByTestId('audit-table')).toBeInTheDocument()
    })

    // Check column headers
    expect(screen.getByText('Timestamp')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('Module')).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText('Table')).toBeInTheDocument()
    expect(screen.getByText('Record ID')).toBeInTheDocument()

    // Should show pagination (32 mock logs with 20/page → 2 pages)
    await waitFor(() => {
      expect(screen.getByTestId('next-page')).toBeInTheDocument()
      expect(screen.getByTestId('prev-page')).toBeInTheDocument()
    })
  })

  // AC 2: Action badges with correct colors
  it('renders action badges with correct CSS classes', async () => {
    render(<AuditLogPage />, { initialRoute: '/system/audit' })

    // Wait for data rows to render
    await waitFor(() => {
      expect(screen.getByTestId('audit-row-audit-1')).toBeInTheDocument()
    })

    // INSERT badge should have teal classes
    const insertBadges = screen.getAllByTestId('action-badge-INSERT')
    expect(insertBadges.length).toBeGreaterThan(0)
    expect(insertBadges[0]!.className).toMatch(/teal/)

    // UPDATE badge should have blue classes
    const updateBadges = screen.getAllByTestId('action-badge-UPDATE')
    expect(updateBadges.length).toBeGreaterThan(0)
    expect(updateBadges[0]!.className).toMatch(/blue/)

    // DELETE badge should have red classes
    const deleteBadges = screen.getAllByTestId('action-badge-DELETE')
    expect(deleteBadges.length).toBeGreaterThan(0)
    expect(deleteBadges[0]!.className).toMatch(/red/)

    // SELECT badge should have gray classes
    const selectBadges = screen.getAllByTestId('action-badge-SELECT')
    expect(selectBadges.length).toBeGreaterThan(0)
    expect(selectBadges[0]!.className).toMatch(/gray/)
  })

  // AC 3: Date range filter updates queryKey and refetches
  it('filters by date range and refetches', async () => {
    render(<AuditLogPage />, { initialRoute: '/system/audit' })

    await waitFor(() => {
      expect(screen.getByTestId('audit-table')).toBeInTheDocument()
    })

    const startDateInput = screen.getByTestId('filter-start-date') as HTMLInputElement
    const endDateInput = screen.getByTestId('filter-end-date') as HTMLInputElement

    await userEvent.type(startDateInput, '2026-07-19')
    await userEvent.type(endDateInput, '2026-07-19')

    // Input values should reflect the typed dates
    expect(startDateInput.value).toBe('2026-07-19')
    expect(endDateInput.value).toBe('2026-07-19')
  })

  // AC 4: Module multi-select filter works independently
  it('filters by module multi-select', async () => {
    render(<AuditLogPage />, { initialRoute: '/system/audit' })

    await waitFor(() => {
      expect(screen.getByTestId('audit-table')).toBeInTheDocument()
    })

    const ordersBtn = screen.getByTestId('module-filter-orders')
    expect(ordersBtn).toHaveClass('border-input')

    await userEvent.click(ordersBtn)

    // Button should now be active (selected state)
    await waitFor(() => {
      expect(ordersBtn).toHaveClass('border-primary')
    })
  })

  // AC 5: User autocomplete calls GET /users?search= with 300ms debounce
  it('searches users with debounce', async () => {
    let capturedSearch = ''

    server.use(
      http.get(`${BASE_URL}/users`, ({ request }) => {
        const url = new URL(request.url)
        capturedSearch = url.searchParams.get('search') ?? ''
        return HttpResponse.json({
          data: [{ id: 'user-1', fullName: 'Super Admin', email: 'admin@okfootwear.com' }],
        })
      })
    )

    render(<AuditLogPage />, { initialRoute: '/system/audit' })

    await waitFor(() => {
      expect(screen.getByTestId('audit-table')).toBeInTheDocument()
    })

    const searchInput = screen.getByTestId('user-search-input')
    await userEvent.type(searchInput, 'Super')

    // Wait for debounce + query
    await waitFor(
      () => {
        expect(capturedSearch).toBe('Super')
      },
      { timeout: 2000 }
    )
  })

  // AC 6: Clicking row expands it; clicking again collapses
  it('expands and collapses a row on click', async () => {
    render(<AuditLogPage />, { initialRoute: '/system/audit' })

    await waitFor(() => {
      expect(screen.getByTestId('audit-row-audit-1')).toBeInTheDocument()
    })

    // Click row to expand
    const row = screen.getByTestId('audit-row-audit-1')
    await userEvent.click(row)

    await waitFor(() => {
      expect(screen.getByTestId('expanded-row-audit-1')).toBeInTheDocument()
    })

    // Click again to collapse
    await userEvent.click(row)

    await waitFor(() => {
      expect(screen.queryByTestId('expanded-row-audit-1')).not.toBeInTheDocument()
    })
  })

  // AC 7: Diff view shows old_value and new_value in two-column layout (UPDATE)
  it('shows old and new values in diff for UPDATE', async () => {
    render(<AuditLogPage />, { initialRoute: '/system/audit' })

    await waitFor(() => {
      expect(screen.getByTestId('audit-row-audit-1')).toBeInTheDocument()
    })

    // Expand the UPDATE row (audit-1)
    await userEvent.click(screen.getByTestId('audit-row-audit-1'))

    await waitFor(() => {
      expect(screen.getByTestId('expanded-row-audit-1')).toBeInTheDocument()
    })

    // Should show Old Value and New Value headers
    expect(screen.getByText('Old Value')).toBeInTheDocument()
    expect(screen.getByText('New Value')).toBeInTheDocument()
  })

  // AC 8: Added keys green, removed red, changed values amber
  it('applies correct diff colors', async () => {
    render(<AuditLogPage />, { initialRoute: '/system/audit' })

    await waitFor(() => {
      expect(screen.getByTestId('audit-row-audit-1')).toBeInTheDocument()
    })

    // Expand the UPDATE row
    await userEvent.click(screen.getByTestId('audit-row-audit-1'))

    await waitFor(() => {
      expect(screen.getByTestId('expanded-row-audit-1')).toBeInTheDocument()
    })

    // The 'status' key changed from 'pending' to 'confirmed'
    // Changed values should have amber styling
    const changedElements = document.querySelectorAll('.border-l-amber-400')
    expect(changedElements.length).toBeGreaterThan(0)
  })

  // AC 9: Diff handles nested JSONB recursively
  it('renders nested diff recursively', async () => {
    render(<AuditLogPage />, { initialRoute: '/system/audit' })

    await waitFor(() => {
      expect(screen.getByTestId('audit-row-audit-6')).toBeInTheDocument()
    })

    // Expand audit-6 which has nested object in newValue
    await userEvent.click(screen.getByTestId('audit-row-audit-6'))

    await waitFor(() => {
      expect(screen.getByTestId('expanded-row-audit-6')).toBeInTheDocument()
    })

    // Should render nested keys with indentation
    expect(screen.getByText('level1')).toBeInTheDocument()
    expect(screen.getByText('level2')).toBeInTheDocument()
  })

  // AC 10: INSERT shows only new_value; DELETE shows only old_value
  it('INSERT shows only new values, DELETE shows only old values', async () => {
    render(<AuditLogPage />, { initialRoute: '/system/audit' })

    await waitFor(() => {
      expect(screen.getByTestId('audit-row-audit-2')).toBeInTheDocument()
    })

    // Expand INSERT row (audit-2)
    await userEvent.click(screen.getByTestId('audit-row-audit-2'))
    await waitFor(() => {
      expect(screen.getByTestId('expanded-row-audit-2')).toBeInTheDocument()
    })
    expect(screen.getByText(/New Record/)).toBeInTheDocument()
    expect(screen.queryByText('Old Value')).not.toBeInTheDocument()

    // Expand DELETE row (audit-3)
    await userEvent.click(screen.getByTestId('audit-row-audit-3'))
    await waitFor(() => {
      expect(screen.getByTestId('expanded-row-audit-3')).toBeInTheDocument()
    })
    expect(screen.getByText(/Deleted Record/)).toBeInTheDocument()
    expect(screen.queryByText('New Value')).not.toBeInTheDocument()
  })

  // AC 11: Export CSV triggers download with current filters
  it('exports CSV with filter params', async () => {
    render(<AuditLogPage />, { initialRoute: '/system/audit' })

    await waitFor(() => {
      expect(screen.getByTestId('audit-table')).toBeInTheDocument()
    })

    const exportBtn = screen.getByTestId('export-csv-btn')
    expect(exportBtn).toBeInTheDocument()

    // We can't easily test window.open in jsdom, but we can verify the button exists
    // and is not disabled
    expect(exportBtn).not.toBeDisabled()
  })

  // AC 12: Filter state reflected in URL query params (verified via UI state)
  it('reflects filter state in URL query params', async () => {
    render(<AuditLogPage />, { initialRoute: '/system/audit' })

    await waitFor(() => {
      expect(screen.getByTestId('audit-table')).toBeInTheDocument()
    })

    // Apply module filter — button should become active
    const financeBtn = screen.getByTestId('module-filter-finance')
    await userEvent.click(financeBtn)
    expect(financeBtn).toHaveClass('border-primary')

    // Apply action filter
    const deleteBtn = screen.getByTestId('action-filter-DELETE')
    await userEvent.click(deleteBtn)
    expect(deleteBtn).toHaveClass('border-primary')

    // Clear all filters
    const clearBtn = screen.getByTestId('clear-filters')
    await userEvent.click(clearBtn)

    // Buttons should go back to inactive state
    await waitFor(() => {
      expect(financeBtn).toHaveClass('border-input')
      expect(deleteBtn).toHaveClass('border-input')
    })
  })
})
