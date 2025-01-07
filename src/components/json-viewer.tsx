'use client'

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Folder, Menu, Tag } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { SortButton } from './sort-button'
import { FilterInput } from './filter-input'
import { ColumnVisibilityToggle } from './column-visibility-toggle'
import { TableComponent } from './table-component'
import { PaginationControls } from './pagination-controls'
import { FolderData, FileData, SortConfig, ColumnMetadata, DefineXmlMetadata, DefineXmlFileMetadata } from '../types/types'
import { FileTooltip } from './file-tooltip'
import { FolderTooltip } from './folder-tooltip'
import { Progress } from "@/components/ui/progress"
import { RowLimitDialog } from './row-limit-dialog'
import { FilterBuilder } from './filter-builder'
import { UniqueValuesTree } from './unique-values-tree'
import { useUniqueValues, UniqueValue } from '../hooks/useUniqueValues'

declare global {
  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    }
  }
}

const ROWS_PER_PAGE = 30
const MAX_ROWS_ALLOWED = 460000 // Maximum number of rows allowed

async function parseDefineXml(xmlText: string) {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
  const itemRefs = xmlDoc.getElementsByTagName('ItemRef')
  const metadata = new Map<string, DefineXmlMetadata>()

  // Parse file-level metadata
  const odm = xmlDoc.getElementsByTagName('ODM')[0]
  const fileMetadata: DefineXmlFileMetadata = {
    creationDateTime: odm?.getAttribute('CreationDateTime') || undefined,
    name: odm?.getElementsByTagName('ItemGroupDef')[0]?.getAttribute('Name') || undefined,
    label: odm?.getElementsByTagName('ItemGroupDef')[0]?.getElementsByTagName('Description')[0]?.textContent || undefined,
    hasNoData: odm?.getElementsByTagName('ItemGroupDef')[0]?.getAttribute('def:HasNoData') === 'Yes'
  }

  for (const itemRef of Array.from(itemRefs)) {
    const itemOID = itemRef.getAttribute('ItemOID')
    if (!itemOID) continue

    metadata.set(itemOID, {
      itemOID,
      orderNumber: itemRef.getAttribute('OrderNumber') || undefined,
      mandatory: itemRef.getAttribute('Mandatory') || undefined,
      methodOID: itemRef.getAttribute('MethodOID') || undefined,
      whereClauseOID: itemRef.getElementsByTagName('def:WhereClauseRef')[0]?.getAttribute('WhereClauseOID') || undefined
    })
  }

  return { metadata, fileMetadata }
}

// Combine related state into a single object
interface FileViewerState {
  currentPage: number;
  sortConfig: SortConfig[];
  activeFilter: string;
  filteredRows: unknown[][];
  columnOrder: string[];
  visibleColumns: string[];
  loadingProgress: number;
  isLoadingRows: boolean;
  totalRowCount: number;
}

// Add new type for progress state
interface ProgressState {
  total: number;
  current: number;
  message: string;
}

