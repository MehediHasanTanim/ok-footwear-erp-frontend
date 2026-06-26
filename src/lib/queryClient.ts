import { QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// ── Query Key Convention ─────────────────────────────────────────────────────
//
// All query keys MUST follow the tuple pattern:  [entity, id?, filters?]
//
// Examples:
//   ['orders']                         — all orders (list)
//   ['orders', orderId]                — single order by id
//   ['orders', 'list', { status }]     — filtered list
//   ['procurement', 'purchase-orders', { supplierId }]
//
// This convention enables:
//   1. Partial invalidation: queryClient.invalidateQueries({ queryKey: ['orders'] })
//      invalidates ALL order queries regardless of sub-key.
//   2. Predictable cache keys — no string-templating bugs.
//   3. DevTools shows a readable hierarchy.
//
// ⚠️  Do NOT use string keys like `'orders-list'` or `['order', id, 'details']`.
//     The first element is always the entity/resource name.

// ── QueryClient ──────────────────────────────────────────────────────────────
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30 seconds — long enough to avoid redundant fetches during navigation,
      // short enough that data feels fresh for an ERP dashboard.
      staleTime: 30_000,

      // Single retry — one network blip is common; two almost always means a
      // real problem.  Don't burn the user's time on failing requests.
      retry: 1,

      // Disabled for ERP: users expect to see the last-known state when they
      // tab back, not a loading spinner.  Manual refetch via "Refresh" buttons.
      refetchOnWindowFocus: false,

      // v5 requires queryFn to return data directly (our Axios wrapper already
      // unwraps the { data } envelope, so consumers just return the apiClient call).
      // No structuralSharing: false needed — v5's default deep-equality is fine
      // for our DTO shapes.
    },
  },

  // Global error handler — catches ALL failed queries and surfaces them as toasts.
  // Individual queries can override by passing their own onError via meta or
  // by catching in the component.
  queryCache: new QueryCache({
    // v5 signature: (error: unknown, query: Query)
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error(message)
    },
  }),
})
