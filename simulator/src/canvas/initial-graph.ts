import { AWS_ALARM_EVALUATION, AURORA_SERVERLESS, AUTOSCALING } from '../simulation/simulation-config'
import { IDLE_LATENCY } from '../simulation/latency'
import { runningFloorAcu } from '../simulation/aurora-capacity'
import { boundaryKey } from '../simulation/security-groups'
import { NO_ALARM } from '../simulation/autoscaling-alarm'
import { GATEWAY_ENDPOINT, INTERFACE_ENDPOINTS } from '../simulation/vpc-endpoints'
import {
  AVAILABILITY_ZONES,
  REGION,
  PRIVATE_SUBNETS,
  PUBLIC_SUBNETS,
  VPC_CIDR,
  VPC_TOOLTIP,
  subnetSummary,
} from '../simulation/network-topology'
import { FRAME_PADDING, frameAround, frameContentBox } from './frame-metrics'
import { networkZoneFrames } from './network-zones'
import type { XYPosition } from '@xyflow/react'
import type { ContentBox, FrameBox } from './frame-metrics'
import type { MeasuredSize } from '../hooks/useMeasuredNodeSizes'
import type { ResourceId } from '../simulation/boot-graph'
import type { SimulatorFlowNode, VpcDoorNodeData } from '../types/node-data'
import type { SimulatorFlowEdge } from '../types/edge-data'

export const ALB_NODE_ID = 'alb'
export const WAF_NODE_ID = 'waf'
export const WAF_TO_ALB_EDGE_ID = 'waf-alb-association'
export const ECS_SERVICE_NODE_ID = 'ecs-service'
export const AUTO_SCALING_NODE_ID = 'auto-scaling'
export const TARGET_GROUP_NODE_ID = 'target-group'
export const RDS_CLUSTER_NODE_ID = 'rds-cluster'
export const RDS_WRITER_NODE_ID = 'rds-writer'
export const RDS_READER_NODE_ID = 'rds-reader'
export const CLUSTER_VOLUME_NODE_ID = 'cluster-volume'
export const WRITER_TO_VOLUME_EDGE_ID = 'rds-writer-volume'
export const READER_TO_VOLUME_EDGE_ID = 'rds-reader-volume'
export const PAGE_CACHE_EDGE_ID = 'rds-writer-reader-page-cache'
export const METRIC_EDGE_ID = 'alb-auto-scaling-metric'
export const DESIRED_COUNT_EDGE_ID = 'auto-scaling-ecs-service-desired-count'
export const REGION_NODE_ID = 'aws-region'
export const VPC_NODE_ID = 'vpc'
export const PUBLIC_SUBNETS_NODE_ID = 'public-subnets'
export const PRIVATE_SUBNETS_NODE_ID = 'private-subnets'
export const INTERFACE_ENDPOINTS_NODE_ID = 'interface-endpoints'
export const GATEWAY_ENDPOINT_NODE_ID = 'gateway-endpoint'
export const ECR_NODE_ID = 'ecr'
export const LAYER_STORAGE_NODE_ID = 'layer-storage'
export const CLOUDWATCH_LOGS_NODE_ID = 'cloudwatch-logs'
export const SECRETS_MANAGER_NODE_ID = 'secrets-manager'
export const CLOUDWATCH_ALARMS_NODE_ID = 'cloudwatch-alarms'
export const SNS_TOPIC_NODE_ID = 'sns-alarm-topic'
export const ALARMS_TO_SNS_EDGE_ID = 'cloudwatch-alarms-sns-topic'
export const ENDPOINT_TO_LOGS_EDGE_ID = 'interface-endpoints-cloudwatch-logs'
export const ENDPOINT_TO_SECRETS_EDGE_ID = 'interface-endpoints-secrets-manager'
export const SERVICE_TO_ENDPOINT_EDGE_ID = 'ecs-service-interface-endpoints'

export function taskToSecretsEdgeId(taskId: string): string {
  return `${taskId}-${SECRETS_MANAGER_NODE_ID}`
}
export const ENDPOINT_TO_ECR_EDGE_ID = 'interface-endpoints-ecr'
export const ENDPOINT_TO_STORAGE_EDGE_ID = 'gateway-endpoint-layer-storage'

export function taskToRegistryEdgeId(taskId: string): string {
  return `${taskId}-${INTERFACE_ENDPOINTS_NODE_ID}`
}

export function taskToStorageEdgeId(taskId: string): string {
  return `${taskId}-${GATEWAY_ENDPOINT_NODE_ID}`
}

export const ALB_POSITION = { x: 360, y: 200 }

export const TASK_COLUMN_X = 920
export const TASK_COLUMN_CENTER_Y = ALB_POSITION.y
export const TASK_ROW_GAP = 10
export const FALLBACK_TASK_HEIGHT = 58
export const FALLBACK_TASK_WIDTH = 230
export const NODE_LEAVE_MS = 340

