import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2 } from 'lucide-react'
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

  const handleFilter = () => {
    const result = onFilter(filterString)
    setFilterResult(result)
    setTimeout(() => setFilterResult(null), 5000) // Hide the message after 5 seconds
  }

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <Input
          type="text"
          placeholder="Enter filter criteria (e.g., USUBJID = 'CDISC001' or LBSEQ > 20)"
          value={filterString}
          onChange={(e) => setFilterString(e.target.value)}
          className="flex-grow"
        />
        <Button onClick={handleFilter}>Apply Filter</Button>
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

