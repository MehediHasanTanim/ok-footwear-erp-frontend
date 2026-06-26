import { type Table } from '@tanstack/react-table'
import { Download, Search, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { exportToCSV } from '@/lib/export'

interface DataTableToolbarProps<T extends object> {
  table: Table<T>
  tableId: string
  searchValue: string
  onSearchChange: (value: string) => void
  visibleColumnIds: Set<string>
}

export function DataTableToolbar<T extends object>({
  table,
  tableId,
  searchValue,
  onSearchChange,
  visibleColumnIds,
}: DataTableToolbarProps<T>) {
  const { t } = useTranslation()

  const handleExport = () => {
    exportToCSV(
      table.getFilteredRowModel().rows.map((r) => r.original),
      table.getAllColumns().map((c) => c.columnDef),
      visibleColumnIds,
      `${tableId}-export.csv`
    )
  }

  return (
    <div className="flex items-center gap-2 py-2">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('common.search')}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Column visibility toggle */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Columns
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {table
            .getAllColumns()
            .filter((col) => col.getCanHide())
            .map((col) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={col.getIsVisible()}
                onCheckedChange={(value) => col.toggleVisibility(!!value)}
              >
                {col.id}
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* CSV export */}
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
    </div>
  )
}