export const TASK_ZONE_GAP = 40

export const AUTO_SCALING_GAP = 74
export const FALLBACK_AUTO_SCALING_HEIGHT = 210

export const FALLBACK_CARD_WIDTH = 210
export const FALLBACK_CARD_HEIGHT = 132
export const FALLBACK_WAF_HEIGHT = 196

const RDS_INSTANCE_X = TASK_COLUMN_X + 650

export const RDS_WRITER_POSITION = { x: RDS_INSTANCE_X, y: ALB_POSITION.y - 130 }
export const RDS_READER_POSITION = { x: RDS_INSTANCE_X, y: ALB_POSITION.y + 130 }

const INITIAL_CONTROL_PLANE_Y = ALB_POSITION.y - 330

export const CLOUDWATCH_ALARMS_X = RDS_INSTANCE_X
export const SNS_TOPIC_GAP = 320
export const SNS_TOPIC_X = CLOUDWATCH_ALARMS_X + SNS_TOPIC_GAP
export const FALLBACK_CLOUDWATCH_ALARMS_HEIGHT = 246
export const FALLBACK_SNS_TOPIC_HEIGHT = 148

export function auroraFrameFor(instanceSize: MeasuredSize): FrameBox {
  return frameAround({
    left: RDS_INSTANCE_X,
    top: RDS_WRITER_POSITION.y,
    right: RDS_INSTANCE_X + instanceSize.width,
    bottom: RDS_READER_POSITION.y + instanceSize.height,
  })
}

export const FALLBACK_RDS_INSTANCE_SIZE = { width: FALLBACK_CARD_WIDTH, height: 186 }

export const AURORA_FRAME = auroraFrameFor(FALLBACK_RDS_INSTANCE_SIZE)

export const ENDPOINT_CARD_WIDTH = 210
export const REGIONAL_SERVICE_GAP = 96
export const LOGS_EGRESS_LANE = 64
export const ENDPOINT_COLUMN_GAP = 24
export const DOOR_WIDTH = 48
export const DOOR_HEIGHT = 9
export const DOOR_PAIR_GAP = 180

const VPC_BORDER_BEYOND_AURORA_FRAME = FRAME_PADDING * 2
const MANAGED_STORAGE_GAP = 150

export const CLUSTER_VOLUME_POSITION = {
  x: AURORA_FRAME.position.x + AURORA_FRAME.width + VPC_BORDER_BEYOND_AURORA_FRAME + MANAGED_STORAGE_GAP,
  y: ALB_POSITION.y - 46,
}

export const DB_JUNCTION_NODE_ID = 'db-junction'
export const DB_JUNCTION_SIZE = 12
export const DB_JUNCTION_POSITION = {
  x: TASK_COLUMN_X + 440,
  y: ALB_POSITION.y - DB_JUNCTION_SIZE / 2,
}

export const JUNCTION_TO_WRITER_EDGE_ID = 'db-junction-writer'
export const JUNCTION_TO_READER_EDGE_ID = 'db-junction-reader'

export function taskToJunctionEdgeId(taskId: string): string {
  return `${taskId}-${DB_JUNCTION_NODE_ID}`
}

export const FIT_VIEW_OPTIONS = { padding: 0.22, maxZoom: 1 }
export const MIN_ZOOM = 0.08
export const CONNECTION_RADIUS = 48

export function albToTaskEdgeId(taskId: string): string {
  return `${ALB_NODE_ID}-${taskId}`
}

const TASK_EGRESS_DESTINATIONS = [
  DB_JUNCTION_NODE_ID,
  INTERFACE_ENDPOINTS_NODE_ID,
  GATEWAY_ENDPOINT_NODE_ID,
  SECRETS_MANAGER_NODE_ID,
]

function isDatabaseEdge(edgeId: string): boolean {
  return (
    edgeId.endsWith(`-${DB_JUNCTION_NODE_ID}`) ||
    edgeId === JUNCTION_TO_WRITER_EDGE_ID ||
    edgeId === JUNCTION_TO_READER_EDGE_ID
  )
}

function isTaskEgressEdge(edgeId: string): boolean {
  if (!edgeId.startsWith('task-')) return false

  return TASK_EGRESS_DESTINATIONS.some((destination) => edgeId.endsWith(`-${destination}`))
}

