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
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="p-4">
          <div>
            <h4 className="font-semibold mb-2">Folder Information</h4>
            <div className="grid gap-2">
              <div className="flex justify-between gap-4">
                <span className="font-medium">Path:</span>
                <span className="text-right">{folder.path}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-medium">Files:</span>
                <span>{folder.files.length}</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
} 