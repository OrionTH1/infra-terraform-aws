import { useCallback, useMemo } from 'react'
import {
  ALB_NODE_ID,
  EDGE_RESOURCE_ID,
  JUNCTION_TO_READER_EDGE_ID,
  JUNCTION_TO_WRITER_EDGE_ID,
  PAGE_CACHE_EDGE_ID,
  READER_TO_VOLUME_EDGE_ID,
  WRITER_TO_VOLUME_EDGE_ID,
  NODE_RESOURCE_ID,
  WAF_TO_ALB_EDGE_ID,
  METRIC_EDGE_ID,
  DESIRED_COUNT_EDGE_ID,
  ALARMS_TO_SNS_EDGE_ID,
  REGION_NODE_ID,
  isEdgeUnderSecurityGroupRule,
  servicesBehindDoor,
} from '../canvas/initial-graph'
import { useSecurityGroupStore } from '../store/useSecurityGroupStore'
import {
  isAbsorbingFallbackReads,
  isAcceptingTraffic,
  rdsInstanceTerraformAddress,
  routeAuroraTraffic,
  type AuroraAvailability,
} from '../simulation/aurora'
import { currentAlarm } from '../simulation/autoscaling-alarm'
import {
  OBSERVABILITY_ALARMS,
  alarmCondition,
  alarmName,
  isFiring,
} from '../simulation/observability-alarms'
import { countServiceTasks } from '../simulation/task-counts'
import { isPullingImage } from '../simulation/image-pull'
import { isFetchingSecret } from '../simulation/task-egress'
import { BOOT_GRAPH, type ResourceLedger } from '../simulation/boot-graph'
import { AUTOSCALING, RDS_READ_FRACTION } from '../simulation/simulation-config'
import { splitReadWrite } from '../simulation/traffic-distribution'
import { useSimulationStore, type RdsInstanceRuntime } from '../store/useSimulationStore'
import { useRecentChange } from './useRecentChange'
import type { NetworkZoneLayout } from './useNetworkZoneLayout'
import type { TaskGraph } from './useTaskGraph'
import type { TrafficRouting } from './useTrafficRouting'
import type {
  RequestFlowEdge as RequestFlowEdgeType,
  ReplicationEdge as ReplicationEdgeType,
  SignalEdge as SignalEdgeType,
  SimulatorFlowEdge,
} from '../types/edge-data'
import type {
  AlarmRow,
  AlbNodeData,
  AuroraClusterNodeData,
  CloudWatchAlarmsNodeData,
  SnsTopicNodeData,
  AutoScalingNodeData,
  EcsServiceNodeData,
  NetworkZoneNodeData,
  RegionalServiceNodeData,
  ProvisioningInfo,
  RdsInstanceNodeData,
  SimulatorFlowNode,
  UserGroupNodeData,
  UserNodeData,
  VpcDoorNodeData,
  WafNodeData,
} from '../types/node-data'

interface RenderGraphArgs {
  nodes: SimulatorFlowNode[]
  edges: SimulatorFlowEdge[]
  routing: TrafficRouting
  taskGraph: TaskGraph
  networkZones: NetworkZoneLayout
  isRepelling: boolean
  readCacheHitRatio: number
}

export interface RenderGraph {
  renderNodes: SimulatorFlowNode[]
  renderEdges: SimulatorFlowEdge[]
  liveEdgeIds: Set<string>
  deliveredRequests: number
  hasNoReachableTargets: boolean
  rdsReads: number
  rdsWrites: number
}

function isNodeCreated(ledger: ResourceLedger, nodeId: string): boolean {
  const resourceId = NODE_RESOURCE_ID[nodeId]
  return resourceId === undefined || ledger[resourceId].status === 'created'
}

function isNodeVisible(ledger: ResourceLedger, nodeId: string): boolean {
  const resourceId = NODE_RESOURCE_ID[nodeId]
  return resourceId === undefined || ledger[resourceId].status !== 'pending'
}

