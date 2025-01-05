import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { ColumnMetadata } from "../types/types"

interface MetadataTooltipProps {
  children: React.ReactNode
  metadata: ColumnMetadata
}

export function MetadataTooltip({ children, metadata }: MetadataTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="w-[400px] p-4">
          <div className="grid gap-4">
            <div>
              <h4 className="font-semibold mb-2">Dataset-JSON Metadata</h4>
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
            </div>

            {metadata.defineXmlMetadata && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-2">Define-XML Metadata</h4>
                  <div className="grid gap-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Item OID:</span>
                      <span>{metadata.defineXmlMetadata.itemOID}</span>
                    </div>
                    {metadata.defineXmlMetadata.orderNumber && (
                      <div className="flex justify-between">
                        <span className="font-medium">Order Number:</span>
                        <span>{metadata.defineXmlMetadata.orderNumber}</span>
                      </div>
                    )}
                    {metadata.defineXmlMetadata.mandatory && (
                      <div className="flex justify-between">
                        <span className="font-medium">Mandatory:</span>
                        <span>{metadata.defineXmlMetadata.mandatory}</span>
                      </div>
                    )}
                    {metadata.defineXmlMetadata.methodOID && (
                      <div className="flex justify-between">
                        <span className="font-medium">Method OID:</span>
                        <span>{metadata.defineXmlMetadata.methodOID}</span>
                      </div>
                    )}
                    {metadata.defineXmlMetadata.whereClauseOID && (
                      <div className="flex justify-between">
                        <span className="font-medium">Where Clause OID:</span>
                        <span>{metadata.defineXmlMetadata.whereClauseOID}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

