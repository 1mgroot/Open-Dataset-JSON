"use client"

import { useMemo } from 'react'
import { ColumnMetadata } from '../types/types'

export interface UniqueValue {
  value: string;
  frequency: number;
}

interface UniqueValuesMap {
  [columnName: string]: {
    values: Map<string, number>;
    isNumeric: boolean;
    exceedsLimit: boolean;
  }
}

interface UseUniqueValuesOptions {
  maxUniqueValues?: number;
}

export function useUniqueValues(
  columns: ColumnMetadata[],
  rows: unknown[][],
  options: UseUniqueValuesOptions = {}
) {
  const { maxUniqueValues = 100 } = options

  const uniqueValuesMap = useMemo(() => {
    const map: UniqueValuesMap = {}

    // Initialize map for each column
    columns.forEach((col, index) => {
      const values = new Map<string, number>()
      let isNumeric = true
      let exceedsLimit = false

      // Process each row for this column
      for (const row of rows) {
        const value = row[index]
        const stringValue = String(value ?? '')

        // Check if the value is numeric
        if (isNumeric && isNaN(Number(value)) && value !== null && value !== '') {
          isNumeric = false
        }

        // Update frequency count
        const currentCount = values.get(stringValue) || 0
        values.set(stringValue, currentCount + 1)

        // Check if we've exceeded the limit
        if (values.size > maxUniqueValues) {
          exceedsLimit = true
          values.clear() // Clear the map to save memory
          break
        }
      }

      map[col.name] = {
        values,
        isNumeric,
        exceedsLimit
      }
    })

    return map
  }, [columns, rows, maxUniqueValues])

  return {
    getValues: (columnName: string): UniqueValue[] => {
      const column = uniqueValuesMap[columnName]
      if (!column || column.exceedsLimit) return []
      
      // Convert Map to array of UniqueValue objects and sort by frequency (descending)
      return Array.from(column.values.entries())
        .map(([value, frequency]) => ({ value, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
    },
    isNumericColumn: (columnName: string): boolean => {
      return uniqueValuesMap[columnName]?.isNumeric ?? false
    },
    exceedsLimit: (columnName: string): boolean => {
      return uniqueValuesMap[columnName]?.exceedsLimit ?? false
    },
    hasValues: (columnName: string): boolean => {
      const column = uniqueValuesMap[columnName]
      return column ? !column.exceedsLimit && column.values.size > 0 : false
    }
  }
} 