export function isEdgeUnderSecurityGroupRule(edgeId: string, boundaryId: string | null): boolean {
  switch (boundaryId) {
    case boundaryKey('alb', 'out'):
    case boundaryKey('task', 'in'):
      return edgeId.startsWith(`${ALB_NODE_ID}-task-`)
    case boundaryKey('task', 'out'):
      return isDatabaseEdge(edgeId) || isTaskEgressEdge(edgeId)
    case boundaryKey('ecsService', 'logs-out'):
      return edgeId === SERVICE_TO_ENDPOINT_EDGE_ID
    case boundaryKey('rdsInstance', 'in'):
      return isDatabaseEdge(edgeId)
    default:
      return false
  }
}

export const NODE_RESOURCE_ID: Record<string, ResourceId> = {
  [WAF_NODE_ID]: 'wafWebAcl',
  [ALB_NODE_ID]: 'alb',
  [ECS_SERVICE_NODE_ID]: 'ecsService',
  [AUTO_SCALING_NODE_ID]: 'autoScalingPolicy',
  [DB_JUNCTION_NODE_ID]: 'ecsService',
  [RDS_CLUSTER_NODE_ID]: 'rdsCluster',
  [CLUSTER_VOLUME_NODE_ID]: 'rdsCluster',
  [RDS_WRITER_NODE_ID]: 'rdsWriter',
  [RDS_READER_NODE_ID]: 'rdsReader',
}

export const EDGE_RESOURCE_ID: Record<string, ResourceId> = {
  [WAF_TO_ALB_EDGE_ID]: 'wafAssociation',
  [METRIC_EDGE_ID]: 'autoScalingPolicy',
  [DESIRED_COUNT_EDGE_ID]: 'autoScalingPolicy',
}

const ECS_SERVICE_TOOLTIP =
  'Control plane, not a traffic hop — requests never pass through it. Everything inside this frame is a task the service owns: it holds the desired count, launches replacements for tasks that die, and registers each one into the ALB target group. It has no scaling rule of its own — Application Auto Scaling calls UpdateService with a new desired count and the scheduler simply converges on it.'

const AUTO_SCALING_TOOLTIP =
  'A separate AWS service, not part of ECS. It registers the service as a scalable target with min/max capacity and tracks ALBRequestCountPerTarget against a target value. It creates and owns two CloudWatch alarms you never write yourself: AlarmHigh for scale out and AlarmLow for scale in. When one fires, it computes a new desired count and calls UpdateService — only then does the ECS scheduler start or stop tasks. Target tracking is asymmetric: on AWS it scales out after ' +
  `${AWS_ALARM_EVALUATION.scaleOutMs / 60_000} minutes above target but only scales in after ${AWS_ALARM_EVALUATION.scaleInMs / 60_000} minutes below it. ` +
  'Both windows are shortened here so the demo stays watchable.'

const INITIAL_SERVICE_FRAME = {
  position: { x: TASK_COLUMN_X - FRAME_PADDING * 2, y: TASK_COLUMN_CENTER_Y },
  width: FALLBACK_TASK_WIDTH + FRAME_PADDING * 4,
  height: 0,
}

export type RegionalServiceKey = 'registry' | 'logs' | 'secrets' | 'storage'

const INTERFACE_SERVED: RegionalServiceKey[] = ['registry', 'logs', 'secrets']
const GATEWAY_SERVED: RegionalServiceKey[] = ['storage']

export function servicesBehindDoor(kind: VpcDoorNodeData['kind']): RegionalServiceKey[] {
  return kind === 'interface' ? INTERFACE_SERVED : GATEWAY_SERVED
}

const REGIONAL_SERVICE_ORDER: RegionalServiceKey[] = ['registry', 'logs', 'secrets', 'storage']

export function endpointColumns(serviceFrame: FrameBox): Record<RegionalServiceKey, number> {
  const step = ENDPOINT_CARD_WIDTH + ENDPOINT_COLUMN_GAP

  return Object.fromEntries(
    REGIONAL_SERVICE_ORDER.map((key, index) => [key, serviceFrame.position.x + index * step]),
  ) as Record<RegionalServiceKey, number>
}

function doorOver(columns: number[]): number {
  const left = Math.min(...columns)
  const right = Math.max(...columns) + ENDPOINT_CARD_WIDTH

  return (left + right) / 2 - DOOR_WIDTH / 2
}

export function doorPositions(
  vpcFrame: FrameBox,
  serviceFrame: FrameBox,
): { interface: XYPosition; gateway: XYPosition } {
  const columns = endpointColumns(serviceFrame)
  const y = vpcFrame.position.y + vpcFrame.height - DOOR_HEIGHT / 2
  const interfaceX = doorOver(INTERFACE_SERVED.map((key) => columns[key]))

  return {
    interface: { x: interfaceX, y },
    gateway: { x: interfaceX + DOOR_PAIR_GAP, y },
  }
}

export function privateTierBoxes(serviceFrame: FrameBox, auroraFrame: FrameBox): ContentBox[] {
  const service = frameContentBox(serviceFrame)

  return [{ ...service, bottom: service.bottom + LOGS_EGRESS_LANE }, frameContentBox(auroraFrame)]
}

