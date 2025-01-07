"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { PlusCircle, X, Save, Filter, Tag, ChevronDown } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ColumnMetadata } from "../types/types"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useUniqueValues } from "@/hooks/useUniqueValues"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

interface UniqueValue {
  value: string;
  frequency: number;
}

interface FilterCondition {
  id: string
  column: string
  operator: string
  value: string
  selectedValues?: string[]
}

interface FilterBuilderProps {
  columns: ColumnMetadata[]
  onApplyFilter: (filterString: string) => { success: boolean; message: string }
  rows: unknown[][]
}

const OPERATORS = [
  { label: "equals", value: "eq", symbol: "=" },
  { label: "not equals", value: "ne", symbol: "!=" },
  { label: "greater than", value: "gt", symbol: ">" },
  { label: "less than", value: "lt", symbol: "<" },
  { label: "greater than or equal", value: "ge", symbol: ">=" },
  { label: "less than or equal", value: "le", symbol: "<=" },
  { label: "contains", value: "contains", symbol: "contains" },
  { label: "in", value: "in", symbol: "in" },
  { label: "not in", value: "not in", symbol: "not in" },
]

export function FilterBuilder({ columns, onApplyFilter, rows }: FilterBuilderProps) {
  // Client-side only states
  const [conditions, setConditions] = React.useState<FilterCondition[]>([])
  const [savedFilters, setSavedFilters] = React.useState<{ name: string; conditions: FilterCondition[] }[]>([])
  const [showSaveDialog, setShowSaveDialog] = React.useState(false)
  const [filterName, setFilterName] = React.useState("")
  const [showBuilder, setShowBuilder] = React.useState(false)
  const [showColumnNames, setShowColumnNames] = React.useState(false)
  const [filterPreview, setFilterPreview] = React.useState("")

  // Use refs for tracking initialization and updates
  const isInitialized = React.useRef(false)
  const previousRowsLength = React.useRef<number | null>(null)
  const [isClient, setIsClient] = React.useState(false)

  // Initialize client-side state
  React.useEffect(() => {
    setIsClient(true)
    isInitialized.current = true
  }, [])

  // Use the hook
  const uniqueValues = useUniqueValues(columns, rows, { maxUniqueValues: 100 })

  // Track rows changes
  React.useEffect(() => {
    if (!isInitialized.current) return
    const currentLength = rows?.length || 0
    previousRowsLength.current = currentLength
  }, [rows])

  // Compute hasRows directly from props with proper type checking
  const hasRows = React.useMemo(() => {
    return Array.isArray(rows) && rows.length > 0
  }, [rows])

  const addCondition = React.useCallback(() => {
    const newCondition: FilterCondition = {
      id: Math.random().toString(36).substr(2, 9),
      column: columns[0]?.name || "",
      operator: "eq",
      value: "",
      selectedValues: []
    }
    setConditions(prev => [...prev, newCondition])
  }, [columns])

  const removeCondition = React.useCallback((id: string) => {
    setConditions(prev => {
      const newConditions = prev.filter(c => c.id !== id)
      // If removing the last condition, close the dialog
      if (newConditions.length === 0) {
        setShowBuilder(false)
      }
      return newConditions
    })
  }, [])

  const updateCondition = React.useCallback((id: string, updates: Partial<FilterCondition>) => {
    console.group('Updating condition')
    console.log('Condition ID:', id)
    console.log('Updates:', updates)

    setConditions(prev => {
      const updated = prev.map(c => {
        if (c.id !== id) return c
        
        const newCondition = { ...c, ...updates }
        
        // Reset value when operator changes
        if (updates.operator && updates.operator !== c.operator) {
          console.log('Operator changed, resetting values')
          newCondition.value = ""
          newCondition.selectedValues = []
        }
        
        // Reset value when column changes
        if (updates.column && updates.column !== c.column) {
          console.log('Column changed, resetting values')
          newCondition.value = ""
          newCondition.selectedValues = []
        }

        // Ensure selectedValues is always an array for IN/NOT IN operators
        if ((newCondition.operator === 'in' || newCondition.operator === 'not in') && 
            updates.selectedValues) {
          console.log('Updating selected values:', updates.selectedValues)
          newCondition.selectedValues = updates.selectedValues
          // Keep value and selectedValues in sync
          newCondition.value = updates.selectedValues.join(', ')
        }

        console.log('Updated condition:', newCondition)
        return newCondition
      })

      console.log('Updated conditions:', updated)
      console.groupEnd()
      return updated
    })
  }, [])

  const shouldWrapInQuotes = React.useCallback((value: string, operator: string, columnName: string) => {
    if (operator === 'in') return false
    if (uniqueValues.isNumericColumn(columnName)) return false
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) return false
    return true
  }, [uniqueValues])

  const buildFilterString = React.useCallback((conditions: FilterCondition[]): string => {
    const filterString = conditions.map(c => {
      const { column, operator, value, selectedValues } = c

      // Debug logging for filter construction
      console.group('Building filter condition')
      console.log('Column:', column)
      console.log('Operator:', operator)
      console.log('Value:', value)
      console.log('Selected Values:', selectedValues)

      if (operator === "in" || operator === "not in") {
        // Ensure we use selectedValues array for IN/NOT IN
        const values = (selectedValues || [])
          .filter(v => v && v.trim()) // Filter out empty values
          .map(v => {
            const shouldQuote = shouldWrapInQuotes(v, 'eq', column)
            console.log('Processing value:', v, 'Should quote:', shouldQuote)
            return shouldQuote ? `"${v}"` : v
          })

        console.log('Processed values:', values)
        
        // Don't generate empty IN/NOT IN conditions
        if (values.length === 0) {
          console.log('No values selected, skipping condition')
          console.groupEnd()
          return ''
        }

        const condition = `${column} ${operator} (${values.join(', ')})`
        console.log('Generated condition:', condition)
        console.groupEnd()
        return condition
      }

      const processedValue = shouldWrapInQuotes(value, operator, column) ? `"${value}"` : value
      console.log('Generated condition:', `${column} ${operator} ${processedValue}`)
      console.groupEnd()
      return `${column} ${operator} ${processedValue}`
    })
    .filter(Boolean) // Remove empty conditions
    .join(" and ")

    console.log('Final filter string:', filterString)
    return filterString
  }, [shouldWrapInQuotes])

  const getOperatorsForColumn = React.useCallback((columnName: string) => {
    // If the column has too many unique values, exclude both IN and NOT IN operators
    if (uniqueValues.exceedsLimit(columnName)) {
      return OPERATORS.filter(op => op.value !== 'in' && op.value !== 'not in')
    }
    return OPERATORS
  }, [uniqueValues])

  const getColumnTooltip = React.useCallback((col: ColumnMetadata) => {
    if (uniqueValues.exceedsLimit(col.name)) {
      return "This column has too many unique values (>100) to support the 'in' operator"
    }
    return undefined
  }, [uniqueValues])

  const getOperatorTooltip = React.useCallback((operator: string, columnName: string) => {
    if ((operator === 'in' || operator === 'not in') && uniqueValues.exceedsLimit(columnName)) {
      return "The IN/NOT IN operators are not available for columns with more than 100 unique values"
    }
    return undefined
  }, [uniqueValues])

  const applyFilter = React.useCallback(() => {
    const filterString = buildFilterString(conditions)
    onApplyFilter(filterString)
    setShowBuilder(false)
  }, [buildFilterString, conditions, onApplyFilter])

  const saveFilter = React.useCallback(() => {
    if (!filterName.trim()) return
    setSavedFilters(prev => [...prev, { name: filterName, conditions }])
    setFilterName("")
    setShowSaveDialog(false)
  }, [filterName, conditions])

  const loadFilter = React.useCallback((savedConditions: FilterCondition[]) => {
    setConditions(savedConditions)
  }, [])

  const getColumnDisplay = React.useCallback((col: ColumnMetadata) => {
    return showColumnNames ? col.name : (col.label || col.name)
  }, [showColumnNames])

  const renderValueInput = React.useCallback((condition: FilterCondition) => {
    const isInOperator = condition.operator === 'in' || condition.operator === 'not in'
    const columnValues = uniqueValues.getValues(condition.column)
    
    if (isInOperator && columnValues.length > 0) {
      return (
        <div className="flex-1">
          <Select
            value={condition.selectedValues?.join(',')}
            onValueChange={(value) => {
              const selectedValues = condition.selectedValues || []
              const newSelectedValues = selectedValues.includes(value)
                ? selectedValues.filter(v => v !== value)
                : [...selectedValues, value]
              
              updateCondition(condition.id, {
                selectedValues: newSelectedValues,
                value: newSelectedValues.join(', ')
              })
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select values">
                {condition.selectedValues?.length 
                  ? `${condition.selectedValues.length} selected`
                  : "Select values"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <ScrollArea className="h-[280px]">
                <div className="p-1">
                  {columnValues.map(({ value, frequency }) => (
                    <div
                      key={value}
                      className="flex items-center justify-between hover:bg-accent/50 rounded-md px-2 py-1.5 cursor-pointer transition-colors"
                      onClick={(e) => {
                        e.preventDefault()
                        const selectedValues = condition.selectedValues || []
                        const newSelectedValues = selectedValues.includes(value)
                          ? selectedValues.filter(v => v !== value)
                          : [...selectedValues, value]
                        
                        updateCondition(condition.id, {
                          selectedValues: newSelectedValues,
                          value: newSelectedValues.join(', ')
                        })
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary">
                          {(condition.selectedValues || []).includes(value) && (
                            <span className="text-primary text-xs">✓</span>
                          )}
                        </div>
                        <span className="text-sm">{value || "(empty)"}</span>
                      </div>
                      <Badge variant="secondary" className="ml-2 text-xs font-normal">
                        {frequency}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SelectContent>
          </Select>
        </div>
      )
    }

    return (
      <Input
        value={condition.value}
        onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
        placeholder="Enter value..."
        className="flex-1"
      />
    )
  }, [uniqueValues, updateCondition])

  // Update filter preview whenever conditions change
  React.useEffect(() => {
    const newFilterString = buildFilterString(conditions)
    setFilterPreview(newFilterString)
  }, [conditions, buildFilterString])

  // Watch for empty conditions and clear filter
  React.useEffect(() => {
    if (conditions.length === 0) {
      onApplyFilter("") // Clear the filter by applying an empty string
      setFilterPreview("") // Clear the preview
    }
  }, [conditions, onApplyFilter])

  // Early return during SSR
  if (!isClient) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        disabled
      >
        <Filter className="mr-2 h-4 w-4" />
        Filter Builder
      </Button>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-10 px-4"
        onClick={() => setShowBuilder(true)}
        disabled={!hasRows}
      >
        <Filter className="mr-2 h-4 w-4" />
        Filter Builder
      </Button>

      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="sm:max-w-[600px] md:max-w-[800px] lg:max-w-[900px] p-0">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">Filter Builder</DialogTitle>
                <DialogDescription className="mt-1.5">
                  Build complex filters by combining multiple conditions
                </DialogDescription>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColumnNames(!showColumnNames)}
                  className="h-9"
                >
                  <Tag className="mr-2 h-4 w-4" />
                  Show {showColumnNames ? "Labels" : "Names"}
                </Button>
                {conditions.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSaveDialog(true)}
                    className="h-9"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Filter
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 pb-6">
            <div className="space-y-4">
              {conditions.map((condition) => (
                <div key={condition.id} className="flex gap-3 items-start">
                  <Select
                    value={condition.column}
                    onValueChange={(value) => updateCondition(condition.id, { column: value })}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem
                          key={col.name}
                          value={col.name}
                          title={getColumnTooltip(col)}
                        >
                          {getColumnDisplay(col)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(value) => updateCondition(condition.id, { operator: value })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {getOperatorsForColumn(condition.column).map((op) => (
                        <SelectItem
                          key={op.value}
                          value={op.value}
                          title={getOperatorTooltip(op.value, condition.column)}
                        >
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {renderValueInput(condition)}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(condition.id)}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCondition}
                  className="h-9"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Condition
                </Button>

                {conditions.length > 0 && (
                  <Button 
                    onClick={applyFilter}
                    size="sm"
                    className="h-9 px-8"
                  >
                    Apply Filter
                  </Button>
                )}
              </div>

              {conditions.length > 0 && (
                <div className="pt-4">
                  <Separator className="mb-4" />
                  <div className="space-y-2">
                    <Label htmlFor="filter-preview" className="text-sm font-medium">
                      Filter String Preview
                    </Label>
                    <div className="relative">
                      <Input
                        id="filter-preview"
                        value={filterPreview}
                        readOnly
                        className="pr-20 font-mono text-sm bg-muted/50"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-7"
                        onClick={() => {
                          navigator.clipboard.writeText(filterPreview)
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {savedFilters.length > 0 && (
                <div className="border-t mt-6 pt-4">
                  <h4 className="font-medium mb-3">Saved Filters</h4>
                  <div className="space-y-2">
                    {savedFilters.map((filter, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 hover:bg-accent rounded-md"
                      >
                        <span className="text-sm">{filter.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadFilter(filter.conditions)}
                          className="h-8"
                        >
                          Load
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Save Filter</DialogTitle>
            <DialogDescription>
              Give your filter a name to save it for later use
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Filter name..."
              className="h-9"
            />
            <div className="flex justify-end gap-3">
              <DialogClose asChild>
                <Button variant="outline" size="sm" className="h-9">
                  Cancel
                </Button>
              </DialogClose>
              <Button 
                onClick={saveFilter} 
                disabled={!filterName.trim()} 
                size="sm"
                className="h-9"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
} 