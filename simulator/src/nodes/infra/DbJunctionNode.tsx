import { Handle, Position, type NodeProps } from '@xyflow/react'
import { DB_JUNCTION_SIZE } from '../../canvas/initial-graph'
import type { JunctionFlowNode } from '../../types/node-data'

const AXIS_HANDLES = {
  horizontal: { entry: Position.Left, exit: Position.Right },
  vertical: { entry: Position.Top, exit: Position.Bottom },
} as const

export function DbJunctionNode({ data }: NodeProps<JunctionFlowNode>) {
  const { entry, exit } = AXIS_HANDLES[data.axis]

  return (
    <div
      className="rounded-full border border-border bg-surface-raised"
      style={{ width: DB_JUNCTION_SIZE, height: DB_JUNCTION_SIZE }}
      title={data.hint}
    >
      <Handle type="target" position={entry} id="in" isConnectable={false} />
      <Handle type="source" position={exit} id="out" isConnectable={false} />
    </div>
  )
}
