import type { Node } from '@xyflow/react'
import type { AutoScalingAlarm } from '../simulation/autoscaling-alarm'
import type { AlarmMetricKey, AlarmState } from '../simulation/observability-alarms'
import type { TaskFlowNode } from './task-data'

export type NodeStatus = 'idle' | 'healthy' | 'warning' | 'error'

export interface ProvisioningInfo {
  detail: string
  label?: string
  startedAt: number
  durationMs: number
}

export interface InfraNodeData extends Record<string, unknown> {
  label: string
  tooltip: string
  status: NodeStatus
  provisioning?: ProvisioningInfo | null
}

export type TrafficPattern = 'constant' | 'ramp' | 'burst'

export interface UserNodeData extends Record<string, unknown> {
  label: string
  tooltip: string
  pattern: TrafficPattern
  patternStartedAt: number
  peakRequestsPerMinute: number
  rampFromRequestsPerMinute: number
  requestsPerMinute: number
  sourceIp: string
  isRateLimited: boolean
}

export interface UserGroupNodeData extends Record<string, unknown> {
  label: string
  tooltip: string
  pattern: TrafficPattern
  patternStartedAt: number
  peakRequestsPerMinute: number
  rampFromRequestsPerMinute: number
  requestsPerMinute: number
  userCount: number
  sourceIps: string[]
  rateLimitedIpCount: number
}

export interface WafNodeData extends InfraNodeData {
  inspectedRequestsPerMinute: number
  blockedRequests: number
  blockedIps: string[]
}

export interface AlbNodeData extends InfraNodeData {
  requestsPerMinute: number
  healthyTargetCount: number
  latencyMs: number
  latencyHistory: number[]
}

export interface EcsServiceNodeData extends InfraNodeData {
  width: number
  height: number
  desiredCount: number
  runningTaskCount: number
  pendingTaskCount: number
}

export interface AutoScalingNodeData extends InfraNodeData {
  requestsPerMinutePerTask: number | null
  targetRequestsPerMinutePerTask: number
  alarm: AutoScalingAlarm
  minCapacity: number
  maxCapacity: number
  desiredCount: number
}

export interface TargetGroupNodeData extends InfraNodeData {
  width: number
  height: number
  registeredTargetCount: number
  healthyTargetCount: number
}

export interface AuroraClusterNodeData extends InfraNodeData {
  width: number
  height: number
}

export interface NetworkZoneNodeData extends InfraNodeData {
  tone: 'perimeter' | 'ownership' | 'region'
  width: number
  height: number
  summary: string
  isRepelling?: boolean
}

export interface JunctionNodeData extends Record<string, unknown> {
  hint: string
  axis: 'horizontal' | 'vertical'
}

export interface VpcDoorNodeData extends Record<string, unknown> {
  kind: 'interface' | 'gateway'
  label: string
  services: string[]
  footnote: string
  isCarrying: boolean
}

export interface RegionalServiceNodeData extends InfraNodeData {
  role: 'registry' | 'logs' | 'secrets' | 'storage'
  detail: string
  footnote: string
  isServing: boolean
}

export interface AlarmRow {
  key: AlarmMetricKey
  name: string
  condition: string
  state: AlarmState
  isModelled: boolean
}

export interface CloudWatchAlarmsNodeData extends InfraNodeData {
  rows: AlarmRow[]
  firingCount: number
}

export interface SnsTopicNodeData extends InfraNodeData {
  topicName: string
  subscription: string
  firingCount: number
  isPublishing: boolean
}

export type ClusterVolumeNodeData = InfraNodeData

export type RdsInstanceRole = 'writer' | 'reader'
export type RdsInstanceLifecycle = 'provisioning' | 'promoting' | 'available' | 'failed'

export interface RdsInstanceNodeData extends InfraNodeData {
  availabilityZone: string
  role: RdsInstanceRole
  lifecycle: RdsInstanceLifecycle
  requestsPerMinute: number
  latencyMs: number
  acu: number
  isApplyingRedo: boolean
  cacheHitRatio: number | null
  isAbsorbingFallbackReads: boolean
}

export type AlbFlowNode = Node<AlbNodeData, 'alb'>
export type EcsServiceFlowNode = Node<EcsServiceNodeData, 'ecsService'>
export type AutoScalingFlowNode = Node<AutoScalingNodeData, 'autoScaling'>
export type UserFlowNode = Node<UserNodeData, 'user'>
export type UserGroupFlowNode = Node<UserGroupNodeData, 'userGroup'>
export type WafFlowNode = Node<WafNodeData, 'waf'>
export type TargetGroupFlowNode = Node<TargetGroupNodeData, 'targetGroup'>
export type JunctionFlowNode = Node<JunctionNodeData, 'dbJunction'>
export type AuroraClusterFlowNode = Node<AuroraClusterNodeData, 'auroraCluster'>
export type NetworkZoneFlowNode = Node<NetworkZoneNodeData, 'networkZone'>
export type VpcDoorFlowNode = Node<VpcDoorNodeData, 'vpcDoor'>
export type RegionalServiceFlowNode = Node<RegionalServiceNodeData, 'regionalService'>
export type ClusterVolumeFlowNode = Node<ClusterVolumeNodeData, 'clusterVolume'>
export type CloudWatchAlarmsFlowNode = Node<CloudWatchAlarmsNodeData, 'cloudWatchAlarms'>
export type SnsTopicFlowNode = Node<SnsTopicNodeData, 'snsTopic'>
export type RdsInstanceFlowNode = Node<RdsInstanceNodeData, 'rdsInstance'>

export type SimulatorFlowNode =
  | AlbFlowNode
  | EcsServiceFlowNode
  | AutoScalingFlowNode
  | UserFlowNode
  | UserGroupFlowNode
  | WafFlowNode
  | TargetGroupFlowNode
  | JunctionFlowNode
  | TaskFlowNode
  | AuroraClusterFlowNode
  | NetworkZoneFlowNode
  | VpcDoorFlowNode
  | RegionalServiceFlowNode
  | ClusterVolumeFlowNode
  | CloudWatchAlarmsFlowNode
  | SnsTopicFlowNode
  | RdsInstanceFlowNode