export default function JsonViewer() {
  const [subfolders, setSubfolders] = useState<FolderData[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showColumnNames, setShowColumnNames] = useState(false)
  const [showFormatDialog, setShowFormatDialog] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'ndjson'>('json')
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null)
  const [pendingDirEntry, setPendingDirEntry] = useState<FileSystemDirectoryEntry | null>(null)
  const [showRowLimitDialog, setShowRowLimitDialog] = useState(false)
  const [rowLimitInfo, setRowLimitInfo] = useState<{ rowCount: number, maxRows: number } | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [showUniqueValues, setShowUniqueValues] = useState(false)

  // Combine related state into a single object to prevent partial updates
  const [viewerState, setViewerState] = useState<FileViewerState>({
    currentPage: 1,
    sortConfig: [],
    activeFilter: '',
    filteredRows: [],
    columnOrder: [],
    visibleColumns: [],
    loadingProgress: 0,
    isLoadingRows: false,
    totalRowCount: 0
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Memoize selected folder and file data
  const selectedFolderData = useMemo(() => 
    subfolders.find(f => f.path === selectedFolder),
    [subfolders, selectedFolder]
  )

  const selectedFileData = useMemo(() => 
    selectedFolderData?.files.find(f => f.name === selectedFile),
    [selectedFolderData, selectedFile]
  )

  // Memoize columns
  const columns = useMemo(() => 
    (selectedFileData?.content as { columns?: ColumnMetadata[] })?.columns || [],
    [selectedFileData]
  )

  // Memoize rows with loading state
  const rows = useMemo(() => {
    if (viewerState.isLoadingRows) {
      return []
    }
    
    const fileRows = (selectedFileData?.content as { rows?: unknown[][] })?.rows
    return Array.isArray(fileRows) ? fileRows : []
  }, [selectedFileData, viewerState.isLoadingRows])

  // Update loadFileRows to handle loading state properly
  const loadFileRows = useCallback(async (fileData: FileData) => {
    const recordCount = Number(fileData.content.records || 0)
    
    if (recordCount > MAX_ROWS_ALLOWED) {
      setRowLimitInfo({ rowCount: recordCount, maxRows: MAX_ROWS_ALLOWED })
      setShowRowLimitDialog(true)
      setViewerState(prev => ({ ...prev, isLoadingRows: false }))
      return
    }

    try {
      setViewerState(prev => ({ ...prev, isLoadingRows: true }))
      // Start loading
      setProgress({
        total: 100,
        current: 1,
        message: `Reading file: ${fileData.name}`
      })

      // Read file in chunks to show progress
      const chunkSize = 1024 * 1024 // 1MB chunks
      const fileSize = fileData.rawFile.size
      let loadedSize = 0
      let content = ''

      // Read file in chunks
      while (loadedSize < fileSize) {
        const blob = fileData.rawFile.slice(loadedSize, loadedSize + chunkSize)
        const chunk = await blob.text()
        content += chunk
        loadedSize += chunk.length

        // Calculate exact reading progress (0-50%)
        const readingProgress = Math.round((loadedSize / fileSize) * 50)
        setProgress(prev => prev ? {
          ...prev,
          current: readingProgress,
          message: `Reading file: ${readingProgress}%`
        } : null)

        // Small delay to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0))
      }

      // Update progress for parsing phase (50-75%)
      setProgress(prev => prev ? {
        ...prev,
        current: 50,
        message: 'Parsing data...'
      } : null)

      let rows: unknown[][] = []
      
      // Check if it's NDJSON by looking at the file extension
      if (fileData.name.endsWith('.ndjson')) {
        const lines = content.split(/\r?\n/).filter(line => line.trim())
        const totalLines = lines.length - 1 // Exclude metadata line
        let processedLines = 0

        // Skip the first line (metadata) and parse each subsequent line
        rows = []
        for (const line of lines.slice(1)) {
          try {
            rows.push(JSON.parse(line))
          } catch {
            rows.push([])
          }
          processedLines++

          // Update progress for NDJSON parsing (50-75%)
          if (processedLines % 1000 === 0) {
            const parsingProgress = 50 + Math.round((processedLines / totalLines) * 25)
            setProgress(prev => prev ? {
              ...prev,
              current: parsingProgress,
              message: `Processing NDJSON data: ${Math.round((processedLines / totalLines) * 100)}%`
            } : null)
            await new Promise(resolve => setTimeout(resolve, 0))
          }
        }
      } else {
        // Regular JSON parsing
        setProgress(prev => prev ? {
          ...prev,
          current: 60,
          message: 'Processing JSON data...'
        } : null)
        const parsedContent = JSON.parse(content)
        rows = parsedContent.rows || []
      }

      // Update progress for final processing (75-90%)
      setProgress(prev => prev ? {
        ...prev,
        current: 75,
        message: 'Preparing data for display...'
      } : null)

      // Update both the file content and viewer state
      fileData.content.rows = rows // Store the rows in the file content
      setViewerState(prev => ({
        ...prev,
        filteredRows: rows,
        totalRowCount: rows.length,
        isLoadingRows: false, // Clear loading state after rows are loaded
        activeFilter: '', // Reset active filter when loading new file
        currentPage: 1 // Reset to first page
      }))

      // Final UI update (95-100%)
      setProgress(prev => prev ? {
        ...prev,
        current: 95,
        message: 'Updating display...'
      } : null)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Complete
      setProgress(prev => prev ? {
        ...prev,
        current: 100,
        message: 'Complete'
      } : null)

      // Clear progress after a short delay
      setTimeout(() => setProgress(null), 500)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setViewerState(prev => ({ ...prev, isLoadingRows: false }))
      setProgress({
        total: 100,
        current: 100,
        message: `Error loading file: ${errorMessage}`
      })
      setTimeout(() => setProgress(null), 2000)
    }
  }, [])

  const resetState = useCallback(() => {
    setViewerState(prev => ({
      ...prev,
      currentPage: 1,
      sortConfig: [],
      activeFilter: '',
      filteredRows: [],
      isLoadingRows: true // Set loading state when resetting
    }))
  }, [])

  // Update effect for initial folder selection
  useEffect(() => {
    if (subfolders.length > 0 && !selectedFolder) {
      const firstFolder = subfolders[0]
      setSelectedFolder(firstFolder.path)
      if (firstFolder.files.length > 0) {
        setSelectedFile(firstFolder.files[0].name)
      }
    }
  }, [subfolders, selectedFolder])

  // Update effect for folder change with proper dependency
  useEffect(() => {
    const currentFolder = subfolders.find(folder => folder.path === selectedFolder)
    if (currentFolder && currentFolder.files.length > 0) {
      const firstFile = currentFolder.files[0]
      setSelectedFile(firstFile.name)
      loadFileRows(firstFile)
    } else {
      setSelectedFile('')
    }
    resetState()
  }, [selectedFolder, subfolders, resetState, loadFileRows])

  // Update effect for column order
  useEffect(() => {
    const fileColumns = (selectedFileData?.content as { columns?: ColumnMetadata[] })?.columns
    if (Array.isArray(fileColumns) && fileColumns.length > 0) {
      const newColumnOrder = fileColumns.map((col: ColumnMetadata) => col.name)
      setViewerState(prev => ({
        ...prev,
        columnOrder: newColumnOrder,
        visibleColumns: newColumnOrder
      }))
    }
  }, [selectedFileData])

  // Memoize filter function
  const applyFilter = useCallback((filterString: string) => {
    if (!selectedFileData) return { success: false, message: "No file selected" }
    
    // Get the current rows from the file content
    const currentRows = (selectedFileData.content.rows as unknown[][]) || []
    
    // If filter is empty, show all rows
    if (!filterString.trim()) {
      setViewerState(prev => ({ 
        ...prev, 
        filteredRows: currentRows,
        activeFilter: '',
        currentPage: 1
      }))
      return { success: true, message: `Filter cleared. Showing all ${currentRows.length.toLocaleString()} rows` }
    }

    try {
      const fileColumns = selectedFileData.content.columns as ColumnMetadata[]
      let processedFilter = filterString
        .replace(/\band\b/gi, '&&')
        .replace(/\bor\b/gi, '||')
        // Support SAS operators
        .replace(/\beq\b/gi, '===')
        .replace(/\bne\b/gi, '!==')
        .replace(/\bgt\b/gi, '>')
        .replace(/\blt\b/gi, '<')
        .replace(/\bge\b/gi, '>=')
        .replace(/\ble\b/gi, '<=')
        .replace(/\bcontains\b/gi, 'includes')

      // Handle IN and NOT IN operators
      processedFilter = processedFilter.replace(
        /([a-zA-Z_][a-zA-Z0-9_]*)\s*(in|not in)\s*\((.*?)\)/gi,
        (match, colName, operator, values) => {
          const columnIndex = fileColumns.findIndex(col => col.name === colName)
          if (columnIndex === -1) {
            throw new Error(`Unknown column: ${colName}`)
          }

          // Split values and clean them
          const valueList = values
            .split(',')
            .map((v: string) => v.trim())
            .filter((v: string): boolean => Boolean(v))
            .map((v: string) => v.replace(/^["']|["']$/g, '')) // Remove quotes

          if (operator.toLowerCase() === 'in') {
            return `[${valueList.map((v: string) => `"${v}"`).join(',')}].includes(String(row[${columnIndex}]))`
          } else { // not in
            return `![${valueList.map((v: string) => `"${v}"`).join(',')}].includes(String(row[${columnIndex}]))`
          }
        }
      )

      // Handle other operators
      processedFilter = processedFilter.replace(
        /([a-zA-Z_][a-zA-Z0-9_]*)\s*(===|!==|>|<|>=|<=|=|!=|includes)\s*(["']?)([^"'\s]+)(["']?)/g,
        (match, colName, operator, quote1, value, quote2) => {
          const columnIndex = fileColumns.findIndex(col => col.name === colName)
          if (columnIndex === -1) {
            throw new Error(`Unknown column: ${colName}`)
          }
          const processedValue = quote1 || quote2 ? `${quote1}${value}${quote2}` : value
          let jsOperator = operator
          // Convert = to === and != to !==
          if (operator === '=') jsOperator = '==='
          if (operator === '!=') jsOperator = '!=='
          // Handle 'includes' operator
          if (operator === 'includes') {
            return `String(row[${columnIndex}]).includes(${processedValue})`
          }
          return `String(row[${columnIndex}]) ${jsOperator} ${processedValue}`
        }
      )

      console.group('Filter Processing')
      console.log('Original filter:', filterString)
      console.log('Processed filter:', processedFilter)
      console.groupEnd()

      const filterFunction = new Function('row', `
        try {
          return ${processedFilter}
        } catch (error) {
          console.error('Filter evaluation error:', error)
          return false
        }
      `)

      setProgress({
        total: currentRows.length,
        current: 0,
        message: 'Starting filter...'
      })

      // Process rows in chunks to avoid blocking the UI
      const chunkSize = 5000
      const filtered: unknown[][] = []
      let processedCount = 0

      const processChunk = () => {
        const chunk = currentRows.slice(processedCount, processedCount + chunkSize)
        const matchedRows = chunk.filter((row: unknown[]) => {
          try {
            return filterFunction(row)
          } catch {
            return false
          }
        })
        filtered.push(...matchedRows)
        processedCount += chunk.length

        const progress = Math.round((processedCount / currentRows.length) * 100)
        setProgress(prev => prev ? {
          ...prev,
          current: progress,
          message: `Processing rows: ${progress}% (${filtered.length.toLocaleString()} matches found)`
        } : null)

        setViewerState(prev => ({ 
          ...prev, 
          filteredRows: filtered,
          activeFilter: filterString,
          currentPage: 1
        }))

        if (processedCount < currentRows.length) {
          setTimeout(processChunk, 0) // Continue with next chunk
        } else {
          setProgress(null) // Clear progress immediately when done
          // Return final result message through the filter callback
          return {
            success: true,
            message: filtered.length > 0
              ? `Found ${filtered.length.toLocaleString()} matching rows out of ${currentRows.length.toLocaleString()} total rows`
              : 'No matching rows found'
          }
        }
      }

      const result = processChunk() // Start processing
      if (result) return result // Return result if processing completed synchronously

      return {
        success: true,
        message: 'Processing rows...'
      }
    } catch (error) {
      console.error('Filter error:', error)
      setProgress(null)
      setViewerState(prev => ({ 
        ...prev, 
        filteredRows: currentRows,
        activeFilter: '',
        currentPage: 1
      }))
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Invalid filter criteria. Please check your input." 
      }
    }
  }, [selectedFileData])

  // Update effect for filter
  useEffect(() => {
    if (rows.length > 0 && !viewerState.isLoadingRows) {
      applyFilter(viewerState.activeFilter)
    }
  }, [rows, viewerState.activeFilter, viewerState.isLoadingRows, applyFilter])

  // Memoize sorted rows
  const sortedRows = useMemo(() => {
    if (viewerState.sortConfig.length === 0) return viewerState.filteredRows

    return [...viewerState.filteredRows].sort((a: unknown[], b: unknown[]) => {
      for (const sort of viewerState.sortConfig) {
        const index = viewerState.columnOrder.indexOf(sort.key)
        if (index === -1) continue

        const aVal = String(a[index] ?? '')
        const bVal = String(b[index] ?? '')
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [viewerState.filteredRows, viewerState.columnOrder, viewerState.sortConfig])

  // Memoize pagination values
  const paginationValues = useMemo(() => {
    const totalPages = Math.ceil(sortedRows.length / ROWS_PER_PAGE)
    const startIndex = (viewerState.currentPage - 1) * ROWS_PER_PAGE
    const endIndex = startIndex + ROWS_PER_PAGE
    const currentRows = sortedRows.slice(startIndex, endIndex)
    return { totalPages, currentRows, startIndex, endIndex }
  }, [sortedRows, viewerState.currentPage])

  // Update handleFileChange to handle loading state
  const handleFileChange = useCallback((fileName: string) => {
    const fileData = selectedFolderData?.files.find(f => f.name === fileName)
    
    if (!fileData) return
    
    setSelectedFile(fileName)
    setViewerState(prev => ({
      ...prev,
      isLoadingRows: true // Set loading state before loading rows
    }))
    
    // Use setTimeout to ensure state updates before loading rows
    setTimeout(() => {
      resetState()
      loadFileRows(fileData)
    }, 0)
  }, [selectedFolderData, resetState, loadFileRows])

  const handleSort = useCallback((columnName: string) => {
    const columnIndex = columns.findIndex((col: ColumnMetadata) => col.name === columnName)
    if (columnIndex === -1) return

    setViewerState(prev => {
      const existingSort = prev.sortConfig.find(s => s.key === columnName)
      if (existingSort) {
        if (existingSort.direction === 'asc') {
          return {
            ...prev,
            sortConfig: prev.sortConfig.map(s => 
              s.key === columnName ? { ...s, direction: 'desc' as const } : s
            )
          }
        } else {
          return {
            ...prev,
            sortConfig: prev.sortConfig.filter(s => s.key !== columnName)
          }
        }
      } else {
        return {
          ...prev,
          sortConfig: [...prev.sortConfig, { key: columnName, direction: 'asc' as const }]
        }
      }
    })
  }, [columns])

  const handleToggleColumn = useCallback((columnName: string) => {
    setViewerState(prev => ({
      ...prev,
      visibleColumns: prev.visibleColumns.includes(columnName)
        ? prev.visibleColumns.filter(col => col !== columnName)
        : [...prev.visibleColumns, columnName]
    }))
  }, [])

  const handleColumnOrderChange = useCallback((newOrder: string[]) => {
    setViewerState(prev => ({
      ...prev,
      columnOrder: newOrder,
      visibleColumns: newOrder.filter(col => prev.visibleColumns.includes(col))
    }))
  }, [])

  const processFiles = async (files: FileList, format: 'json' | 'ndjson') => {
    const rootPath = files[0].webkitRelativePath.split('/')[0]
    const folderMap = new Map<string, FolderData>()
    let defineXmlMetadata: Map<string, DefineXmlMetadata> | null = null
    let defineXmlFileMetadata: DefineXmlFileMetadata | null = null

    // Start loading
    setProgress({
      total: 100,
      current: 1,
      message: 'Scanning files...'
    })

    // First, look for define.xml
    for (const file of Array.from(files)) {
      if (file.name.toLowerCase() === 'define.xml') {
        try {
          const content = await file.text()
          const { metadata, fileMetadata } = await parseDefineXml(content)
          defineXmlMetadata = metadata
          defineXmlFileMetadata = fileMetadata
          break
        } catch {
          // Silently continue if define.xml parsing fails
        }
      }
    }

    setProgress(prev => prev ? { ...prev, current: 10, message: 'Processing files...' } : null)

    const targetFiles = Array.from(files).filter(file => {
      const fileExt = format === 'json' ? '.json' : '.ndjson'
      return file.name.endsWith(fileExt)
    })

    const totalFiles = targetFiles.length
    let processedFiles = 0

    for (const file of targetFiles) {
      const pathParts = file.webkitRelativePath.split('/')
      const folderName = pathParts.length > 2 ? pathParts[1] : rootPath
      const folderPath = pathParts.length > 2 ? `${rootPath}/${folderName}` : rootPath

      let folderData = folderMap.get(folderName)
      if (!folderData) {
        folderData = {
          name: folderName,
          path: folderPath,
          files: []
        }
        folderMap.set(folderName, folderData)
      }

      try {
        if (format === 'ndjson') {
          // For NDJSON, only read the first line for metadata
          const reader = new FileReader()
          const firstChunk = await new Promise<string>((resolve, reject) => {
            const blob = file.slice(0, 64 * 1024) // Read first 64KB to get metadata
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsText(blob)
          })

          const firstLine = firstChunk.split(/\r?\n/)[0]
          if (!firstLine) continue

          const metadata = JSON.parse(firstLine)
          const recordCount = (firstChunk.match(/\n/g) || []).length // Estimate total records from first chunk
          
          const parsedContent = {
            ...metadata,
            rows: [], // Don't load rows initially
            records: recordCount,
            columns: metadata.columns || []
          }

          // Add define.xml metadata if available
          if (defineXmlMetadata && parsedContent.columns) {
            const columns = parsedContent.columns as ColumnMetadata[]
            columns.forEach(col => {
              const defineMetadata = defineXmlMetadata?.get(col.itemOID)
              if (defineMetadata) {
                col.defineXmlMetadata = defineMetadata
              }
            })
          }

          folderData.files.push({
            name: file.name,
            content: {
              ...parsedContent,
              ...(defineXmlFileMetadata && { defineXMLMetadata: defineXmlFileMetadata })
            },
            path: file.webkitRelativePath,
            rawFile: file
          })
        } else {
          // For JSON files, read only metadata
            const chunk = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => {
                const content = reader.result as string
                const rowsStart = content.indexOf('"rows":[')
                if (rowsStart === -1) {
                  resolve(content)
                } else {
                // Only read up to the rows array
                  resolve(content.substring(0, rowsStart) + '"rows":[]' + '}')
                }
              }
              reader.onerror = reject
            const blob = file.slice(0, 64 * 1024) // Read first 64KB for metadata
              reader.readAsText(blob)
            })

            const parsedContent = JSON.parse(chunk)

            if (defineXmlMetadata && parsedContent.columns) {
              const columns = parsedContent.columns as ColumnMetadata[]
              columns.forEach(col => {
                const defineMetadata = defineXmlMetadata?.get(col.itemOID)
                if (defineMetadata) {
                  col.defineXmlMetadata = defineMetadata
                }
              })
            }

          folderData.files.push({
              name: file.name,
              content: {
                ...parsedContent,
              columns: parsedContent.columns || [],
              rows: [], // Don't load rows initially
              records: parsedContent.records || 0,
                ...(defineXmlFileMetadata && { defineXMLMetadata: defineXmlFileMetadata })
              },
              path: file.webkitRelativePath,
              rawFile: file
            })
        }

        processedFiles++
        const progress = Math.round((processedFiles / totalFiles) * 80) + 10 // 10-90% for file processing
        setProgress(prev => prev ? {
          ...prev,
          current: progress,
          message: `Processing files (${processedFiles}/${totalFiles})...`
        } : null)
        
      } catch {
        continue
      }
    }

    setProgress(prev => prev ? { ...prev, current: 90, message: 'Finalizing...' } : null)

    setSubfolders(Array.from(folderMap.values()))
    
    if (folderMap.size > 0) {
      const firstFolder = folderMap.values().next().value
      if (firstFolder) {
        setSelectedFolder(firstFolder.path)
        if (firstFolder.files.length > 0) {
          const firstFile = firstFolder.files[0]
          setSelectedFile(firstFile.name)
          await loadFileRows(firstFile) // Wait for the first file's rows to load
        }
      }
    }

    setViewerState(prev => ({ 
      ...prev, 
      currentPage: 1, 
      sidebarOpen: false,
      loadingProgress: 0 
    }))

    setProgress(prev => prev ? { ...prev, current: 100, message: 'Complete' } : null)
    setTimeout(() => setProgress(null), 500)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    setPendingFiles(files)
    setShowFormatDialog(true)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const items = Array.from(e.dataTransfer.items)
    
    items.forEach((item) => {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry()
        if (entry?.isDirectory) {
          setPendingDirEntry(entry as FileSystemDirectoryEntry)
          setShowFormatDialog(true)
        }
      }
    })
  }, [])

  const processDirectoryEntry = async (dirEntry: FileSystemDirectoryEntry, format: 'json' | 'ndjson') => {
    const processEntry = async (entry: FileSystemEntry): Promise<FolderData | null> => {
      if (entry.isDirectory) {
        const directoryEntry = entry as FileSystemDirectoryEntry
        const reader = directoryEntry.createReader()
        const entries = await new Promise<FileSystemEntry[]>((resolve) => {
          reader.readEntries((entries) => resolve(entries))
        })

        const results = await Promise.all(entries.map(processEntry))
        const validResults = results.filter((result): result is FolderData => result !== null)

        // If no valid subfolders but has files directly, return as a single folder
        if (validResults.length === 0) {
          const filePromises = entries
            .filter((e): e is FileSystemFileEntry => e.isFile)
            .map(async (fileEntry) => {
              const file = await new Promise<File>((resolve) => {
                fileEntry.file(resolve)
              })

              const fileExt = format === 'json' ? '.json' : '.ndjson'
              if (!file.name.endsWith(fileExt)) return null

              try {
                if (format === 'ndjson') {
                  const content = await file.text()
                  const lines = content.split(/\r?\n/).filter(line => line.trim())
                  if (lines.length === 0) return null

                  const metadata = JSON.parse(lines[0])
                  const rows = lines.slice(1).map(line => JSON.parse(line))
                  
                  const parsedContent = {
                    ...metadata,
                    rows: rows
                  }

                  return {
                    name: file.name,
                    content: parsedContent,
                    path: fileEntry.fullPath,
                    rawFile: file
                  }
                } else {
                  // For JSON files, we'll parse them on demand
                  return {
                    name: file.name,
                    content: {
                      rows: [] // Initially empty, will be loaded on demand
                    },
                    path: fileEntry.fullPath,
                    rawFile: file
                  }
                }
              } catch {
                return null
              }
            })

          const files = (await Promise.all(filePromises)).filter((file): file is FileData => file !== null)
          if (files.length > 0) {
            return {
              name: entry.name,
              path: entry.fullPath,
              files
            }
          }
          return null
        }

        return {
          name: entry.name,
          path: entry.fullPath,
          files: validResults.flatMap(result => result.files)
        }
      }

      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry
        const file = await new Promise<File>((resolve) => {
          fileEntry.file(resolve)
        })

        const fileExt = format === 'json' ? '.json' : '.ndjson'
        if (!file.name.endsWith(fileExt)) return null

        try {
          if (format === 'ndjson') {
            const content = await file.text()
            const lines = content.split(/\r?\n/).filter(line => line.trim())
            if (lines.length === 0) return null

            const metadata = JSON.parse(lines[0])
            const rows = lines.slice(1).map(line => JSON.parse(line))
            
            const parsedContent = {
              ...metadata,
              rows: rows
            }

            return {
              name: entry.name,
              path: entry.fullPath,
              files: [{
                name: file.name,
                content: parsedContent,
                path: entry.fullPath,
                rawFile: file
              }]
            }
          } else {
            return {
              name: entry.name,
              path: entry.fullPath,
              files: [{
                name: file.name,
                content: {
                  rows: [] // Initially empty, will be loaded on demand
                },
                path: entry.fullPath,
                rawFile: file
              }]
            }
          }
        } catch {
          return null
        }
      }

      return null
    }

    const result = await processEntry(dirEntry)
    if (result) {
      setSubfolders([result])
      setSelectedFolder(result.path)
      if (result.files.length > 0) {
        setSelectedFile(result.files[0].name)
      }
    }
  }

  const handleFormatSelect = async (format: 'json' | 'ndjson') => {
    setSelectedFormat(format)
    setShowFormatDialog(false)

    if (pendingFiles) {
      await processFiles(pendingFiles, format)
      setPendingFiles(null)
    } else if (pendingDirEntry) {
      await processDirectoryEntry(pendingDirEntry, format)
      setPendingDirEntry(null)
    }
  }

  // Update effect for initial data loading
  useEffect(() => {
    if (selectedFileData?.content) {
      const fileContent = selectedFileData.content as { columns?: ColumnMetadata[], rows?: unknown[][] }
      const columns = fileContent.columns || []
      const columnNames = columns.map(col => col.name)
      
      setViewerState(prev => ({
        ...prev,
        columnOrder: columnNames,
        visibleColumns: columnNames,
        currentPage: 1,
        sortConfig: []
      }))
    }
  }, [selectedFileData])

  // Add useUniqueValues hook
  const uniqueValues = useUniqueValues(columns, rows)
  const uniqueValuesMap = useMemo(() => {
    const map: { [key: string]: { values: UniqueValue[]; isNumeric: boolean; exceedsLimit: boolean } } = {}
    columns.forEach(col => {
      map[col.name] = {
        values: uniqueValues.getValues(col.name),
        isNumeric: uniqueValues.isNumericColumn(col.name),
        exceedsLimit: uniqueValues.exceedsLimit(col.name)
      }
    })
    return map
  }, [columns, uniqueValues])

  return (
    <>
      <div 
        className="h-screen flex flex-col md:flex-row overflow-hidden"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        {progress && (
          <div className="absolute top-0 left-0 right-0 z-50">
            <div className="relative h-2 bg-muted">
            <Progress 
                value={progress.current} 
                className="absolute top-0 left-0 w-full transition-all duration-300" 
            />
              <div className="absolute top-3 left-0 right-0 px-4 text-xs text-muted-foreground">
                <span>{progress.message}</span>
              </div>
          </div>
          </div>
        )}
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
          <h1 className="text-lg font-semibold">Open Dataset-JSON</h1>
        </div>

        {/* Left Sidebar */}
        <div className={`w-full md:w-64 border-r bg-background ${sidebarOpen ? 'block' : 'hidden'} md:block overflow-y-auto`}>
          <div className="p-4 font-semibold text-lg border-b">Open Dataset-JSON</div>
          <div className="py-2">
            {subfolders.map(folder => (
              <FolderTooltip key={folder.path} folder={folder}>
                <div
                  className={`px-4 py-2 cursor-pointer hover:bg-accent ${
                    selectedFolder === folder.path ? 'bg-accent text-accent-foreground' : ''
                  }`}
                  onClick={() => {
                    setSelectedFolder(folder.path)
                    setSidebarOpen(false)
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    <span>{folder.name}</span>
                  </div>
                </div>
              </FolderTooltip>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedFolderData ? (
            <Tabs
              defaultValue={selectedFolderData.files[0]?.name}
              value={selectedFile || selectedFolderData.files[0]?.name}
              onValueChange={handleFileChange}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="border-b overflow-x-auto">
                <TabsList className="w-max min-w-full flex justify-start">
                  {selectedFolderData.files.map(file => (
                    <FileTooltip key={file.path} file={file}>
                      <TabsTrigger 
                        value={file.name} 
                        className="data-[state=active]:bg-background flex-shrink-0"
                        data-state={file.name === selectedFile ? 'active' : 'inactive'}
                      >
                        {file.name}
                      </TabsTrigger>
                    </FileTooltip>
                  ))}
                </TabsList>
              </div>
              <div className="flex-1 overflow-hidden">
                {selectedFolderData.files.map(file => (
                  <TabsContent
                    key={file.path}
                    value={file.name}
                    className="flex-1 p-4 data-[state=active]:flex flex-col h-full overflow-hidden"
                    data-state={file.name === selectedFile ? 'active' : 'inactive'}
                  >
                    <div className="space-y-4 mb-4">
                      <div className="flex justify-between items-center">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() => setShowColumnNames(!showColumnNames)}
                          >
                            <Tag className="mr-2 h-4 w-4" />
                            {showColumnNames ? "Show Labels" : "Show Names"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() => setShowUniqueValues(true)}
                            disabled={viewerState.isLoadingRows || !selectedFileData}
                          >
                            <svg
                              className="mr-2 h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M17 18a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h10l4 4v6m-7-5v5"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 15h4"
                              />
                            </svg>
                            Dataset Frequency Overview
                            {viewerState.isLoadingRows && (
                              <span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            )}
                          </Button>
                          <ColumnVisibilityToggle
                            columns={columns}
                            visibleColumns={viewerState.visibleColumns}
                            onToggleColumn={handleToggleColumn}
                            showColumnNames={showColumnNames}
                          />
                        </div>
                        <SortButton
                          sortConfig={viewerState.sortConfig}
                          columns={columns}
                          onSortChange={(newConfig) => setViewerState(prev => ({ ...prev, sortConfig: newConfig }))}
                          showColumnNames={showColumnNames}
                        />
                      </div>
                      <div className="flex gap-2 w-full">
                        <div className="flex-1">
                      <FilterInput onFilter={applyFilter} />
                        </div>
                        <FilterBuilder 
                          columns={columns} 
                          onApplyFilter={applyFilter} 
                          rows={rows}
                        />
                      </div>
                    </div>
                    <div className="flex-1 border rounded-lg overflow-auto">
                      {columns.length > 0 ? (
                        paginationValues.currentRows.length > 0 ? (
                      <TableComponent
                        columns={columns}
                            rows={paginationValues.currentRows}
                            columnOrder={viewerState.columnOrder}
                            visibleColumns={viewerState.visibleColumns}
                            sortConfig={viewerState.sortConfig}
                        showColumnNames={showColumnNames}
                        handleSort={handleSort}
                        onColumnOrderChange={handleColumnOrderChange}
                      />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            {viewerState.isLoadingRows || progress ? (
                              <p>Processing data, please wait...</p>
                            ) : (
                              <p>No rows to display</p>
                            )}
                    </div>
                        )
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <p>No columns available</p>
                        </div>
                      )}
                    </div>
                    {paginationValues.totalPages > 1 && (
                      <PaginationControls
                        currentPage={viewerState.currentPage}
                        totalPages={paginationValues.totalPages}
                        startIndex={paginationValues.startIndex}
                        endIndex={paginationValues.endIndex}
                        totalRows={sortedRows.length}
                        onPageChange={(page) => setViewerState(prev => ({ ...prev, currentPage: page }))}
                      />
                    )}
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
              <div className="text-center space-y-6 max-w-2xl">
                <div className="mb-4">
                  <svg
                    className="mx-auto h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Upload your data</h3>
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => folderInputRef.current?.click()}
                      className="min-w-32"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                      Upload Folder
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-w-32"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Upload Files
                    </Button>
                  </div>
                  <p className="text-sm mt-2">
                    or drag files/folder here
                  </p>
                  <div className="mt-6 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                    <p className="font-medium mb-2">🔒 Privacy Notice</p>
                    <p>This is a client-side only application. Your data stays in your browser and is never uploaded to any server. 
                    No user information or files are stored. You can safely use this tool with sensitive data.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showFormatDialog} onOpenChange={setShowFormatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select File Format</DialogTitle>
            <DialogDescription>
              Choose the format of your dataset files
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup
              value={selectedFormat}
              onValueChange={(value: 'json' | 'ndjson') => setSelectedFormat(value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json">JSON</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ndjson" id="ndjson" />
                <Label htmlFor="ndjson">NDJSON (New-line Delimited JSON)</Label>
              </div>
            </RadioGroup>
            <div className="flex justify-end">
              <Button 
                onClick={() => handleFormatSelect(selectedFormat)}
              >
                Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        // @ts-expect-error - DragEvent types are not fully compatible
        webkitdirectory=""
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        multiple
        accept=".json,.ndjson"
      />

      <RowLimitDialog 
        open={showRowLimitDialog}
        onClose={() => {
          setShowRowLimitDialog(false)
          setRowLimitInfo(null)
        }}
        rowCount={rowLimitInfo?.rowCount || 0}
        maxRows={rowLimitInfo?.maxRows || MAX_ROWS_ALLOWED}
      />

      {/* Add Dataset Frequency Overview Dialog */}
      <Dialog open={showUniqueValues} onOpenChange={setShowUniqueValues}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dataset Frequency Overview</DialogTitle>
            <DialogDescription>
              Explore frequency of each value for each column in {selectedFileData?.name}
            </DialogDescription>
          </DialogHeader>
          <UniqueValuesTree uniqueValuesMap={uniqueValuesMap} />
        </DialogContent>
      </Dialog>
    </>
  )
}

