import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import '@/lib/i18n'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/router'
import '@/globals.css'

// DevTools are only loaded in development.  The dynamic import is tree-shaken
// by Vite in production builds (import.meta.env.DEV is a compile-time constant).
// Wrapping in React.lazy ensures the chunk is code-split, never in the main bundle.
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({
        default: m.ReactQueryDevtools,
      }))
    )
  : null

const root = document.getElementById('root')
// noUncheckedIndexedAccess: root could be null if script is loaded before DOM
if (!root) {
  throw new Error('Root element #root not found in the DOM')
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {ReactQueryDevtools && (
        <Suspense>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  </StrictMode>
)
