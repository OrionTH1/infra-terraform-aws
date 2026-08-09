import { Handle, Position, type NodeProps } from '@xyflow/react'
import { DOOR_HEIGHT, DOOR_WIDTH } from '../../canvas/initial-graph'
import { useSecurityGroupStore, type BoundaryAnchor } from '../../store/useSecurityGroupStore'
import type { VpcDoorFlowNode } from '../../types/node-data'

const WALL_MASK_HEIGHT = 3
const MARK_WIDTH = 24
const MARK_HEIGHT = 8

function anchorOf(element: HTMLElement): BoundaryAnchor {
  const rect = element.getBoundingClientRect()

  return { top: rect.top, left: rect.left, right: rect.right, height: rect.height }
}

export function VpcDoorNode({ id, data }: NodeProps<VpcDoorFlowNode>) {
  const hoveredKey = useSecurityGroupStore((state) => state.hoveredKey)
  const hoverBoundary = useSecurityGroupStore((state) => state.hoverBoundary)
  const toggleBoundary = useSecurityGroupStore((state) => state.toggleBoundary)
  const clearBoundary = useSecurityGroupStore((state) => state.clearBoundary)

  const isOpen = hoveredKey === id
  const content = {
    title: `${data.label} Endpoint`,
    lines: [...data.services, data.footnote],
    side: 'right' as const,
  }
  const hovered = (element: HTMLElement) => ({
    key: id,
    nodeId: id,
    boundaryId: null,
    pairId: null,
    anchor: anchorOf(element),
    content,
  })
  const open = (event: { currentTarget: HTMLElement }) => hoverBoundary(hovered(event.currentTarget))

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      aria-label={`${data.label} endpoint: ${data.services.join(', ')}`}
      className="nodrag door group/door flex cursor-help flex-col items-center"
      style={{ width: DOOR_WIDTH }}
      onMouseEnter={open}
      onMouseLeave={() => clearBoundary(id)}
      onFocus={open}
      onBlur={() => clearBoundary(id)}
      onClick={(event) => toggleBoundary(hovered(event.currentTarget))}
    >
      <Handle type="target" position={Position.Top} id="in" isConnectable={false} />

      <div className="door-opening relative w-full" style={{ height: DOOR_HEIGHT }}>
        <span
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-canvas"
          style={{ height: WALL_MASK_HEIGHT }}
        />
        <span className="door-jamb absolute left-0 top-0 h-full w-px" />
        <span className="door-jamb absolute right-0 top-0 h-full w-px" />
        <span
          className={`door-mark absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
            data.isCarrying ? 'carrying' : ''
          }`}
          style={{ width: MARK_WIDTH, height: MARK_HEIGHT }}
        />
      </div>

      <span className="door-label mt-1.5 font-sans text-[9px] font-semibold uppercase tracking-[0.14em]">
        {data.label}
      </span>

      <Handle type="source" position={Position.Bottom} id="out" isConnectable={false} />
    </div>
  )
}
