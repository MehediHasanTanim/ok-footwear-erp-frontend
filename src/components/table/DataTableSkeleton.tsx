import { type Table } from '@tanstack/react-table'

interface DataTableSkeletonProps<T extends object> {
  table: Table<T>
  /** Number of skeleton rows to render */
  count?: number
}

export function DataTableSkeleton<T extends object>({
  table,
  count = 10,
}: DataTableSkeletonProps<T>) {
  const columns = table.getAllColumns()

  return (
    <>
      {Array.from({ length: count }).map((_, rowIdx) => (
        <tr key={`skeleton-${rowIdx}`} className="border-b">
          {columns.map((col, colIdx) => (
            <td key={colIdx} className="px-4 py-3" style={{ width: col.getSize() }}>
              <div className="h-4 animate-pulse rounded bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
