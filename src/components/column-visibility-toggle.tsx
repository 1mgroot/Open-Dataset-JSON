import * as React from "react"
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

interface ColumnVisibilityToggleProps {
  columns: { name: string; label: string }[]
  visibleColumns: string[]
  onToggleColumn: (columnName: string) => void
  showColumnNames: boolean
}

export function ColumnVisibilityToggle({
  columns = [],
  visibleColumns = [],
  onToggleColumn,
  showColumnNames = false,
}: ColumnVisibilityToggleProps) {
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredColumns = React.useMemo(() => {
    const searchTerm = searchQuery.toLowerCase()
    return columns.filter(column => {
      const searchValue = showColumnNames ? column.name : column.label
      return searchValue.toLowerCase().includes(searchTerm)
    })
  }, [columns, searchQuery, showColumnNames])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          size="sm"
          className="h-9 w-[200px] justify-between"
        >
          {`${visibleColumns.length} columns selected`}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]">
        <div className="p-2">
          <Input
            placeholder={`Search ${showColumnNames ? 'names' : 'labels'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
          {filteredColumns.length === 0 ? (
            <DropdownMenuItem disabled>
              No columns found
            </DropdownMenuItem>
          ) : (
            filteredColumns.map((column) => (
              <DropdownMenuItem
                key={column.name}
                onSelect={(e) => {
                  e.preventDefault()
                  onToggleColumn(column.name)
                }}
                className="flex items-center gap-2"
                textValue=""
                onKeyDown={(e) => {
                  e.preventDefault()
                }}
              >
                <div
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                    visibleColumns.includes(column.name)
                      ? "bg-primary text-primary-foreground"
                      : "opacity-50 [&_svg]:invisible"
                  )}
                >
                  <Check className={cn("h-4 w-4")} />
                </div>
                <span>{showColumnNames ? column.name : column.label}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

