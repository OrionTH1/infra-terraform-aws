import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { AlarmRow, CloudWatchAlarmsFlowNode } from '../../types/node-data'
import { NodeCard } from '../shared/NodeCard'
import { AlarmIcon } from '../../icons'

const STATE_DOT = {
  ALARM: 'bg-status-error alarm-pulse',
  OK: 'bg-status-healthy',
  INSUFFICIENT_DATA: 'bg-border',
}

const STATE_TEXT = {
  ALARM: 'text-status-error',
  OK: 'text-fg',
  INSUFFICIENT_DATA: 'text-fg-muted',
}

function AlarmLine({ row }: { row: AlarmRow }) {
  return (
    <div className={`flex items-center gap-1.5 ${row.isModelled ? '' : 'opacity-55'}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATE_DOT[row.state]}`} />
      <span className={`flex-1 truncate font-mono text-[11px] ${STATE_TEXT[row.state]}`}>{row.name}</span>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-fg-muted">{row.condition}</span>
    </div>
  )
}

export function CloudWatchAlarmsNode({ data }: NodeProps<CloudWatchAlarmsFlowNode>) {
  return (
    <NodeCard
      variant="control"
      icon={<AlarmIcon />}
      title={data.label}
      tooltip={data.tooltip}
      status={data.status}
      handles={
        <>
          <Handle type="target" position={Position.Left} id="metric-in" isConnectable={false} />
          <Handle type="source" position={Position.Right} id="notify-out" isConnectable={false} />
        </>
      }
    >
      <div className="flex w-[236px] flex-col gap-1">
        {data.rows.map((row) => (
          <AlarmLine key={row.key} row={row} />
        ))}
        <span className="border-t border-border/50 pt-1.5 font-mono text-[10px] text-fg-muted">
          {data.firingCount === 0 ? 'nothing in alarm' : `${data.firingCount} in alarm`} · dimmed rows have no metric
          here
        </span>
      </div>
    </NodeCard>
  )
}
