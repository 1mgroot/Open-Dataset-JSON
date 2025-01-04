export interface FileData {
  name: string
  content: Record<string, unknown>
  path: string
}

export interface FolderData {
  name: string
  path: string
  files: FileData[]
}

export interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

export interface ColumnMetadata {
  itemOID: string
  name: string
  label: string
  dataType: string
  length?: number
  keySequence?: number
}

