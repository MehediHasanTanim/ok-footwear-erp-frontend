import { Lock } from 'lucide-react'
import { useCallback, useMemo, useRef, useEffect } from 'react'

import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────
export interface PermissionDef {
  id: string
  module: string
  action: string
  description?: string
}

export interface PermissionMatrixProps {
  /** All available permissions in the system (from GET /permissions) — drives the grid structure */
  allPermissions: PermissionDef[]
  /** Nested permission map: value[module][action] = boolean */
  value: Record<string, Record<string, boolean>>
  /** Called with a new object (never mutated) */
  onChange: (v: Record<string, Record<string, boolean>>) => void
  /** Disable all interaction */
  disabled?: boolean
  /** Permissions that render locked (disabled + lock icon) */
  protectedPermissions?: Array<{ module: string; action: string }>
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function cloneValue(
  v: Record<string, Record<string, boolean>>
): Record<string, Record<string, boolean>> {
  return structuredClone(v)
}

// ── Component ────────────────────────────────────────────────────────────────
export function PermissionMatrix({
  allPermissions,
  value,
  onChange,
  disabled = false,
  protectedPermissions = [],
}: PermissionMatrixProps) {
  const protectedSet = useMemo(
    () => new Set(protectedPermissions.map((p) => `${p.module}:${p.action}`)),
    [protectedPermissions]
  )

  // Derive unique modules and actions from the API response
  const { modules, actionsByModule, allActions } = useMemo(() => {
    const moduleSet = new Set<string>()
    const actionSet = new Set<string>()
    const map = new Map<string, Set<string>>()

    for (const p of allPermissions) {
      moduleSet.add(p.module)
      actionSet.add(p.action)
      if (!map.has(p.module)) map.set(p.module, new Set())
      map.get(p.module)!.add(p.action)
    }

    return {
      modules: [...moduleSet].sort(),
      actionsByModule: map,
      allActions: [...actionSet].sort(),
    }
  }, [allPermissions])

  const isChecked = useCallback(
    (module: string, action: string) => value[module]?.[action] === true,
    [value]
  )

  const isProtected = useCallback(
    (module: string, action: string) => protectedSet.has(`${module}:${action}`),
    [protectedSet]
  )

  const toggle = useCallback(
    (module: string, action: string) => {
      if (disabled || isProtected(module, action)) return
      const next = cloneValue(value)
      if (!next[module]) next[module] = {}
      next[module]![action] = !next[module]?.[action]
      onChange(next)
    },
    [value, onChange, disabled, isProtected]
  )

  const toggleRow = useCallback(
    (module: string) => {
      if (disabled) return
      const next = cloneValue(value)
      if (!next[module]) next[module] = {}

      const moduleActions = actionsByModule.get(module) ?? new Set()
      const current = next[module]!
      const allChecked = [...moduleActions].every((a) => current[a] === true)

      for (const action of moduleActions) {
        if (isProtected(module, action)) continue
        current[action] = !allChecked
      }
      onChange(next)
    },
    [value, onChange, disabled, isProtected, actionsByModule]
  )

  const getRowState = useCallback(
    (module: string): 'all' | 'some' | 'none' => {
      const moduleActions = actionsByModule.get(module) ?? new Set()
      const current = value[module] ?? {}
      const actions = [...moduleActions]
      const checked = actions.filter((a) => current[a] === true).length
      if (checked === 0) return 'none'
      if (checked === actions.length) return 'all'
      return 'some'
    },
    [value, actionsByModule]
  )

  return (
    <div className="overflow-x-auto" data-testid="permission-matrix">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-3 py-2 text-left font-medium">Module</th>
            <th className="w-10 px-1 py-2 text-center font-medium">All</th>
            {allActions.map((action) => (
              <th key={action} className="px-2 py-2 text-center font-medium capitalize">
                {action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => {
            const rowState = getRowState(module)
            const moduleActions = actionsByModule.get(module) ?? new Set()
            return (
              <tr
                key={module}
                className="border-b hover:bg-muted/50"
                data-testid={`matrix-row-${module}`}
              >
                <td className="px-3 py-2 font-medium capitalize">{module}</td>
                <td className="px-1 py-2 text-center">
                  <SelectAllCheckbox
                    checked={rowState === 'all'}
                    indeterminate={rowState === 'some'}
                    onChange={() => toggleRow(module)}
                    disabled={disabled}
                    data-testid={`row-checkbox-${module}`}
                  />
                </td>
                {allActions.map((action) => {
                  const exists = moduleActions.has(action)
                  const checked = isChecked(module, action)
                  const locked = isProtected(module, action)
                  return (
                    <td key={action} className="px-2 py-2 text-center">
                      {!exists ? (
                        <span className="text-xs text-muted-foreground/30">—</span>
                      ) : locked ? (
                        <span
                          className="inline-flex items-center gap-0.5 text-muted-foreground"
                          title="System-protected permission"
                        >
                          <Lock className="h-3 w-3" />
                        </span>
                      ) : (
                        <CellCheckbox
                          checked={checked}
                          onChange={() => toggle(module, action)}
                          disabled={disabled}
                          data-testid={`cell-${module}-${action}`}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Internal: Select-all checkbox with indeterminate ─────────────────────────
function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  ...props
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
  disabled?: boolean
  [key: string]: unknown
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className={cn(
        'h-4 w-4 cursor-pointer rounded border-2 border-input accent-primary',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      {...props}
    />
  )
}

// ── Internal: Cell checkbox ──────────────────────────────────────────────────
function CellCheckbox({
  checked,
  onChange,
  disabled,
  ...props
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  [key: string]: unknown
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className={cn(
        'h-4 w-4 cursor-pointer rounded border-2 border-input accent-primary',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      {...props}
    />
  )
}

export default PermissionMatrix