const INITIAL_ZONES = networkZoneFrames(
  {
    left: ALB_POSITION.x,
    top: ALB_POSITION.y,
    right: ALB_POSITION.x + FALLBACK_CARD_WIDTH,
    bottom: ALB_POSITION.y + FALLBACK_CARD_HEIGHT,
  },
  privateTierBoxes(INITIAL_SERVICE_FRAME, AURORA_FRAME),
)

export function regionalServicePositions(
  vpcFrame: FrameBox,
  serviceFrame: FrameBox,
): Record<RegionalServiceKey, XYPosition> {
  const columns = endpointColumns(serviceFrame)
  const y = vpcFrame.position.y + vpcFrame.height + REGIONAL_SERVICE_GAP

  return Object.fromEntries(
    REGIONAL_SERVICE_ORDER.map((key) => [key, { x: columns[key], y }]),
  ) as Record<RegionalServiceKey, XYPosition>
}

const INITIAL_DOORS = doorPositions(INITIAL_ZONES.vpc, INITIAL_SERVICE_FRAME)
const INITIAL_REGIONAL_SERVICES = regionalServicePositions(INITIAL_ZONES.vpc, INITIAL_SERVICE_FRAME)

const CLOUDWATCH_LOGS_TOOLTIP =
  'Every line the container writes goes here, shipped by the awslogs driver on the task itself rather than by anything you run. That is why the log group is created in Terraform and the execution role is granted to write to it. The stream leaves through the interface endpoint, so log delivery never depends on a route to the internet. A metric filter over this group counts error lines, and that count is what one of the alarms watches.'

const SECRETS_MANAGER_TOOLTIP =
  'The database password is never written in Terraform or in the task definition. RDS generates and rotates it, and the task definition only names the secret. Before the container starts, the ECS execution role fetches the value through the interface endpoint and injects it as an environment variable — which is why this call belongs to the starting stage and happens exactly once per task.'

const CLOUDWATCH_ALARMS_TOOLTIP =
  'Nine alarms the observability module declares, evaluated here the way CloudWatch evaluates them: samples are bucketed into periods, each period is collapsed by its own statistic — Minimum for HealthyHostCount, Maximum for UnHealthyHostCount, Sum for the error lines — and the alarm only fires when every one of its evaluation periods breaches. That is why losing all the tasks does not turn this red at once: no_healthy_hosts needs two consecutive minutes. Nothing here is on a request path; CloudWatch pulls each metric from the service that publishes it. The dimmed rows are alarms this simulation has no metric for — CPU, memory, database connections, error log lines — and they stay at INSUFFICIENT_DATA rather than showing an invented number.'

const SNS_TOPIC_TOOLTIP =
  'Every alarm points its alarm_actions and ok_actions at this one topic, and the EventBridge rules for failed deployments and failed task placement publish to it too. The topic policy is what makes that legal: it grants SNS:Publish to cloudwatch.amazonaws.com and events.amazonaws.com. It is encrypted with the aws/sns managed key. The email subscription is the one piece Terraform cannot finish — AWS sends a confirmation link that a person has to click, so a fresh apply leaves the subscription pending.'

const REGION_TOOLTIP =
  'Everything inside this outline runs in one AWS region. The VPC is yours; the rest are regional services AWS operates for you — the Web ACL the load balancer evaluates, the Application Auto Scaling policy that resizes the service, the registry and bucket the tasks pull images from, and the Aurora storage volume. Traffic between your VPC and any of them stays on the AWS network, which is why the private subnets need no NAT gateway. The person sending requests is the one thing outside.'

const ECR_TOOLTIP =
  'The registry holds the manifest and the layer metadata, and it answers over the interface endpoints — but it never hands over the bytes. GetDownloadUrlForLayer is called once per layer that is not already cached, and what comes back is a pre-signed S3 URL: an address, not an image. That is the whole reason the task itself needs S3 egress. Tag immutability is on here and every push is scanned, so a task can never silently start a different image behind the same tag.'

const LAYER_STORAGE_TOOLTIP =
  'Where ECR actually keeps the layers. The task follows the pre-signed URL it just received from the registry and reads the bytes straight from here through the gateway endpoint — the registry does not fetch them on the task\'s behalf, which is exactly why allow_egress_to_s3_gateway sits on ecs_sg. This bucket belongs to ECR, not to this project, which owns no bucket of its own. On Fargate nothing is cached between tasks: every task you watch start here downloads the whole image again.'

