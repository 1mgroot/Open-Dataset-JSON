import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { FolderData } from "../types/types"

interface FolderTooltipProps {
  children: React.ReactNode
  folder: FolderData
}

export function FolderTooltip({ children, folder }: FolderTooltipProps) {
  const totalRows = folder.files.reduce((sum, file) => {
    const content = file.content as { rows?: unknown[][] }
    return sum + (content.rows?.length ?? 0)
  }, 0)

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="p-3">
          <div className="grid gap-2">
            <div className="flex justify-between gap-4">
              <span className="font-medium">Path:</span>
              <span>{folder.path}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-medium">Files:</span>
              <span>{folder.files.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-medium">Total Rows:</span>
              <span>{totalRows}</span>
            </div>
            {folder.defineXmlPath && (
              <div className="flex justify-between gap-4">
                <span className="font-medium">Define-XML:</span>
                <span>Yes</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
} 