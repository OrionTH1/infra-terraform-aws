import { Handle, useNodeId, type HandleProps } from '@xyflow/react'
import { boundaryDirection, boundaryKey, formatRule, securityGroupBoundary } from '../../simulation/security-groups'
import {
  useSecurityGroupStore,
  type BoundaryAnchor,
  type HoveredBoundary,
  type TooltipContent,
} from '../../store/useSecurityGroupStore'
import type { SecurityGroupBoundary } from '../../simulation/security-groups'

function tooltipFor(boundary: SecurityGroupBoundary): TooltipContent {
  const direction = boundaryDirection(boundary)

  return {
    title: 'Security Group',
    subtitle: `${direction.toUpperCase()} · ${boundary.rules[0].securityGroup}`,
    lines: boundary.rules.map(formatRule),
    side: direction === 'ingress' ? 'left' : 'right',
  }
}

function anchorOf(element: HTMLElement): BoundaryAnchor {
  const rect = element.getBoundingClientRect()

  return { top: rect.top, left: rect.left, right: rect.right, height: rect.height }
}

interface SecurityGroupHandleProps extends HandleProps {
  nodeType: string
  style?: React.CSSProperties
}

export function SecurityGroupHandle({ nodeType, id, ...handleProps }: SecurityGroupHandleProps) {
  const nodeId = useNodeId()
  const boundary = id ? securityGroupBoundary(nodeType, id) : null

  const key = boundaryKey(nodeId ?? nodeType, id ?? '')
  const hoveredPairId = useSecurityGroupStore((state) => state.hoveredPairId)
  const hoveredKey = useSecurityGroupStore((state) => state.hoveredKey)
  const hoverBoundary = useSecurityGroupStore((state) => state.hoverBoundary)
  const toggleBoundary = useSecurityGroupStore((state) => state.toggleBoundary)
  const clearBoundary = useSecurityGroupStore((state) => state.clearBoundary)

  if (!boundary) return <Handle id={id} {...handleProps} />

  const direction = boundaryDirection(boundary)
  const isIngress = direction === 'ingress'
  const isPaired = boundary.pairId !== null && boundary.pairId === hoveredPairId
  const isOpen = hoveredKey === key
  const isLit = isOpen || isPaired

  const markClass = `shrink-0 transition-colors duration-150 ${isLit ? 'lit' : ''}`

  const hovered = (element: HTMLElement): HoveredBoundary => ({
    key,
    nodeId: nodeId ?? '',
    boundaryId: boundaryKey(nodeType, id ?? ''),
    pairId: boundary.pairId,
    anchor: anchorOf(element),
    content: tooltipFor(boundary),
  })

  return (
    <Handle
      id={id}
      {...handleProps}
      className={`sg-handle ${isOpen ? 'sg-handle-open' : ''}`}
      tabIndex={0}
      role="button"
      aria-expanded={isOpen}
      aria-label={`${direction} ${boundary.rules[0].securityGroup}: ${boundary.rules.map(formatRule).join(', ')}`}
      onMouseEnter={(event) => hoverBoundary(hovered(event.currentTarget))}
      onMouseLeave={() => clearBoundary(key)}
      onFocus={(event) => hoverBoundary(hovered(event.currentTarget))}
      onBlur={() => clearBoundary(key)}
      onClick={(event) => toggleBoundary(hovered(event.currentTarget))}
    >
      <span
        className={`pointer-events-none flex items-center gap-[3px] ${isIngress ? 'flex-row-reverse' : 'flex-row'}`}
      >
        <span className={`${markClass} sg-bar`} />
        <span className={`${markClass} sg-arrow`} />
      </span>

    </Handle>
  )
}
