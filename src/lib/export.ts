import { type ColumnDef } from '@tanstack/react-table'
import { unparse } from 'papaparse'

/**
 * Export visible data to CSV using PapaParse.
 * Only columns with `meta?.exportable !== false` and currently visible are included.
 */
export function exportToCSV<T extends object>(
  data: T[],
  columns: ColumnDef<T>[],
  visibleColumnIds: Set<string>,
  filename = 'export.csv'
): void {
  // Filter to visible, exportable columns
  const exportColumns = columns.filter((col) => {
    const id = (col as { id?: string }).id ?? (col as { accessorKey?: string }).accessorKey
    if (!id) return false
    if (!visibleColumnIds.has(id)) return false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((col.meta as any)?.exportable === false) return false
    return true
  })

  // Build rows: extract the accessor value for each visible column
  const rows = data.map((row) => {
    const result: Record<string, string> = {}
    for (const col of exportColumns) {
      const id = (col as { id?: string }).id ?? (col as { accessorKey?: string }).accessorKey
      if (!id) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (row as any)[id]
      result[id] = value != null ? String(value) : ''
    }
    return result
  })

  const csv = unparse(rows, {
    header: true,
    columns: exportColumns.map(
      (col) => (col as { id?: string }).id ?? (col as { accessorKey?: string }).accessorKey ?? ''
    ),
  })

  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
