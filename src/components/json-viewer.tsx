'use client'

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Folder, Menu, Tag } from 'lucide-react'
import { SortButton } from './sort-button'
import { FilterInput } from './filter-input'
import { ColumnVisibilityToggle } from './column-visibility-toggle'
import { TableComponent } from './table-component'
import { PaginationControls } from './pagination-controls'
import { FileData, FolderData, SortConfig, ColumnMetadata } from '../types/types'

const ROWS_PER_PAGE = 30

export default function JsonViewer() {
  const [rootFolder, setRootFolder] = useState<string>('')
  const [subfolders, setSubfolders] = useState<FolderData[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sortConfig, setSortConfig] = useState<SortConfig[]>([])
  const [showColumnNames, setShowColumnNames] = useState(false)
  const [filteredRows, setFilteredRows] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState<string>('')
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const rootPath = files[0].webkitRelativePath.split('/')[0]
    setRootFolder(rootPath)

    const folderMap = new Map<string, FolderData>()

    for (const file of Array.from(files)) {
      const pathParts = file.webkitRelativePath.split('/')
      if (pathParts.length < 3) continue

      const subfolder = pathParts[1]
      if (!file.name.endsWith('.json')) continue

      let folderData = folderMap.get(subfolder)
      if (!folderData) {
        folderData = {
          name: subfolder,
          path: `${rootPath}/${subfolder}`,
          files: []
        }
        folderMap.set(subfolder, folderData)
      }

      try {
        const content = await file.text()
        folderData.files.push({
          name: file.name,
          content: JSON.parse(content),
          path: file.webkitRelativePath
        })
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error)
      }
    }

    setSubfolders(Array.from(folderMap.values()))
    
    if (folderMap.size > 0) {
      const firstFolder = folderMap.values().next().value;
      setSelectedFolder(firstFolder.path);
      if (firstFolder.files.length > 0) {
        setSelectedFile(firstFolder.files[0].name);
      }
    }

    setCurrentPage(1)
    setSidebarOpen(false)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const items = Array.from(e.dataTransfer.items)
    
    items.forEach((item) => {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry()
        if (entry?.isDirectory) {
          processDirectoryEntry(entry)
        }
      }
    })
  }, [])

  const processDirectoryEntry = async (dirEntry: any) => {
    const rootPath = dirEntry.name
    setRootFolder(rootPath)
    
    const processEntry = async (entry: any): Promise<FolderData | null> => {
      if (entry.isDirectory) {
        const reader = entry.createReader()
        const entries = await new Promise<any[]>((resolve) => {
          reader.readEntries((entries: any[]) => resolve(entries))
        })

        const files: FileData[] = []
        for (const childEntry of entries) {
          if (childEntry.isFile && childEntry.name.endsWith('.json')) {
            const file = await new Promise<File>((resolve) => {
              childEntry.file(resolve)
            })
            try {
              const content = await file.text()
              files.push({
                name: childEntry.name,
                content: JSON.parse(content),
                path: childEntry.fullPath
              })
            } catch (error) {
              console.error(`Error processing file ${childEntry.name}:`, error)
            }
          }
        }

        if (entry.name === rootPath) {
          const subfolderEntries = entries.filter(e => e.isDirectory)
          const processedSubfolders: FolderData[] = []
          
          for (const subfolder of subfolderEntries) {
            const subfolderData = await processEntry(subfolder)
            if (subfolderData) {
              processedSubfolders.push(subfolderData)
            }
          }
          
          setSubfolders(processedSubfolders)
          if (processedSubfolders.length > 0) {
            setSelectedFolder(processedSubfolders[0].path);
            if (processedSubfolders[0].files.length > 0) {
              setSelectedFile(processedSubfolders[0].files[0].name);
            }
          }
        } else {
          return {
            name: entry.name,
            path: entry.fullPath,
            files
          }
        }
      }
      return null
    }

    await processEntry(dirEntry)
    setCurrentPage(1)
    setSidebarOpen(false)
  }

  const selectedFolderData = subfolders.find(f => f.path === selectedFolder)
  const selectedFileData = selectedFolderData?.files.find(f => f.name === selectedFile)

  const columns = selectedFileData?.content.columns || []
  const rows = selectedFileData?.content.rows || []

  useEffect(() => {
    if (columns.length > 0) {
      const newColumnOrder = columns.map((col: ColumnMetadata) => col.name)
      setColumnOrder(newColumnOrder)
      setVisibleColumns(newColumnOrder)
    }
  }, [columns])

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
      
      const filtered = rows.filter((row: any) => {
        try {
          return filterFunction(row);
        } catch (e) {
          return false;
        }
      });

      setFilteredRows(filtered);
      return {
        success: true,
        message: `Filter applied successfully. Showing ${filtered.length} of ${rows.length} rows.`
      };
    } catch (error) {
      console.error("Filter error:", error);
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

    return [...filteredRows].sort((a, b) => {
      for (const sort of sortConfig) {
        const index = columnOrder.indexOf(sort.key);
        if (index === -1) continue;

        if (a[index] < b[index]) return sort.direction === 'asc' ? -1 : 1;
        if (a[index] > b[index]) return sort.direction === 'asc' ? 1 : -1;
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
    setSortConfig(prevSort => {
      const existingSort = prevSort.find(s => s.key === columnName);
      if (existingSort) {
        if (existingSort.direction === 'asc') {
          return prevSort.map(s => s.key === columnName ? { ...s, direction: 'desc' } : s);
        } else {
          return prevSort.filter(s => s.key !== columnName);
        }
      } else {
        return [...prevSort, { key: columnName, direction: 'asc' }];
      }
    });
    setCurrentPage(1);
  };

  const handleToggleColumn = (columnName: string) => {
    setVisibleColumns(prev => 
      prev.includes(columnName)
        ? prev.filter(col => col !== columnName)
        : [...prev, columnName]
    );
  };

  return (
    <div 
      className="h-screen flex flex-col md:flex-row overflow-hidden"
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
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
            <div
              key={folder.path}
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
              <TabsList className="w-max min-w-full flex">
                {selectedFolderData.files.map(file => (
                  <TabsTrigger key={file.path} value={file.name} className="data-[state=active]:bg-background flex-shrink-0">
                    {file.name}
                  </TabsTrigger>
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
                  <div className="flex-1 border rounded-lg overflow-hidden">
                    <TableComponent
                      columns={columns}
                      rows={currentRows}
                      columnOrder={columnOrder}
                      visibleColumns={visibleColumns}
                      sortConfig={sortConfig}
                      showColumnNames={showColumnNames}
                      handleSort={handleSort}
                      onColumnOrderChange={setColumnOrder}
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
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        // @ts-ignore
        webkitdirectory=""
      />
    </div>
  )
}