function provisioningInfo(ledger: ResourceLedger, nodeId: string): ProvisioningInfo | null {
  const resourceId = NODE_RESOURCE_ID[nodeId]
  if (resourceId === undefined) return null

  const resource = ledger[resourceId]
  if (resource.status !== 'creating') return null

  return {
    detail: BOOT_GRAPH[resourceId].terraformAddress,
    startedAt: resource.startedAt ?? 0,
    durationMs: BOOT_GRAPH[resourceId].durationMs,
  }
}

function rdsInstanceProvisioning(slot: RdsInstanceRuntime | null): ProvisioningInfo | null {
  if (!slot || slot.durationMs === null) return null
  if (slot.lifecycle === 'promoting') {
    return {
      label: 'Promoting to writer',
      detail: 'AWS-managed failover — not a Terraform action',
      startedAt: slot.stageEnteredAt,
      durationMs: slot.durationMs,
    }
  }
  if (slot.lifecycle === 'provisioning') {
    return {
      detail: rdsInstanceTerraformAddress(slot.instanceId),
      startedAt: slot.stageEnteredAt,
      durationMs: slot.durationMs,
    }
  }
  return null
}

const EDGE_REQUIRED_INSTANCES: Record<string, ('writer' | 'reader')[]> = {
  [JUNCTION_TO_WRITER_EDGE_ID]: ['writer'],
  [WRITER_TO_VOLUME_EDGE_ID]: ['writer'],
  [JUNCTION_TO_READER_EDGE_ID]: ['reader'],
  [READER_TO_VOLUME_EDGE_ID]: ['reader'],
  [PAGE_CACHE_EDGE_ID]: ['writer', 'reader'],
}

function hasRequiredInstances(edgeId: string, availability: AuroraAvailability): boolean {
  const required = EDGE_REQUIRED_INSTANCES[edgeId]
  if (required === undefined) return true

  return required.every((role) =>
    role === 'writer' ? availability.isWriterAvailable : availability.isReaderAvailable,
  )
}

const SCALING_COMMAND_MS = 1400


function isEdgeVisible(ledger: ResourceLedger, edge: SimulatorFlowEdge, availability: AuroraAvailability): boolean {
  if (!hasRequiredInstances(edge.id, availability)) return false

  const resourceId = EDGE_RESOURCE_ID[edge.id]
  if (resourceId !== undefined) return ledger[resourceId].status === 'created'

  return isNodeCreated(ledger, edge.source) && isNodeCreated(ledger, edge.target)
}

