import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical, X } from 'lucide-react'
import { SortConfig } from "../types/types"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

interface SortButtonProps {
  sortConfig: SortConfig[]
  columns: { name: string; label: string }[]
  onSortChange: (newSortConfig: SortConfig[]) => void
  showColumnNames: boolean
}

function SortableItem({ 
  column,
  direction,
  onToggleDirection,
  onRemove,
  showColumnNames,
}: { 
  column: { name: string; label: string }
  direction: 'asc' | 'desc'
  onToggleDirection: () => void
  onRemove: () => void
  showColumnNames: boolean
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between px-2 py-1.5 hover:bg-accent rounded-sm"
      {...attributes}
    >
      <div className="flex items-center gap-2">
        <div {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <span>{showColumnNames ? column.name : column.label}</span>
      </div>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onToggleDirection}
        >
          {direction === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function SortButton({ sortConfig, columns, onSortChange, showColumnNames }: SortButtonProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = sortConfig.findIndex(item => item.key === active.id)
      const newIndex = sortConfig.findIndex(item => item.key === over.id)

      onSortChange(arrayMove(sortConfig, oldIndex, newIndex))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowUpDown className="mr-2 h-4 w-4" />
          Sort
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortConfig.map(s => s.key)}
              strategy={verticalListSortingStrategy}
            >
              {sortConfig.map((sort) => {
                const column = columns.find(c => c.name === sort.key)
                if (!column) return null
                return (
                  <SortableItem
                    key={sort.key}
                    column={column}
                    direction={sort.direction}
                    showColumnNames={showColumnNames}
                    onToggleDirection={() => {
                      const newSortConfig = sortConfig.map(s => 
                        s.key === sort.key 
                          ? { ...s, direction: s.direction === 'asc' ? ('desc' as const) : ('asc' as const) }
                          : s
                      )
                      onSortChange(newSortConfig)
                    }}
                    onRemove={() => {
                      const newSortConfig = sortConfig.filter(s => s.key !== sort.key)
                      onSortChange(newSortConfig)
                    }}
                  />
                )
              })}
            </SortableContext>
          </DndContext>
        </div>
        {sortConfig.length > 0 && <DropdownMenuSeparator />}
        {columns
          .filter(col => !sortConfig.some(s => s.key === col.name))
          .map(col => (
            <DropdownMenuItem
              key={col.name}
              onSelect={() => {
                onSortChange([...sortConfig, { key: col.name, direction: 'asc' as const }])
              }}
            >
              {showColumnNames ? col.name : col.label}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

