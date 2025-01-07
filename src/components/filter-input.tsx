import { useState, useCallback } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

interface FilterInputProps {
  onFilter: (filterString: string) => { success: boolean; message: string }
}

export function FilterInput({ onFilter }: FilterInputProps) {
  const [filterString, setFilterString] = useState('')
  const [filterResult, setFilterResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleFilter = useCallback(() => {
    const result = onFilter(filterString)
    setFilterResult(result)
    setTimeout(() => setFilterResult(null), 5000) // Hide the message after 5 seconds
  }, [filterString, onFilter])

  const handleClear = useCallback(() => {
    setFilterString('')
    const result = onFilter('')
    setFilterResult(result)
    setTimeout(() => setFilterResult(null), 5000)
  }, [onFilter])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFilter()
    } else if (e.key === 'Escape') {
      handleClear()
    }
  }, [handleFilter, handleClear])

  return (
    <div className="w-full space-y-4">
      <div className="flex w-full gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Enter filter criteria (e.g., USUBJID = 'CDISC001' or LBSEQ > 20)"
            value={filterString}
            onChange={(e) => setFilterString(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pr-8"
          />
          {filterString && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-sm hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button onClick={handleFilter} className="whitespace-nowrap">Apply Filter</Button>
      </div>
      {filterResult && (
        <Alert variant={filterResult.success ? "default" : "destructive"}>
          {filterResult.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>{filterResult.success ? "Success" : "Error"}</AlertTitle>
          <AlertDescription>{filterResult.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

