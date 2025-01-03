import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ColumnMetadata {
  itemOID: string;
  name: string;
  label: string;
  dataType: string;
  length?: number;
  keySequence?: number;
}

interface MetadataTooltipProps {
  children: React.ReactNode
  metadata: ColumnMetadata
}

export function MetadataTooltip({ children, metadata }: MetadataTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="w-80 p-4">
          <div className="grid gap-2">
            <div className="flex justify-between">
              <span className="font-medium">Item OID:</span>
              <span>{metadata.itemOID}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Name:</span>
              <span>{metadata.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Label:</span>
              <span>{metadata.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Data Type:</span>
              <span>{metadata.dataType}</span>
            </div>
            {metadata.length && (
              <div className="flex justify-between">
                <span className="font-medium">Length:</span>
                <span>{metadata.length}</span>
              </div>
            )}
            {metadata.keySequence && (
              <div className="flex justify-between">
                <span className="font-medium">Key Sequence:</span>
                <span>{metadata.keySequence}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