export const initialNodes: SimulatorFlowNode[] = [
  {
    id: REGION_NODE_ID,
    type: 'networkZone',
    position: INITIAL_ZONES.vpc.position,
    data: {
      label: REGION,
      tooltip: REGION_TOOLTIP,
      status: 'idle',
      tone: 'region',
      width: INITIAL_ZONES.vpc.width,
      height: INITIAL_ZONES.vpc.height,
      summary: 'aws region',
    },
    draggable: false,
    deletable: false,
    selectable: false,
    zIndex: -5,
  },
  {
    id: VPC_NODE_ID,
    type: 'networkZone',
    position: INITIAL_ZONES.vpc.position,
    data: {
      label: 'VPC',
      tooltip: VPC_TOOLTIP,
      status: 'idle',
      tone: 'perimeter',
      width: INITIAL_ZONES.vpc.width,
      height: INITIAL_ZONES.vpc.height,
      summary: VPC_CIDR,
    },
    draggable: false,
    deletable: false,
    selectable: false,
    zIndex: -4,
  },
  {
    id: PUBLIC_SUBNETS_NODE_ID,
    type: 'networkZone',
    position: INITIAL_ZONES.publicSubnets.position,
    data: {
      label: PUBLIC_SUBNETS.label,
      tooltip: PUBLIC_SUBNETS.tooltip,
      status: 'idle',
      tone: 'ownership',
      width: INITIAL_ZONES.publicSubnets.width,
      height: INITIAL_ZONES.publicSubnets.height,
      summary: subnetSummary(PUBLIC_SUBNETS),
    },
    draggable: false,
    deletable: false,
    selectable: false,
    zIndex: -3,
  },
  {
    id: PRIVATE_SUBNETS_NODE_ID,
    type: 'networkZone',
    position: INITIAL_ZONES.privateSubnets.position,
    data: {
      label: PRIVATE_SUBNETS.label,
      tooltip: PRIVATE_SUBNETS.tooltip,
      status: 'idle',
      tone: 'ownership',
      width: INITIAL_ZONES.privateSubnets.width,
      height: INITIAL_ZONES.privateSubnets.height,
      summary: subnetSummary(PRIVATE_SUBNETS),
    },
    draggable: false,
    deletable: false,
    selectable: false,
    zIndex: -3,
  },
  {
    id: WAF_NODE_ID,
    type: 'waf',
    position: { x: ALB_POSITION.x, y: INITIAL_CONTROL_PLANE_Y },
    data: {
      label: 'Web ACL',
      tooltip:
        'AWS WAF is not a hop in front of the load balancer — the Web ACL is associated with the ALB, which evaluates it on every request before routing. Clients always talk to the ALB directly. The rate-based rule counts requests per source IP over a sliding 5-minute window, re-evaluated every 30 seconds, and blocked requests keep counting toward that window: lowering your rate does not unblock you until the window drains. A blocked request never reaches a task — the load balancer answers it with 403, the default response for a WAF block action.',
      status: 'idle',
      inspectedRequestsPerMinute: 0,
      blockedRequests: 0,
      blockedIps: [],
    },
    draggable: false,
    deletable: false,
  },
  {
    id: ALB_NODE_ID,
    type: 'alb',
    position: ALB_POSITION,
    data: {
      label: 'Load Balancer',
      tooltip:
        'The only public entry point. Its listener forwards to the target group, and it distributes requests across healthy targets only, returning 503 when the target group has none — which is why the service keeps a minimum of two tasks.',
      status: 'idle',
      requestsPerMinute: 0,
      healthyTargetCount: 0,
      latencyMs: IDLE_LATENCY.totalMs,
      latencyHistory: [],
    },
    draggable: false,
    deletable: false,
  },
  {
    id: AUTO_SCALING_NODE_ID,
    type: 'autoScaling',
    position: { x: TASK_COLUMN_X, y: INITIAL_CONTROL_PLANE_Y },
    data: {
      label: 'Application Auto Scaling',
      tooltip: AUTO_SCALING_TOOLTIP,
      status: 'idle',
      requestsPerMinutePerTask: null,
      targetRequestsPerMinutePerTask: AUTOSCALING.targetRequestsPerMinutePerTask,
      alarm: NO_ALARM,
      minCapacity: AUTOSCALING.minCapacity,
      maxCapacity: AUTOSCALING.maxCapacity,
      desiredCount: AUTOSCALING.minCapacity,
    },
    draggable: false,
    deletable: false,
  },
  {
    id: CLOUDWATCH_ALARMS_NODE_ID,
    type: 'cloudWatchAlarms',
    position: { x: CLOUDWATCH_ALARMS_X, y: INITIAL_CONTROL_PLANE_Y },
    data: {
      label: 'CloudWatch Alarms',
      tooltip: CLOUDWATCH_ALARMS_TOOLTIP,
      status: 'idle',
      rows: [],
      firingCount: 0,
    },
    draggable: false,
    deletable: false,
  },
  {
    id: SNS_TOPIC_NODE_ID,
    type: 'snsTopic',
    position: { x: SNS_TOPIC_X, y: INITIAL_CONTROL_PLANE_Y },
    data: {
      label: 'SNS Topic',
      tooltip: SNS_TOPIC_TOOLTIP,
      status: 'idle',
      topicName: 'ecs-portfolio-dev-alarms',
      subscription: 'email · confirmed by hand, not by terraform',
      firingCount: 0,
      isPublishing: false,
    },
    draggable: false,
    deletable: false,
  },
  {
    id: ECS_SERVICE_NODE_ID,
    type: 'ecsService',
    position: { x: TASK_COLUMN_X - FRAME_PADDING * 2, y: TASK_COLUMN_CENTER_Y },
    data: {
      label: 'ECS Service',
      tooltip: ECS_SERVICE_TOOLTIP,
      status: 'idle',
      width: FALLBACK_TASK_WIDTH + FRAME_PADDING * 4,
      height: 0,
      desiredCount: AUTOSCALING.minCapacity,
      runningTaskCount: 0,
      pendingTaskCount: 0,
    },
    draggable: false,
    deletable: false,
    selectable: false,
    zIndex: -2,
  },
  {
    id: RDS_CLUSTER_NODE_ID,
    type: 'auroraCluster',
    position: AURORA_FRAME.position,
    data: {
      label: 'Aurora Cluster',
      tooltip:
        `A DB cluster is compute plus storage, and the two live in different places on this canvas for a reason: only the instances get an address in your subnets, while the cluster volume is regional storage AWS runs outside your VPC. Aurora Serverless v2 (Postgres), ${AURORA_SERVERLESS.minAcu}–${AURORA_SERVERLESS.maxAcu} ACU — one ACU is roughly 2 GiB of memory plus matching CPU, and capacity moves in ${AURORA_SERVERLESS.acuStep} ACU steps without dropping connections. The floor is ${AURORA_SERVERLESS.minAcu} ACU rather than 0 on purpose: a minimum of 0 turns on auto-pause, which AWS scopes to development and test clusters, and a paused instance takes about 15 seconds to accept the next connection and then has to scale back up from a small capacity. That is the wrong trade for a service with a latency objective. The cluster publishes the writer and reader endpoints; it never proxies a query itself, and each endpoint resolves straight to an instance.`,
      status: 'idle',
      width: AURORA_FRAME.width,
      height: AURORA_FRAME.height,
    },
    draggable: false,
    deletable: false,
    selectable: false,
    zIndex: -1,
  },
  {
    id: INTERFACE_ENDPOINTS_NODE_ID,
    type: 'vpcDoor',
    position: INITIAL_DOORS.interface,
    selectable: false,
    data: {
      kind: INTERFACE_ENDPOINTS.kind,
      label: 'Interface',
      services: INTERFACE_ENDPOINTS.services,
      footnote: INTERFACE_ENDPOINTS.footnote,
      isCarrying: false,
    },
    draggable: false,
    deletable: false,
  },
  {
    id: GATEWAY_ENDPOINT_NODE_ID,
    type: 'vpcDoor',
    position: INITIAL_DOORS.gateway,
    selectable: false,
    data: {
      kind: GATEWAY_ENDPOINT.kind,
      label: 'Gateway',
      services: GATEWAY_ENDPOINT.services,
      footnote: GATEWAY_ENDPOINT.footnote,
      isCarrying: false,
    },
    draggable: false,
    deletable: false,
  },
  {
    id: ECR_NODE_ID,
    type: 'regionalService',
    position: INITIAL_REGIONAL_SERVICES.registry,
    data: {
      label: 'ECR',
      tooltip: ECR_TOOLTIP,
      status: 'idle',
      role: 'registry',
      detail: 'GetDownloadUrlForLayer',
      footnote: 'returns a presigned url, not bytes',
      isServing: false,
    },
    draggable: false,
    deletable: false,
  },
  {
    id: CLOUDWATCH_LOGS_NODE_ID,
    type: 'regionalService',
    position: INITIAL_REGIONAL_SERVICES.logs,
    data: {
      label: 'CloudWatch Logs',
      tooltip: CLOUDWATCH_LOGS_TOOLTIP,
      status: 'idle',
      role: 'logs',
      detail: 'awslogs driver',
      footnote: 'one stream per task',
      isServing: false,
    },
    draggable: false,
    deletable: false,
  },
  {
    id: SECRETS_MANAGER_NODE_ID,
    type: 'regionalService',
    position: INITIAL_REGIONAL_SERVICES.secrets,
    data: {
      label: 'Secrets Manager',
      tooltip: SECRETS_MANAGER_TOOLTIP,
      status: 'idle',
      role: 'secrets',
      detail: 'db username · password',
      footnote: 'fetched once, before the container starts',
      isServing: false,
    },
    draggable: false,
    deletable: false,
  },
  {
    id: LAYER_STORAGE_NODE_ID,
    type: 'regionalService',
    position: INITIAL_REGIONAL_SERVICES.storage,
    data: {
      label: 'S3',
      tooltip: LAYER_STORAGE_TOOLTIP,
      status: 'idle',
      role: 'storage',
      detail: 'ecr image layers',
      footnote: 'no cache between fargate tasks',
      isServing: false,
    },
    draggable: false,
    deletable: false,
  },
  {
    id: CLUSTER_VOLUME_NODE_ID,
    type: 'clusterVolume',
    position: CLUSTER_VOLUME_POSITION,
    data: {
      label: 'Cluster Volume',
      tooltip:
        'The single virtual volume that holds every table, index and the WAL — and it does not live in your VPC. The DB subnet group places the instances, not the storage: each instance gets an elastic network interface and a private address in one of your subnets, while the volume is a regional service AWS operates. The clearest proof is right here: your subnet group spans two Availability Zones, this volume spans three, so it holds copies in a zone where you have no subnet at all. Aurora writes each change synchronously to six storage nodes across those three zones, and that replication factor is independent of how many DB instances the cluster has. Because storage is shared, adding a reader copies no data — the new instance simply attaches to the volume that already holds everything.',
      status: 'idle',
    },
    draggable: false,
    deletable: false,
  },
  {
    id: DB_JUNCTION_NODE_ID,
    type: 'dbJunction',
    position: DB_JUNCTION_POSITION,
    data: {
      hint: "Where each task's connection pool splits between the writer and reader endpoints",
      axis: 'horizontal',
    },
    draggable: false,
    deletable: false,
    selectable: false,
  },
  {
    id: RDS_WRITER_NODE_ID,
    type: 'rdsInstance',
    position: RDS_WRITER_POSITION,
    data: {
      label: 'Writer Instance',
      tooltip:
        'The only instance that accepts writes — auto-assigned because it was the first aws_rds_cluster_instance provisioned. It does not own the data: every change goes down to the shared cluster volume. If it fails, Aurora promotes the reader, which typically restores service in under 60 seconds and often under 30. With no reader to promote, Aurora has to build a new primary instead, which takes up to 10 minutes — that gap is the whole reason this cluster runs two instances.',
      status: 'idle',
      availabilityZone: AVAILABILITY_ZONES[0],
      role: 'writer',
      lifecycle: 'provisioning',
      requestsPerMinute: 0,
      latencyMs: IDLE_LATENCY.writerMs,
      acu: runningFloorAcu(),
      isApplyingRedo: false,
      cacheHitRatio: null,
      isAbsorbingFallbackReads: false,
    },
    draggable: false,
    deletable: false,
  },
  {
    id: RDS_READER_NODE_ID,
    type: 'rdsInstance',
    position: RDS_READER_POSITION,
    data: {
      label: 'Reader Instance',
      tooltip:
        'Reads the exact same cluster volume as the writer — Aurora never copies data between instances, so this replica had no data of its own to build. The writer sends its redo log stream to the storage nodes and, in parallel, to every reader. This instance applies each record that touches a page it already has cached and discards the rest — neither path reads storage, so a write never sends this instance back to the volume. It only reads storage when a query asks for a page its buffer cache does not hold. ReplicaLag measures how far behind that log stream runs: typically 100 ms or less. Serves read-only queries and is the promotion target on failover.',
      status: 'idle',
      availabilityZone: AVAILABILITY_ZONES[1],
      role: 'reader',
      lifecycle: 'provisioning',
      requestsPerMinute: 0,
      latencyMs: IDLE_LATENCY.writerMs,
      acu: runningFloorAcu(),
      isApplyingRedo: false,
      cacheHitRatio: null,
      isAbsorbingFallbackReads: false,
    },
    draggable: false,
    deletable: false,
  },
]

