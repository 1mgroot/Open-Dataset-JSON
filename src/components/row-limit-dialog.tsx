import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface RowLimitDialogProps {
  open: boolean
  onClose: () => void
  rowCount: number
  maxRows: number
}

export function RowLimitDialog({ open, onClose, rowCount, maxRows }: RowLimitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>File Too Large</DialogTitle>
          <DialogDescription>
            This file contains {rowCount.toLocaleString()} rows, which exceeds the maximum limit of {maxRows.toLocaleString()} rows.
            Please try a smaller file or use a different viewer for large files.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 