export function useRenderGraph({
  nodes,
  edges,
  routing,
  taskGraph,
  networkZones,
  isRepelling,
  readCacheHitRatio,
}: RenderGraphArgs): RenderGraph {
  const resources = useSimulationStore((state) => state.resources)
  const tasks = useSimulationStore((state) => state.tasks)
  const wafBlockedRequests = useSimulationStore((state) => state.wafBlockedRequests)
  const blockedIps = useSimulationStore((state) => state.blockedIps)
  const rdsSlots = useSimulationStore((state) => state.rdsSlots)
  const latency = useSimulationStore((state) => state.displayedLatency)
  const latencyHistory = useSimulationStore((state) => state.latencyHistory)
  const desiredCount = useSimulationStore((state) => state.desiredCount)
  const scaleOutBreachAt = useSimulationStore((state) => state.scaleOutBreachAt)
  const scaleInBreachAt = useSimulationStore((state) => state.scaleInBreachAt)
  const alarmBoard = useSimulationStore((state) => state.alarms)
  const hoveredBoundaryId = useSecurityGroupStore((state) => state.hoveredBoundaryId)

  const alarmRows = useMemo(
    (): AlarmRow[] =>
      OBSERVABILITY_ALARMS.map((alarm) => ({
        key: alarm.key,
        name: alarmName(alarm),
        condition: alarmCondition(alarm),
        state: alarmBoard[alarm.key].state,
        isModelled: alarm.isModelled,
      })),
    [alarmBoard],
  )

  const firingAlarmCount = useMemo(
    () => OBSERVABILITY_ALARMS.filter((alarm) => isFiring(alarmBoard[alarm.key])).length,
    [alarmBoard],
  )

  const serviceTaskCounts = useMemo(() => countServiceTasks(tasks.map((task) => task.status)), [tasks])
  const isPullingTaskImage = useMemo(() => isPullingImage(tasks.map((task) => task.status)), [tasks])
  const isFetchingAnySecret = useMemo(() => tasks.some((task) => isFetchingSecret(task.status)), [tasks])
  const isShippingLogs = routing.healthyTaskCount > 0 && routing.totalRequestsAtAlb > 0

  const isServingRegionally = useCallback(
    (role: RegionalServiceNodeData['role']) => {
      if (role === 'secrets') return isFetchingAnySecret
      if (role === 'logs') return isShippingLogs

      return isPullingTaskImage
    },
    [isFetchingAnySecret, isShippingLogs, isPullingTaskImage],
  )

  const isScalingCommandLive = useRecentChange(desiredCount, SCALING_COMMAND_MS)
  const alarm = useMemo(
    () => currentAlarm(scaleOutBreachAt, scaleInBreachAt),
    [scaleOutBreachAt, scaleInBreachAt],
  )

  const requestsPerMinutePerTask =
    routing.healthyTaskCount > 0 ? Math.round(routing.totalRequestsAtAlb / routing.healthyTaskCount) : null

  const hasNoHealthyTargets = routing.healthyTaskCount === 0
  const hasNoReachableTargets = routing.servingTaskCount === 0
  const deliveredRequests = hasNoReachableTargets ? 0 : routing.totalRequestsAtAlb

  const { reads: rdsReads, writes: rdsWrites } = useMemo(
    () => splitReadWrite(deliveredRequests, RDS_READ_FRACTION),
    [deliveredRequests],
  )

  const availability = useMemo(
    (): AuroraAvailability => ({
      isWriterAvailable: isAcceptingTraffic(rdsSlots.writer?.lifecycle),
      isReaderAvailable: isAcceptingTraffic(rdsSlots.reader?.lifecycle),
    }),
    [rdsSlots],
  )

  const auroraTraffic = useMemo(
    () => routeAuroraTraffic(rdsReads, rdsWrites, availability),
    [rdsReads, rdsWrites, availability],
  )

  const renderNodes = useMemo(() => {
    const projected = nodes
      .filter((node) => isNodeVisible(resources, node.id))
      .map((node): SimulatorFlowNode => {
        const provisioning = provisioningInfo(resources, node.id)

        if (node.type === 'alb') {
          const data: AlbNodeData = {
            ...node.data,
            provisioning,
            requestsPerMinute: routing.totalRequestsAtAlb,
            healthyTargetCount: routing.healthyTaskCount,
            latencyMs: latency.totalMs,
            latencyHistory,
            status: hasNoHealthyTargets && routing.totalRequestsAtAlb > 0 ? 'error' : 'idle',
          }
          return { ...node, data }
        }

        if (node.type === 'networkZone') {
          const frame = networkZones.framesByNodeId.get(node.id)
          if (frame === undefined) return node

          const data: NetworkZoneNodeData = {
            ...node.data,
            width: frame.width,
            height: frame.height,
            isRepelling: isRepelling && node.id === REGION_NODE_ID,
          }
          return { ...node, position: frame.position, data }
        }

        if (node.type === 'auroraCluster') {
          const frame = networkZones.framesByNodeId.get(node.id)
          if (frame === undefined) return node

          const data: AuroraClusterNodeData = { ...node.data, width: frame.width, height: frame.height }
          return { ...node, position: frame.position, data }
        }

        if (node.type === 'dbJunction') {
          const position = networkZones.positionsByNodeId.get(node.id)

          return position === undefined ? node : { ...node, position }
        }

        if (node.type === 'vpcDoor') {
          const position = networkZones.positionsByNodeId.get(node.id)
          if (position === undefined) return node

          const data: VpcDoorNodeData = {
            ...node.data,
            isCarrying: servicesBehindDoor(node.data.kind).some(isServingRegionally),
          }
          return { ...node, position, data }
        }

        if (node.type === 'regionalService') {
          const position = networkZones.positionsByNodeId.get(node.id)
          if (position === undefined) return node

          const data: RegionalServiceNodeData = { ...node.data, isServing: isServingRegionally(node.data.role) }
          return { ...node, position, data }
        }

        if (node.type === 'cloudWatchAlarms') {
          const data: CloudWatchAlarmsNodeData = {
            ...node.data,
            rows: alarmRows,
            firingCount: firingAlarmCount,
            status: firingAlarmCount > 0 ? 'error' : 'idle',
          }
          return { ...node, position: networkZones.cloudWatchAlarmsPosition, data }
        }

        if (node.type === 'snsTopic') {
          const data: SnsTopicNodeData = {
            ...node.data,
            firingCount: firingAlarmCount,
            isPublishing: firingAlarmCount > 0,
            status: firingAlarmCount > 0 ? 'error' : 'idle',
          }
          return { ...node, position: networkZones.snsTopicPosition, data }
        }

        if (node.type === 'waf') {
          const data: WafNodeData = {
            ...node.data,
            provisioning,
            inspectedRequestsPerMinute: routing.totalRequestsSent,
            blockedRequests: wafBlockedRequests,
            blockedIps,
            status: blockedIps.length > 0 ? 'warning' : 'idle',
          }
          return { ...node, position: networkZones.wafPosition, data }
        }

        if (node.type === 'user') {
          const data: UserNodeData = { ...node.data, isRateLimited: routing.blockedUserIds.has(node.id) }
          return { ...node, data }
        }

        if (node.type === 'userGroup') {
          const data: UserGroupNodeData = {
            ...node.data,
            rateLimitedIpCount: routing.blockedIpCountByUserId.get(node.id) ?? 0,
          }
          return { ...node, data }
        }

        if (node.type === 'ecsService') {
          const data: EcsServiceNodeData = {
            ...node.data,
            provisioning,
            width: taskGraph.serviceFrame.width,
            height: taskGraph.serviceFrame.height,
            desiredCount,
            runningTaskCount: serviceTaskCounts.running,
            pendingTaskCount: serviceTaskCounts.pending,
          }
          return { ...node, position: taskGraph.serviceFrame.position, data }
        }

        if (node.type === 'autoScaling') {
          const data: AutoScalingNodeData = {
            ...node.data,
            provisioning,
            requestsPerMinutePerTask,
            targetRequestsPerMinutePerTask: AUTOSCALING.targetRequestsPerMinutePerTask,
            alarm,
            minCapacity: AUTOSCALING.minCapacity,
            maxCapacity: AUTOSCALING.maxCapacity,
            desiredCount,
            status: alarm.name === 'high' ? 'warning' : 'idle',
          }
          return { ...node, position: networkZones.autoScalingPosition, data }
        }

        if (node.type === 'rdsInstance') {
          const isWriter = node.data.role === 'writer'
          const slot = isWriter ? rdsSlots.writer : rdsSlots.reader
          const slotProvisioning = rdsInstanceProvisioning(slot)

          const data: RdsInstanceNodeData = {
            ...node.data,
            provisioning: slotProvisioning ?? provisioning,
            lifecycle: slot?.lifecycle ?? 'available',
            status: slot?.lifecycle === 'failed' ? 'error' : slotProvisioning ?? provisioning ? 'warning' : 'healthy',
            requestsPerMinute: isWriter
              ? auroraTraffic.writerRequestsPerMinute
              : auroraTraffic.readerRequestsPerMinute,
            latencyMs: isWriter ? latency.writerMs : latency.readerMs,
            acu: slot?.acu ?? 0,
            isApplyingRedo:
              !isWriter && availability.isReaderAvailable && auroraTraffic.committedWritesPerMinute > 0,
            cacheHitRatio: isWriter ? null : readCacheHitRatio,
            isAbsorbingFallbackReads: isWriter && isAbsorbingFallbackReads(rdsReads, availability),
          }
          return { ...node, data }
        }

        return node
      })

    const assembled = taskGraph.targetGroupNode
      ? [taskGraph.targetGroupNode, ...projected, ...taskGraph.taskNodes]
      : [...projected, ...taskGraph.taskNodes]

    return assembled
  }, [
    nodes,
    resources,
    routing,
    rdsReads,
    hasNoHealthyTargets,
    serviceTaskCounts,
    isServingRegionally,
    isRepelling,
    alarmRows,
    firingAlarmCount,
    taskGraph,
    networkZones,
    auroraTraffic,
    availability,
    wafBlockedRequests,
    blockedIps,
    rdsSlots,
    alarm,
    desiredCount,
    requestsPerMinutePerTask,
    latency,
    latencyHistory,
  ])

  const renderEdges = useMemo(() => {
    const projected = edges
      .filter((edge) => isEdgeVisible(resources, edge, availability))
      .map((edge): SimulatorFlowEdge => {
        if (edge.id === WAF_TO_ALB_EDGE_ID) {
          return {
            ...edge,
            data: {
              isActive: routing.totalRequestsSent > 0,
              isAlerting: blockedIps.length > 0,
              variant: 'association',
              label: blockedIps.length > 0 ? 'blocking' : 'inspecting',
            },
          } as SignalEdgeType
        }
        if (edge.id === METRIC_EDGE_ID) {
          return {
            ...edge,
            data: {
              isActive: requestsPerMinutePerTask !== null && requestsPerMinutePerTask > 0,
              variant: 'metric',
              label: 'req/target',
            },
          } as SignalEdgeType
        }
        if (edge.id === DESIRED_COUNT_EDGE_ID) {
          return {
            ...edge,
            data: {
              isActive: isScalingCommandLive,
              variant: 'command',
              label: `UpdateService · desired ${desiredCount}`,
            },
          } as SignalEdgeType
        }
        if (edge.id === ALARMS_TO_SNS_EDGE_ID) {
          return {
            ...edge,
            data: {
              isActive: firingAlarmCount > 0,
              isAlerting: firingAlarmCount > 0,
              variant: 'command',
              label: firingAlarmCount > 0 ? 'Publish' : 'alarm_actions',
            },
          } as SignalEdgeType
        }
        if (edge.type === 'replication')
          return {
            ...edge,
            data: { isActive: auroraTraffic.committedWritesPerMinute > 0 },
          } as ReplicationEdgeType
        if (edge.id === JUNCTION_TO_WRITER_EDGE_ID || edge.id === WRITER_TO_VOLUME_EDGE_ID)
          return { ...edge, data: { requestsPerMinute: auroraTraffic.writerRequestsPerMinute } } as RequestFlowEdgeType
        if (edge.id === JUNCTION_TO_READER_EDGE_ID || edge.id === READER_TO_VOLUME_EDGE_ID)
          return { ...edge, data: { requestsPerMinute: auroraTraffic.readerRequestsPerMinute } } as RequestFlowEdgeType
        if (edge.target === ALB_NODE_ID) {
          return {
            ...edge,
            data: { requestsPerMinute: routing.requestsByUserId.get(edge.source) ?? 0 },
          } as RequestFlowEdgeType
        }
        return edge
      })

    const withTaskEdges = [...projected, ...taskGraph.taskEdges]
    if (hoveredBoundaryId === null) return withTaskEdges

    return withTaskEdges.map((edge) =>
      edge.type === 'requestFlow' && isEdgeUnderSecurityGroupRule(edge.id, hoveredBoundaryId)
        ? ({ ...edge, data: { ...edge.data, isSecurityGroupLit: true } } as SimulatorFlowEdge)
        : edge,
    )
  }, [
    edges,
    resources,
    routing,
    auroraTraffic,
    availability,
    taskGraph,
    blockedIps,
    desiredCount,
    isScalingCommandLive,
    requestsPerMinutePerTask,
    firingAlarmCount,
    hoveredBoundaryId,
  ])

  const liveEdgeIds = useMemo(() => new Set(renderEdges.map((edge) => edge.id)), [renderEdges])

  return { renderNodes, renderEdges, liveEdgeIds, deliveredRequests, hasNoReachableTargets, rdsReads, rdsWrites }
}
