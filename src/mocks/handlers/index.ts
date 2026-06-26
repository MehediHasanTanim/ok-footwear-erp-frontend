import { type HttpHandler } from 'msw'

import { authHandlers } from './auth.handlers'

// Aggregate all domain handlers.
// Each domain gets its own file (orders.handlers.ts, procurement.handlers.ts, etc.)
export const handlers: HttpHandler[] = [...authHandlers]
