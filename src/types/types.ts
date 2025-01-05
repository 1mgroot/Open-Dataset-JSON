export interface FileData {
  name: string
  content: Record<string, unknown>
  path: string
  rawFile: File
}

export interface FolderData {
  name: string
  path: string
  files: FileData[]
  defineXmlPath?: string
}

export interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

export interface DefineXmlMetadata {
  itemOID: string
  mandatory?: string
  methodOID?: string
  orderNumber?: string
  whereClauseOID?: string
}

export interface DefineXmlFileMetadata {
  creationDateTime?: string
  name?: string
  label?: string
  hasNoData?: boolean
}

export interface ColumnMetadata {
  itemOID: string
  name: string
  label: string
  dataType: string
  length?: number
  keySequence?: number
  defineXmlMetadata?: DefineXmlMetadata
}

