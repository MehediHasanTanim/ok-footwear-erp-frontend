import { ChevronRight } from 'lucide-react'
import { useMatches, type UIMatch } from 'react-router-dom'

/**
 * Breadcrumb auto-generated from React Router `handle.crumb`.
 *
 * Each route must define:
 *   handle: { crumb: (match: UIMatch) => string }
 *
 * The breadcrumb walks the matched route tree, calls each crumb function,
 * and renders a forward-slash-separated trail.
 */
export function Breadcrumb() {
  const matches = useMatches() as UIMatch<unknown, { crumb?: (m: UIMatch) => string }>[]

  const crumbs = matches
    .filter((m) => typeof m.handle?.crumb === 'function')
    .map((m, i, arr) => {
      const label = m.handle!.crumb!(m)
      const isLast = i === arr.length - 1
      return { label, isLast }
    })

  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <span className={crumb.isLast ? 'font-medium text-foreground' : 'text-muted-foreground'}>
            {crumb.label}
          </span>
        </span>
      ))}
    </nav>
  )
}
