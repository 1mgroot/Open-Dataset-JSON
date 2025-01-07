"use client"

import { useMemo } from 'react'
import { ColumnMetadata } from '../types/types'

interface UniqueValuesMap {
  [columnName: string]: {
    values: Set<string>;
    isNumeric: boolean;
    exceedsLimit: boolean;
  }
}

interface UseUniqueValuesOptions {
  debug?: boolean;
  maxUniqueValues?: number;
}

export function useUniqueValues(
  columns: ColumnMetadata[],
  rows: unknown[][],
  options: UseUniqueValuesOptions = {}
) {
  const { debug = false, maxUniqueValues = 100 } = options

  const uniqueValuesMap = useMemo(() => {
    const map: UniqueValuesMap = {}

    // Initialize map for each column
    columns.forEach((col, index) => {
      const values = new Set<string>()
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

        values.add(stringValue)

        // Check if we've exceeded the limit
        if (values.size > maxUniqueValues) {
          exceedsLimit = true
          values.clear() // Clear the set to save memory
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
    getValues: (columnName: string): string[] => {
      const column = uniqueValuesMap[columnName]
      if (!column || column.exceedsLimit) return []
      return Array.from(column.values).sort()
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