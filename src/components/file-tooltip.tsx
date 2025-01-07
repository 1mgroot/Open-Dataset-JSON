import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { FileData, DefineXmlFileMetadata } from "../types/types"

interface FileTooltipProps {
  children: React.ReactNode
  file: FileData
}

interface TopLevelMetadata {
  datasetJSONCreationDateTime?: string
  datasetJSONVersion?: string
  fileOID?: string
  dbLastModifiedDateTime?: string
  originator?: string
  sourceSystem?: {
    name: string
    version: string
  }
  studyOID?: string
  metaDataVersionOID?: string
  metaDataRef?: string
  itemGroupOID?: string
  records?: number
  name?: string
  label?: string
  defineXMLMetadata?: DefineXmlFileMetadata
}

export function FileTooltip({ children, file }: FileTooltipProps) {
  const content = file.content as { columns?: { name: string }[]; records?: number } & TopLevelMetadata
  const columnCount = content.columns?.length ?? 0
  const rowCount = content.records ?? 0

  // Order metadata fields according to the specification
  const orderedMetadata = [
    { key: 'datasetJSONCreationDateTime', label: 'Dataset-JSON Creation DateTime' },
    { key: 'datasetJSONVersion', label: 'Dataset-JSON Version' },
    { key: 'fileOID', label: 'File OID' },
    { key: 'dbLastModifiedDateTime', label: 'db Last Modified DateTime' },
    { key: 'originator', label: 'Originator' },
    { key: 'sourceSystem', label: 'Source System' },
    { key: 'studyOID', label: 'Study OID' },
    { key: 'metaDataVersionOID', label: 'Metadata Version OID' },
    { key: 'metaDataRef', label: 'Metadata Reference' },
    { key: 'itemGroupOID', label: 'Item Group OID' },
    { key: 'records', label: 'Records' },
    { key: 'name', label: 'Name' },
    { key: 'label', label: 'Label' }
  ] as const

  const hasDefineXMLMetadata = content.defineXMLMetadata && Object.keys(content.defineXMLMetadata).length > 0

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="w-[500px] p-4">
          <div className="grid gap-4">
            <div>
              <h4 className="font-semibold mb-2">File Information</h4>
              <div className="grid gap-2">
                <div className="flex justify-between gap-4">
                  <span className="font-medium">Path:</span>
                  <span>{file.path}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-medium">Columns:</span>
                  <span>{columnCount}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-medium">Rows:</span>
                  <span>{rowCount}</span>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Dataset-JSON Metadata</h4>
              <div className="grid gap-2">
                {orderedMetadata.map(({ key, label }) => {
                  const value = content[key as keyof TopLevelMetadata]
                  if (!value && value !== 0) return null

                  if (key === 'sourceSystem' && content.sourceSystem) {
                    return (
                      <div key={key} className="flex justify-between gap-4">
                        <span className="font-medium">{label}:</span>
                        <span>{content.sourceSystem.name} ({content.sourceSystem.version})</span>
                      </div>
                    )
                  }

                  return (
                    <div key={key} className="flex justify-between gap-4">
                      <span className="font-medium">{label}:</span>
                      <span>{value as string | number}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {hasDefineXMLMetadata && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-2">Define-XML Metadata</h4>
                  <div className="grid gap-2">
                    {content.defineXMLMetadata?.creationDateTime && (
                      <div className="flex justify-between gap-4">
                        <span className="font-medium">Creation DateTime:</span>
                        <span>{content.defineXMLMetadata.creationDateTime}</span>
                      </div>
                    )}
                    {content.defineXMLMetadata?.name && (
                      <div className="flex justify-between gap-4">
                        <span className="font-medium">Name:</span>
                        <span>{content.defineXMLMetadata.name}</span>
                      </div>
                    )}
                    {content.defineXMLMetadata?.label && (
                      <div className="flex justify-between gap-4">
                        <span className="font-medium">Label:</span>
                        <span>{content.defineXMLMetadata.label}</span>
                      </div>
                    )}
                    {content.defineXMLMetadata?.hasNoData !== undefined && (
                      <div className="flex justify-between gap-4">
                        <span className="font-medium">Has No Data:</span>
                        <span>{content.defineXMLMetadata.hasNoData ? 'Yes' : 'No'}</span>
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