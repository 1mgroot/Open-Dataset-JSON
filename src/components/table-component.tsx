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
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'

interface TableComponentProps {
  columns: { name: string; label: string }[]
  rows: any[][]
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
  } = useSortable({ id: column.name })

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
        !isVisible && "hidden"
      )}
      {...attributes}
    >
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <div {...listeners} className="cursor-grab active:cursor-grabbing">
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
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: any) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(active.id)
      const newIndex = columnOrder.indexOf(over.id)

      onColumnOrderChange(arrayMove(columnOrder, oldIndex, newIndex))
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
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
              {columnOrder.map((columnName) => {
                const columnIndex = columns.findIndex(c => c.name === columnName)
                if (columnIndex === -1) return null
                return (
                  <td
                    key={columnName}
                    className={cn(
                      "border-b p-4 align-middle [&:has([role=checkbox])]:pr-0",
                      !visibleColumns.includes(columnName) && "hidden"
                    )}
                  >
                    {row[columnIndex]}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </DndContext>
  )
}

