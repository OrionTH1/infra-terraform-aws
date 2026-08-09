import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { EcsServiceFlowNode } from '../../types/node-data'
import { FrameSummary, NodeFrame } from '../shared/NodeFrame'
import { SecurityGroupHandle } from '../shared/SecurityGroupHandle'
import { EcsServiceIcon } from '../../icons'

export function EcsServiceNode({ data }: NodeProps<EcsServiceFlowNode>) {
  return (
    <NodeFrame
      label={data.label}
      tooltip={data.tooltip}
      width={data.width}
      height={data.height}
      tone="ownership"
      icon={<EcsServiceIcon />}
      summary={
        <FrameSummary>
          desired {data.desiredCount} · running {data.runningTaskCount}
          {data.pendingTaskCount > 0 ? ` · pending ${data.pendingTaskCount}` : ''}
        </FrameSummary>
      }
      handles={
        <>
          <Handle type="target" position={Position.Top} id="desired-count-in" isConnectable={false} />
          <SecurityGroupHandle
            nodeType="ecsService"
            type="source"
            position={Position.Bottom}
            id="logs-out"
            isConnectable={false}
          />
        </>
      }
    />
  )
}
