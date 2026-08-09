import { Position, type NodeProps } from '@xyflow/react'
import { STAGE_DURATION_MS } from '../../simulation/simulation-config'
import { TaskBlastEffect } from './TaskBlastEffect'
import { useTaskBlast } from '../../hooks/useTaskBlast'
import type { NodeStatus } from '../../types/node-data'
import { TASK_STATUS_MESSAGE, type TaskFlowNode, type TaskStatus } from '../../types/task-data'
import { NodeCard } from '../shared/NodeCard'
import { formatDuration, latencyTone, type LatencyTone } from '../shared/latency-format'
import { p50Ms } from '../../simulation/latency'
import { RateReadout } from '../shared/RateReadout'
import { SecurityGroupHandle } from '../shared/SecurityGroupHandle'
import { StageProgress, type StageTone } from '../shared/StageProgress'
import { TaskIcon } from '../../icons'

const STATUS_LABEL: Record<TaskStatus, string> = {
  provisioning: 'Provisioning',
  starting: 'Starting',
  registering: 'Registering',
  healthy: 'Healthy',
  draining: 'Draining',
  failed: 'Stopped',
}

const STATUS_TO_CARD_STATUS: Record<TaskStatus, NodeStatus> = {
  provisioning: 'warning',
  starting: 'warning',
  registering: 'warning',
  healthy: 'healthy',
  draining: 'error',
  failed: 'error',
}

const STATUS_TO_STAGE_TONE: Record<TaskStatus, StageTone> = {
  provisioning: 'warning',
  starting: 'warning',
  registering: 'warning',
  healthy: 'warning',
  draining: 'error',
  failed: 'error',
}

const LATENCY_TONE_CLASS: Record<LatencyTone, string> = {
  idle: 'text-fg',
  warning: 'text-status-warning',
  error: 'text-status-error',
}

const TASK_TOOLTIP =
  'One ECS Fargate task behind the ALB target group. Only healthy tasks are registered in the target group and receive traffic.'

export function TaskNode({ id, data }: NodeProps<TaskFlowNode>) {
  const { isTargetable, blast } = useTaskBlast({ taskId: id, status: data.status })
  const isSettled = data.status === 'healthy'
  const message = TASK_STATUS_MESSAGE[data.status]

  return (
    <NodeCard
      variant="infra"
      compact={isSettled}
      icon={<TaskIcon />}
      title={`Task ${data.taskNumber}`}
      tooltip={TASK_TOOLTIP}
      status={STATUS_TO_CARD_STATUS[data.status]}
      isProvisional={data.status === 'registering'}
      isLeaving={data.isLeaving}
      isTargetable={isTargetable}
      isBlasted={data.status === 'failed'}
      overlay={data.status === 'failed' ? <TaskBlastEffect /> : null}
      onTargetClick={blast}
      handles={
        <>
          <SecurityGroupHandle nodeType="task" type="target" position={Position.Left} id="in" isConnectable={false} />
          <SecurityGroupHandle nodeType="task" type="source" position={Position.Right} id="out" isConnectable={false} />
        </>
      }
    >
      {isSettled ? (
        <div className="flex w-[168px] flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-sans text-[13px] font-medium text-fg">Task {data.taskNumber}</span>
            <span className="font-sans text-[10px] font-medium uppercase tracking-wider text-fg-muted">p50</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <RateReadout value={data.requestsPerMinute} />
            <span className={`font-mono text-[11px] tabular-nums ${LATENCY_TONE_CLASS[latencyTone(data.latencyMs)]}`}>
              {formatDuration(p50Ms(data.latencyMs))}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex w-[204px] flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span key={data.status} className="content-resolve font-sans text-xs font-medium text-fg">
              {STATUS_LABEL[data.status]}
            </span>
            <RateReadout value={data.requestsPerMinute} />
          </div>
          <StageProgress
            durationMs={STAGE_DURATION_MS[data.status]}
            startedAt={data.stageEnteredAt}
            tone={STATUS_TO_STAGE_TONE[data.status]}
          />
          {message === null ? null : (
            <span key={message} className="content-resolve truncate font-mono text-[11px] text-fg-muted">
              {message}
            </span>
          )}
        </div>
      )}
    </NodeCard>
  )
}
