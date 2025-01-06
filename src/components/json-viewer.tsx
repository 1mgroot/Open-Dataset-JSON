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
import oboe from 'oboe'

const ROWS_PER_PAGE = 30

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

export default function JsonViewer() {
  const [subfolders, setSubfolders] = useState<FolderData[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sortConfig, setSortConfig] = useState<SortConfig[]>([])
  const [showColumnNames, setShowColumnNames] = useState(false)
  const [filteredRows, setFilteredRows] = useState<unknown[][]>([])
  const [activeFilter, setActiveFilter] = useState<string>('')
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [showFormatDialog, setShowFormatDialog] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'ndjson'>('json')
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null)
  const [pendingDirEntry, setPendingDirEntry] = useState<FileSystemDirectoryEntry | null>(null)
  const [loadingProgress, setLoadingProgress] = useState<number>(0)
  const [isLoadingRows, setIsLoadingRows] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setCurrentPage(1)
    setSortConfig([])
    setActiveFilter('')
    setFilteredRows([])
  }

  useEffect(() => {
    if (subfolders.length > 0 && !selectedFolder) {
      const firstFolder = subfolders[0];
      setSelectedFolder(firstFolder.path);
      if (firstFolder.files.length > 0) {
        setSelectedFile(firstFolder.files[0].name);
      }
    }
  }, [subfolders, selectedFolder]);

  useEffect(() => {
    const currentFolder = subfolders.find(folder => folder.path === selectedFolder);
    if (currentFolder && currentFolder.files.length > 0) {
      setSelectedFile(currentFolder.files[0].name);
    } else {
      setSelectedFile('');
    }
    resetState();
  }, [selectedFolder, subfolders]);

  const processFiles = async (files: FileList, format: 'json' | 'ndjson') => {
    const rootPath = files[0].webkitRelativePath.split('/')[0]
    const folderMap = new Map<string, FolderData>()
    let defineXmlMetadata: Map<string, DefineXmlMetadata> | null = null
    let defineXmlFileMetadata: DefineXmlFileMetadata | null = null

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
          console.warn('Failed to parse define.xml')
        }
      }
    }

    const totalFiles = Array.from(files).filter(file => {
      const fileExt = format === 'json' ? '.json' : '.ndjson'
      return file.name.endsWith(fileExt)
    }).length

    let processedFiles = 0

    for (const file of Array.from(files)) {
      const pathParts = file.webkitRelativePath.split('/')
      const fileExt = format === 'json' ? '.json' : '.ndjson'
      if (!file.name.endsWith(fileExt)) continue

      // Handle both root-level files and files in subfolders
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
          const content = await file.text()
          const lines = content.split(/\r?\n/).filter(line => line.trim())
          if (lines.length === 0) continue

          const metadata = JSON.parse(lines[0])
          const rows = lines.slice(1).map(line => JSON.parse(line))
          
          const parsedContent = {
            ...metadata,
            rows: rows
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
          // For JSON files, we'll only read metadata first
          console.log(`Processing file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`)
          
          try {
            // Read only the first chunk to get metadata
            const chunk = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => {
                const content = reader.result as string
                const rowsStart = content.indexOf('"rows":[')
                if (rowsStart === -1) {
                  resolve(content)
                } else {
                  resolve(content.substring(0, rowsStart) + '"rows":[]' + '}')
                }
              }
              reader.onerror = reject
              // Read only first 1MB which should be enough for metadata
              const blob = file.slice(0, 1024 * 1024)
              reader.readAsText(blob)
            })

            console.log(`Parsing metadata for: ${file.name}`)
            const parsedContent = JSON.parse(chunk)
            console.log(`Found ${parsedContent.columns?.length || 0} columns in ${file.name}`)

            // Add define.xml metadata if available
            if (defineXmlMetadata && parsedContent.columns) {
              console.log(`Adding define.xml metadata to ${file.name}`)
              const columns = parsedContent.columns as ColumnMetadata[]
              columns.forEach(col => {
                const defineMetadata = defineXmlMetadata?.get(col.itemOID)
                if (defineMetadata) {
                  col.defineXmlMetadata = defineMetadata
                }
              })
            }

            folderData!.files.push({
              name: file.name,
              content: {
                ...parsedContent,
                rows: [], // Initially empty, will be loaded on demand
                ...(defineXmlFileMetadata && { defineXMLMetadata: defineXmlFileMetadata })
              },
              path: file.webkitRelativePath,
              rawFile: file
            })
          } catch (error) {
            console.error(`Error processing metadata for ${file.name}:`, error)
            throw error
          }
        }

        processedFiles++
        setLoadingProgress((processedFiles / totalFiles) * 100)
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error)
        continue
      }
    }

    setSubfolders(Array.from(folderMap.values()))
    
    if (folderMap.size > 0) {
      const firstFolder = folderMap.values().next().value
      if (firstFolder) {
        setSelectedFolder(firstFolder.path)
        if (firstFolder.files.length > 0) {
          setSelectedFile(firstFolder.files[0].name)
        }
      }
    }

    setCurrentPage(1)
    setSidebarOpen(false)
    setLoadingProgress(0)
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
    let defineXmlMetadata: Map<string, DefineXmlMetadata> | null = null
    let defineXmlFileMetadata: DefineXmlFileMetadata | null = null

    const processEntry = async (entry: FileSystemEntry): Promise<FolderData | null> => {
      if (entry.isDirectory) {
        const directoryEntry = entry as FileSystemDirectoryEntry
        const reader = directoryEntry.createReader()
        const entries = await new Promise<FileSystemEntry[]>((resolve) => {
          reader.readEntries((entries) => resolve(entries))
        })

        // First, look for define.xml
        for (const subEntry of entries) {
          if (subEntry.isFile && subEntry.name.toLowerCase() === 'define.xml') {
            const fileEntry = subEntry as FileSystemFileEntry
            try {
              const file = await new Promise<File>((resolve) => {
                fileEntry.file(resolve)
              })
              const content = await file.text()
              const { metadata, fileMetadata } = await parseDefineXml(content)
              defineXmlMetadata = metadata
              defineXmlFileMetadata = fileMetadata
              break
            } catch {
              console.warn('Failed to parse define.xml')
            }
          }
        }

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

                  return {
                    name: file.name,
                    content: {
                      ...parsedContent,
                      ...(defineXmlFileMetadata && { defineXMLMetadata: defineXmlFileMetadata })
                    },
                    path: fileEntry.fullPath,
                    rawFile: file
                  }
                } else {
                  // For JSON files, we'll parse them on demand
                  return {
                    name: file.name,
                    content: {
                      rows: [], // Initially empty, will be loaded on demand
                      ...(defineXmlFileMetadata && { defineXMLMetadata: defineXmlFileMetadata })
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

            return {
              name: entry.name,
              path: entry.fullPath,
              files: [{
                name: file.name,
                content: {
                  ...parsedContent,
                  ...(defineXmlFileMetadata && { defineXMLMetadata: defineXmlFileMetadata })
                },
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
                  rows: [], // Initially empty, will be loaded on demand
                  ...(defineXmlFileMetadata && { defineXMLMetadata: defineXmlFileMetadata })
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

  const selectedFolderData = subfolders.find(f => f.path === selectedFolder)
  const selectedFileData = selectedFolderData?.files.find(f => f.name === selectedFile)

  const columns = useMemo(() => {
    return (selectedFileData?.content as { columns?: ColumnMetadata[] })?.columns || []
  }, [selectedFileData])

  const rows = useMemo(() => {
    const fileRows = (selectedFileData?.content as { rows?: unknown[][] })?.rows
    return Array.isArray(fileRows) ? fileRows : []
  }, [selectedFileData])

  useEffect(() => {
    const fileColumns = (selectedFileData?.content as { columns?: ColumnMetadata[] })?.columns
    if (Array.isArray(fileColumns) && fileColumns.length > 0) {
      const newColumnOrder = fileColumns.map((col: ColumnMetadata) => col.name)
      setColumnOrder(newColumnOrder)
      setVisibleColumns(newColumnOrder)
    }
  }, [selectedFileData])

  // Apply filter to rows based on user input
  const applyFilter = useCallback((filterString: string) => {
    setActiveFilter(filterString);
    if (!filterString.trim()) {
      setFilteredRows(rows);
      return { success: true, message: "Filter cleared. Showing all rows." };
    }

    try {
      // First replace logical operators with JavaScript operators
      let processedFilter = filterString
        .replace(/\band\b/gi, '&&')
        .replace(/\bor\b/gi, '||');

      // Then replace column comparisons
      processedFilter = processedFilter.replace(
        /([a-zA-Z_][a-zA-Z0-9_]*)\s*(=|!=|>|<|>=|<=)\s*(["']?)([^"'\s]+)(["']?)/g,
        (match, colName, operator, quote1, value, quote2) => {
          const columnIndex = columns.findIndex((col: ColumnMetadata) => col.name === colName);
          if (columnIndex === -1) {
            throw new Error(`Unknown column: ${colName}`);
          }

          // Keep existing quotes if present, otherwise assume it's a number
          const processedValue = quote1 || quote2 ? `${quote1}${value}${quote2}` : value;
          
          // Convert = to === for JavaScript equality
          const jsOperator = operator === '=' ? '===' : operator;
          
          return `row[${columnIndex}] ${jsOperator} ${processedValue}`;
        }
      );

      const filterFunction = new Function('row', `return ${processedFilter}`);
      
      const filtered = rows.filter((row: unknown[]) => {
        try {
          return filterFunction(row);
        } catch {
          return false;
        }
      });

      setFilteredRows(filtered);
      return {
        success: true,
        message: `Filter applied successfully. Showing ${filtered.length} of ${rows.length} rows.`
      };
    } catch (error) {
      setFilteredRows(rows);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Invalid filter criteria. Please check your input." 
      };
    }
  }, [rows, columns]);

  useEffect(() => {
    if (rows.length > 0) {
      applyFilter(activeFilter);
    }
  }, [rows, activeFilter, applyFilter]);

  // Sort rows based on current sort configuration
  const sortedRows = useMemo(() => {
    if (sortConfig.length === 0) return filteredRows;

    return [...filteredRows].sort((a: unknown[], b: unknown[]) => {
      for (const sort of sortConfig) {
        const index = columnOrder.indexOf(sort.key);
        if (index === -1) continue;

        const aVal = String(a[index] ?? '')
        const bVal = String(b[index] ?? '')
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredRows, columnOrder, sortConfig]);

  const totalPages = Math.ceil(sortedRows.length / ROWS_PER_PAGE)
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE
  const endIndex = startIndex + ROWS_PER_PAGE
  const currentRows = sortedRows.slice(startIndex, endIndex)

  const handleFileChange = (fileName: string) => {
    setSelectedFile(fileName)
    resetState()
  }

  const handleSort = (columnName: string) => {
    const columnIndex = columns.findIndex((col: ColumnMetadata) => col.name === columnName)
    if (columnIndex === -1) return

    setSortConfig(prevSort => {
      const existingSort = prevSort.find(s => s.key === columnName)
      if (existingSort) {
        if (existingSort.direction === 'asc') {
          return prevSort.map(s => s.key === columnName ? { ...s, direction: 'desc' as const } : s)
        } else {
          return prevSort.filter(s => s.key !== columnName)
        }
      } else {
        return [...prevSort, { key: columnName, direction: 'asc' as const }]
      }
    })
  }

  const handleToggleColumn = (columnName: string) => {
    setVisibleColumns(prev => 
      prev.includes(columnName)
        ? prev.filter(col => col !== columnName)
        : [...prev, columnName]
    );
  };

  const handleColumnOrderChange = (newOrder: string[]) => {
    setColumnOrder(newOrder)
    // Update visible columns to match the new order while preserving visibility
    const newVisibleColumns = newOrder.filter(col => visibleColumns.includes(col))
    setVisibleColumns(newVisibleColumns)
  }

  useEffect(() => {
    const loadRows = async () => {
      const fileContent = selectedFileData?.content as { rows?: unknown[][] }
      if (!selectedFileData?.rawFile || (fileContent.rows && fileContent.rows.length > 0)) return

      console.log(`Loading rows for: ${selectedFileData.name} (${(selectedFileData.rawFile.size / (1024 * 1024)).toFixed(2)} MB)`)
      setIsLoadingRows(true)
      const startTime = performance.now()
      let rowCount = 0

      try {
        // Create a URL for the file
        const fileUrl = URL.createObjectURL(selectedFileData.rawFile)

        const rows: unknown[][] = []
        await new Promise<void>((resolve, reject) => {
          oboe({
            url: fileUrl,
            headers: {
              'Accept': 'application/json'
            }
          })
            .node('rows.*', function(row) {
              rows.push(row)
              rowCount++
              if (rowCount % 10000 === 0) {
                console.log(`Loaded ${rowCount} rows...`)
              }
              return oboe.drop
            })
            .done(() => {
              const duration = ((performance.now() - startTime) / 1000).toFixed(2)
              console.log(`Finished loading ${rowCount} rows in ${duration}s`)
              if (selectedFileData.content) {
                selectedFileData.content.rows = rows
                setFilteredRows(rows)
              }
              resolve()
            })
            .fail((error) => {
              console.error(`Error loading rows for ${selectedFileData.name}:`, error)
              reject(error)
            })
        })
        
        // Clean up the URL
        URL.revokeObjectURL(fileUrl)
      } catch (error) {
        console.error(`Error loading rows for ${selectedFileData.name}:`, error)
      } finally {
        const duration = ((performance.now() - startTime) / 1000).toFixed(2)
        console.log(`Total processing time: ${duration}s`)
        setIsLoadingRows(false)
      }
    }

    loadRows()
  }, [selectedFileData])

  return (
    <>
      <div 
        className="h-screen flex flex-col md:flex-row overflow-hidden"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        {(loadingProgress > 0 && loadingProgress < 100) || isLoadingRows ? (
          <div className="absolute top-0 left-0 right-0 z-50">
            <Progress value={loadingProgress || 100} className="w-full" />
          </div>
        ) : null}
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
          <h1 className="text-lg font-semibold">JSON Viewer</h1>
        </div>

        {/* Left Sidebar */}
        <div className={`w-full md:w-64 border-r bg-background ${sidebarOpen ? 'block' : 'hidden'} md:block overflow-y-auto`}>
          <div className="p-4 font-semibold text-lg border-b">Folders</div>
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
              value={selectedFile}
              onValueChange={handleFileChange}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="border-b overflow-x-auto">
                <TabsList className="w-max min-w-full flex justify-start">
                  {selectedFolderData.files.map(file => (
                    <FileTooltip key={file.path} file={file}>
                      <TabsTrigger value={file.name} className="data-[state=active]:bg-background flex-shrink-0">
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
                          <ColumnVisibilityToggle
                            columns={columns}
                            visibleColumns={visibleColumns}
                            onToggleColumn={handleToggleColumn}
                            showColumnNames={showColumnNames}
                          />
                        </div>
                        <SortButton
                          sortConfig={sortConfig}
                          columns={columns}
                          onSortChange={setSortConfig}
                          showColumnNames={showColumnNames}
                        />
                      </div>
                      <FilterInput onFilter={applyFilter} />
                    </div>
                    <div className="flex-1 border rounded-lg overflow-auto">
                      <TableComponent
                        columns={columns}
                        rows={currentRows}
                        columnOrder={columnOrder}
                        visibleColumns={visibleColumns}
                        sortConfig={sortConfig}
                        showColumnNames={showColumnNames}
                        handleSort={handleSort}
                        onColumnOrderChange={handleColumnOrderChange}
                      />
                    </div>
                    {totalPages > 1 && (
                      <PaginationControls
                        currentPage={currentPage}
                        totalPages={totalPages}
                        startIndex={startIndex}
                        endIndex={endIndex}
                        totalRows={sortedRows.length}
                        onPageChange={setCurrentPage}
                      />
                    )}
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
              <div className="text-center">
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
                <h3 className="text-lg font-semibold">Drag a folder here</h3>
                <p 
                  className="text-sm cursor-pointer hover:text-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  or click to browse
                </p>
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
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        // @ts-expect-error - DragEvent types are not fully compatible
        webkitdirectory=""
      />
    </>
  )
}

