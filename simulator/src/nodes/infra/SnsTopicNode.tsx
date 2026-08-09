import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { SnsTopicFlowNode } from '../../types/node-data'
import { NodeCard } from '../shared/NodeCard'
import { NotifyIcon } from '../../icons'

export function SnsTopicNode({ data }: NodeProps<SnsTopicFlowNode>) {
  return (
    <NodeCard
      variant="control"
      icon={<NotifyIcon />}
      title={data.label}
      tooltip={data.tooltip}
      status={data.status}
      handles={<Handle type="target" position={Position.Left} id="notify-in" isConnectable={false} />}
    >
      <div className="flex w-[186px] flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              data.isPublishing ? 'alarm-pulse bg-status-error' : 'bg-border'
            }`}
          />
          <span className="truncate font-mono text-[11px] text-fg-muted">{data.topicName}</span>
        </div>
        <span className="font-mono text-[11px] text-fg">
          {data.isPublishing ? `Publish · ${data.firingCount} in ALARM` : 'no message to publish'}
        </span>
        <span className="font-mono text-[10px] text-fg-muted">{data.subscription}</span>
      </div>
    </NodeCard>
  )
}
