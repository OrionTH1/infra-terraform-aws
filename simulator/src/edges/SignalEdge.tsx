import { getBezierPath, type EdgeProps } from '@xyflow/react'
import type { SignalEdge as SignalEdgeType, SignalVariant } from '../types/edge-data'

interface VariantStyle {
  dashArray: string
  strokeWidth: number
  activeClass: string
  alertClass?: string
}

const VARIANT_STYLE: Record<SignalVariant, VariantStyle> = {
  association: {
    dashArray: '4 4',
    strokeWidth: 1.5,
    activeClass: 'stroke-border-interaction signal-dash',
    alertClass: 'stroke-status-warning signal-dash',
  },
  metric: { dashArray: '2 6', strokeWidth: 1.5, activeClass: 'stroke-border-interaction signal-dash' },
  command: {
    dashArray: '6 4',
    strokeWidth: 2,
    activeClass: 'stroke-border-interaction signal-dash',
    alertClass: 'stroke-status-error signal-dash',
  },
}

export function SignalEdge({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
}: EdgeProps<SignalEdgeType>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

  const variant = data?.variant ?? 'association'
  const isActive = data?.isActive ?? false
  const isAlerting = data?.isAlerting ?? false
  const style = VARIANT_STYLE[variant]
  const activeClass = isAlerting ? (style.alertClass ?? style.activeClass) : style.activeClass

  return (
    <g className="edge-fade-in">
      <path
        d={path}
        fill="none"
        strokeWidth={style.strokeWidth}
        strokeDasharray={style.dashArray}
        strokeOpacity={isActive ? 1 : 0.35}
        className={isActive ? activeClass : 'stroke-border'}
      />
      {data?.label ? (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="central"
          strokeWidth={4}
          paintOrder="stroke"
          className={`stroke-canvas font-mono text-[9px] font-medium tracking-wide transition-colors duration-300 ${
            isActive ? 'fill-fg' : 'fill-fg-muted'
          }`}
        >
          {data.label}
        </text>
      ) : null}
    </g>
  )
}
