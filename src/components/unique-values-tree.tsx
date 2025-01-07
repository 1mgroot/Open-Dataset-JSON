import React from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface UniqueValue {
  value: string;
  frequency: number;
}

interface UniqueValuesTreeProps {
  uniqueValuesMap: {
    [columnName: string]: {
      values: UniqueValue[];
      isNumeric: boolean;
      exceedsLimit: boolean;
    }
  }
}

interface TreeNodeProps {
  name: string;
  values: UniqueValue[];
  isNumeric: boolean;
  exceedsLimit: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  name,
  values,
  isNumeric,
  exceedsLimit,
  isOpen,
  onToggle
}) => {
  const totalCount = values.reduce((sum, v) => sum + v.frequency, 0)
  
  return (
    <div className="font-mono">
      <div 
        className="flex items-center gap-2 py-1 px-2 hover:bg-gray-100 rounded cursor-pointer"
        onClick={onToggle}
      >
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-semibold">{name}</span>
        <Badge variant={isNumeric ? "default" : "secondary"} className="ml-2">
          {isNumeric ? "numeric" : "text"}
        </Badge>
        <Badge variant="outline" className="ml-2">
          {exceedsLimit ? "100+" : values.length} unique
        </Badge>
        {!exceedsLimit && (
          <Badge variant="outline" className="ml-2">
            {totalCount} total
          </Badge>
        )}
      </div>
      {isOpen && (
        <div className="ml-6 border-l pl-4">
          {exceedsLimit ? (
            <div className="text-sm text-gray-500 py-1">
              Too many unique values to display (more than 100)
            </div>
          ) : (
            values.map(({ value, frequency }, index) => (
              <div 
                key={index}
                className="text-sm py-1 px-2 hover:bg-gray-100 rounded flex items-center justify-between"
              >
                <span className="truncate flex-1">
                  {value || "(empty)"}
                </span>
                <div className="flex items-center gap-2 ml-4">
                  <Badge variant="secondary" className="min-w-[4rem] text-center">
                    {frequency}
                  </Badge>
                  <Badge variant="outline" className="min-w-[4rem] text-center">
                    {((frequency / totalCount) * 100).toFixed(1)}%
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export const UniqueValuesTree: React.FC<UniqueValuesTreeProps> = ({ uniqueValuesMap }) => {
  const [openNodes, setOpenNodes] = React.useState<Set<string>>(new Set())

  const toggleNode = (name: string) => {
    const newOpenNodes = new Set(openNodes)
    if (newOpenNodes.has(name)) {
      newOpenNodes.delete(name)
    } else {
      newOpenNodes.add(name)
    }
    setOpenNodes(newOpenNodes)
  }

  return (
    <ScrollArea className="h-[500px] w-full pr-4">
      <div className="space-y-1">
        {Object.entries(uniqueValuesMap).map(([name, { values, isNumeric, exceedsLimit }]) => (
          <TreeNode
            key={name}
            name={name}
            values={values}
            isNumeric={isNumeric}
            exceedsLimit={exceedsLimit}
            isOpen={openNodes.has(name)}
            onToggle={() => toggleNode(name)}
          />
        ))}
      </div>
    </ScrollArea>
  )
} 