export const initialEdges: SimulatorFlowEdge[] = [
  {
    id: ENDPOINT_TO_ECR_EDGE_ID,
    type: 'requestFlow',
    source: INTERFACE_ENDPOINTS_NODE_ID,
    sourceHandle: 'out',
    target: ECR_NODE_ID,
    targetHandle: 'in',
    data: { requestsPerMinute: 0 },
    deletable: false,
    reconnectable: false,
    selectable: false,
  },
  {
    id: ENDPOINT_TO_LOGS_EDGE_ID,
    type: 'requestFlow',
    source: INTERFACE_ENDPOINTS_NODE_ID,
    sourceHandle: 'out',
    target: CLOUDWATCH_LOGS_NODE_ID,
    targetHandle: 'in',
    data: { requestsPerMinute: 0 },
    deletable: false,
    reconnectable: false,
    selectable: false,
  },
  {
    id: ENDPOINT_TO_SECRETS_EDGE_ID,
    type: 'requestFlow',
    source: INTERFACE_ENDPOINTS_NODE_ID,
    sourceHandle: 'out',
    target: SECRETS_MANAGER_NODE_ID,
    targetHandle: 'in',
    data: { requestsPerMinute: 0 },
    deletable: false,
    reconnectable: false,
    selectable: false,
  },
  {
    id: SERVICE_TO_ENDPOINT_EDGE_ID,
    type: 'requestFlow',
    source: ECS_SERVICE_NODE_ID,
    sourceHandle: 'logs-out',
    target: INTERFACE_ENDPOINTS_NODE_ID,
    targetHandle: 'in',
    data: { requestsPerMinute: 0 },
    deletable: false,
    reconnectable: false,
    selectable: false,
  },
  {
    id: ENDPOINT_TO_STORAGE_EDGE_ID,
    type: 'requestFlow',
    source: GATEWAY_ENDPOINT_NODE_ID,
    sourceHandle: 'out',
    target: LAYER_STORAGE_NODE_ID,
    targetHandle: 'in',
    data: { requestsPerMinute: 0 },
    deletable: false,
    reconnectable: false,
    selectable: false,
  },
  {
    id: WAF_TO_ALB_EDGE_ID,
    type: 'signal',
    source: WAF_NODE_ID,
    sourceHandle: 'acl-out',
    target: ALB_NODE_ID,
    targetHandle: 'acl-in',
    data: { isActive: false, variant: 'association', label: 'associated' },
    deletable: false,
    reconnectable: false,
    selectable: false,
  },
  {
    id: METRIC_EDGE_ID,
    type: 'signal',
    source: ALB_NODE_ID,
    sourceHandle: 'metric-out',
    target: AUTO_SCALING_NODE_ID,
    targetHandle: 'metric-in',
    data: { isActive: false, variant: 'metric', label: 'req/target' },
    deletable: false,
    reconnectable: false,
    selectable: false,
  },
  {
    id: DESIRED_COUNT_EDGE_ID,
    type: 'signal',
    source: AUTO_SCALING_NODE_ID,
    sourceHandle: 'desired-count-out',
    target: ECS_SERVICE_NODE_ID,
    targetHandle: 'desired-count-in',
    data: { isActive: false, variant: 'command', label: 'UpdateService' },
    deletable: false,
    reconnectable: false,
    selectable: false,
  },
  {
    id: ALARMS_TO_SNS_EDGE_ID,
    type: 'signal',
    source: CLOUDWATCH_ALARMS_NODE_ID,
    sourceHandle: 'notify-out',
    target: SNS_TOPIC_NODE_ID,
    targetHandle: 'notify-in',
    data: { isActive: false, variant: 'command', label: 'alarm_actions' },
    deletable: false,
    reconnectable: false,
    selectable: false,
  },
  {
    id: JUNCTION_TO_WRITER_EDGE_ID,
    type: 'requestFlow',
    source: DB_JUNCTION_NODE_ID,
    sourceHandle: 'out',
    target: RDS_WRITER_NODE_ID,
    targetHandle: 'in',
    data: { requestsPerMinute: 0 },
    deletable: false,
    reconnectable: false,
  },
  {
    id: JUNCTION_TO_READER_EDGE_ID,
    type: 'requestFlow',
    source: DB_JUNCTION_NODE_ID,
    sourceHandle: 'out',
    target: RDS_READER_NODE_ID,
    targetHandle: 'in',
    data: { requestsPerMinute: 0 },
    deletable: false,
    reconnectable: false,
  },
  {
    id: WRITER_TO_VOLUME_EDGE_ID,
    type: 'requestFlow',
    source: RDS_WRITER_NODE_ID,
    sourceHandle: 'storage-out',
    target: CLUSTER_VOLUME_NODE_ID,
    targetHandle: 'in',
    data: { requestsPerMinute: 0 },
    deletable: false,
    reconnectable: false,
  },
  {
    id: READER_TO_VOLUME_EDGE_ID,
    type: 'requestFlow',
    source: RDS_READER_NODE_ID,
    sourceHandle: 'storage-out',
    target: CLUSTER_VOLUME_NODE_ID,
    targetHandle: 'in',
    data: { requestsPerMinute: 0 },
    deletable: false,
    reconnectable: false,
  },
  {
    id: PAGE_CACHE_EDGE_ID,
    type: 'replication',
    source: RDS_WRITER_NODE_ID,
    sourceHandle: 'replicate-out',
    target: RDS_READER_NODE_ID,
    targetHandle: 'replicate-in',
    data: { isActive: false },
    deletable: false,
    reconnectable: false,
  },
]
