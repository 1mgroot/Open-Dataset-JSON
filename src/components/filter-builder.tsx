"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { PlusCircle, X, Save, Filter, Tag } from "lucide-react"
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
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ColumnMetadata } from "../types/types"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useUniqueValues } from "@/hooks/useUniqueValues"

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
    setConditions(prev => prev.filter(c => c.id !== id))
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
        size="default"
        onClick={() => setShowBuilder(true)}
        className="h-10 px-4"
        disabled={!hasRows}
        title={!hasRows ? "Please wait while data is loading..." : "Open filter builder"}
      >
        <Filter className="mr-2 h-4 w-4" />
        {hasRows ? "Filter Builder" : "Loading..."}
      </Button>

      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Build Filter</DialogTitle>
            <DialogDescription>
              {hasRows ? (
                "Create complex filters by adding conditions"
              ) : (
                "Loading data, please wait..."
              )}
            </DialogDescription>
          </DialogHeader>

          {hasRows ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColumnNames(!showColumnNames)}
                  className="h-8"
                >
                  <Tag className="mr-2 h-4 w-4" />
                  {showColumnNames ? "Show Labels" : "Show Names"}
                </Button>
              </div>

              {/* Conditions */}
              <div className="space-y-2">
                {conditions.map((condition) => (
                  <div key={condition.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Select
                        value={condition.column}
                        onValueChange={(value) => updateCondition(condition.id, { column: value })}
                      >
                        <SelectTrigger 
                          className="w-full"
                          title={getColumnTooltip(columns.find(col => col.name === condition.column)!)}
                        >
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          <ScrollArea className="h-[200px]">
                            {columns.map((col) => (
                              <SelectItem 
                                key={col.name} 
                                value={col.name}
                                title={getColumnTooltip(col)}
                              >
                                {getColumnDisplay(col)}
                                {uniqueValues.exceedsLimit(col.name) && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    (many values)
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-3">
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => updateCondition(condition.id, { operator: value })}
                      >
                        <SelectTrigger 
                          className="w-full"
                          title={getOperatorTooltip(condition.operator, condition.column)}
                        >
                          <SelectValue placeholder="Select operator" />
                        </SelectTrigger>
                        <SelectContent>
                          {getOperatorsForColumn(condition.column).map((op) => (
                            <SelectItem 
                              key={op.value} 
                              value={op.value}
                              title={getOperatorTooltip(op.value, condition.column)}
                            >
                              {op.label} ({op.symbol})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-4">
                      {(condition.operator === "in" || condition.operator === "not in") && !uniqueValues.exceedsLimit(condition.column) ? (
                        <Select
                          value={condition.selectedValues?.join(',')}
                          onValueChange={(value) => {
                            console.group('Value selection change')
                            console.log('Current value:', value)
                            console.log('Current selected values:', condition.selectedValues)

                            const currentValues = condition.selectedValues || []
                            const newValues = currentValues.includes(value)
                              ? currentValues.filter(v => v !== value)
                              : [...currentValues, value]

                            console.log('New selected values:', newValues)
                            console.groupEnd()

                            updateCondition(condition.id, { 
                              selectedValues: newValues,
                              value: newValues.join(', ')
                            })
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {condition.selectedValues?.length 
                                ? `${condition.selectedValues.length} selected`
                                : "Select values"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <ScrollArea className="h-[200px]">
                              {uniqueValues.getValues(condition.column).map((value) => (
                                <SelectItem 
                                  key={value} 
                                  value={value}
                                  className="relative flex items-center"
                                >
                                  <div className="flex items-center">
                                    <div className="w-4 h-4 mr-2 border rounded flex items-center justify-center">
                                      {condition.selectedValues?.includes(value) && (
                                        <span className="text-primary">✓</span>
                                      )}
                                    </div>
                                    {value}
                                  </div>
                                </SelectItem>
                              ))}
                            </ScrollArea>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={condition.value}
                          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                          className="w-full"
                          placeholder="Enter value"
                        />
                      )}
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCondition(condition.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Condition Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={addCondition}
                className="w-full"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Condition
              </Button>

              {/* Saved Filters */}
              {savedFilters.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Saved Filters</h4>
                  <div className="flex flex-wrap gap-2">
                    {savedFilters.map((filter, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => loadFilter(filter.conditions)}
                      >
                        {filter.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                  disabled={conditions.length === 0}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Filter
                </Button>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBuilder(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={applyFilter}
                    disabled={conditions.length === 0}
                  >
                    Apply Filter
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Loading data, please wait...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Save Filter Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter</DialogTitle>
            <DialogDescription>
              Give your filter a name to save it for later use
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Enter filter name"
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={saveFilter}
                disabled={!filterName.trim()}
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