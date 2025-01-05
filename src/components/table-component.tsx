import * as React from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SortConfig } from "../types/types"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  restrictToHorizontalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers'

interface TableComponentProps {
  columns: { name: string; label: string }[]
  rows: unknown[][]
  columnOrder: string[]
  visibleColumns: string[]
  sortConfig: SortConfig[]
  showColumnNames: boolean
  handleSort: (columnName: string) => void
  onColumnOrderChange: (newOrder: string[]) => void
}

function DraggableHeader({ 
  column, 
  showColumnNames,
  sortConfig,
  handleSort,
  isVisible,
}: { 
  column: { name: string; label: string }
  showColumnNames: boolean
  sortConfig: SortConfig[]
  handleSort: (columnName: string) => void
  isVisible: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: column.name,
    data: column
  })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const sort = sortConfig.find(s => s.key === column.name)

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b bg-background px-4 py-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        !isVisible && "hidden",
        isDragging && "z-50"
      )}
      {...attributes}
    >
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <div {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        {/* Sort Button */}
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 data-[state=open]:bg-accent"
          onClick={(e) => {
            e.stopPropagation()
            handleSort(column.name)
          }}
        >
          <span>{showColumnNames ? column.name : column.label}</span>
          {!sort && <ArrowUpDown className="ml-2 h-4 w-4" />}
          {sort?.direction === 'asc' && <ArrowUp className="ml-2 h-4 w-4" />}
          {sort?.direction === 'desc' && <ArrowDown className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </th>
  )
}

export function TableComponent({
  columns,
  rows,
  columnOrder,
  visibleColumns,
  sortConfig,
  showColumnNames,
  handleSort,
  onColumnOrderChange,
}: TableComponentProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [lastDragOperation, setLastDragOperation] = React.useState<{
    activeId: string | null,
    overId: string | null,
    oldIndex: number,
    newIndex: number,
    success: boolean
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setIsDragging(true)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false)
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.findIndex(col => col === active.id)
      const newIndex = columnOrder.findIndex(col => col === over.id)

      if (oldIndex === -1 || newIndex === -1) {
        setLastDragOperation({
          activeId: String(active.id),
          overId: over ? String(over.id) : null,
          oldIndex,
          newIndex,
          success: false
        })
        return
      }

      setLastDragOperation({
        activeId: String(active.id),
        overId: String(over.id),
        oldIndex,
        newIndex,
        success: true
      })

      onColumnOrderChange(arrayMove(columnOrder, oldIndex, newIndex))
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
    >
      <div className={cn("relative", isDragging && "cursor-grabbing")}>
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr>
              <SortableContext
                items={columnOrder}
                strategy={horizontalListSortingStrategy}
              >
                {columnOrder.map((columnName) => {
                  const column = columns.find(c => c.name === columnName)
                  if (!column) return null
                  return (
                    <DraggableHeader
                      key={column.name}
                      column={column}
                      showColumnNames={showColumnNames}
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                      isVisible={visibleColumns.includes(column.name)}
                    />
                  )
                })}
              </SortableContext>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {visibleColumns.map((colName, colIndex) => {
                  const column = columns.find(col => col.name === colName)
                  if (!column) return null
                  
                  // Find the original index of this column in the data
                  const originalColumnIndex = columns.findIndex(col => col.name === colName)
                  
                  return (
                    <td
                      key={colName}
                      className={cn(
                        "p-2 border-r last:border-r-0",
                        colIndex === 0 && "sticky left-0 bg-background"
                      )}
                    >
                      {String(row[originalColumnIndex] ?? '')}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DndContext>
  )
}

