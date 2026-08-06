import { type HttpHandler } from 'msw'

import { auditHandlers } from './audit.handlers'
import { authHandlers } from './auth.handlers'
import { complianceHandlers } from './compliance.handlers'
import { ordersHandlers } from './orders.handlers'
import { procurementHandlers } from './procurement.handlers'
import { usersHandlers } from './users.handlers'

// Aggregate all domain handlers.
export const handlers: HttpHandler[] = [
  ...authHandlers,
  ...usersHandlers,
  ...ordersHandlers,
  ...auditHandlers,
  ...complianceHandlers,
  ...procurementHandlers,
]
