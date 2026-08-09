import { useMemo } from 'react'
import {
  ALB_NODE_ID,
  ALB_POSITION,
  AUTO_SCALING_NODE_ID,
  FALLBACK_RDS_INSTANCE_SIZE,
  RDS_CLUSTER_NODE_ID,
  RDS_READER_NODE_ID,
  RDS_WRITER_NODE_ID,
  auroraFrameFor,
  FALLBACK_AUTO_SCALING_HEIGHT,
  FALLBACK_CARD_HEIGHT,
  FALLBACK_CARD_WIDTH,
  FALLBACK_WAF_HEIGHT,
  ECR_NODE_ID,
  GATEWAY_ENDPOINT_NODE_ID,
  INTERFACE_ENDPOINTS_NODE_ID,
  CLOUDWATCH_LOGS_NODE_ID,
  LAYER_STORAGE_NODE_ID,
  SECRETS_MANAGER_NODE_ID,
  CLUSTER_VOLUME_NODE_ID,
  CLUSTER_VOLUME_POSITION,
  PRIVATE_SUBNETS_NODE_ID,
  REGION_NODE_ID,
  PUBLIC_SUBNETS_NODE_ID,
  TASK_COLUMN_X,
  VPC_NODE_ID,
  WAF_NODE_ID,
  doorPositions,
  privateTierBoxes,
  regionalServicePositions,
} from '../canvas/initial-graph'
import { networkZoneFrames } from '../canvas/network-zones'
import { frameAround, frameContentBox, unionBox, type ContentBox } from '../canvas/frame-metrics'
import type { MeasuredSize } from './useMeasuredNodeSizes'
import { useMeasuredNodeSizes } from './useMeasuredNodeSizes'
import type { FrameBox } from '../canvas/frame-metrics'
import type { XYPosition } from '@xyflow/react'

interface NetworkZoneLayoutArgs {
  serviceFrame: FrameBox
}

export interface NetworkZoneLayout {
  framesByNodeId: Map<string, FrameBox>
  positionsByNodeId: Map<string, XYPosition>
  wafPosition: XYPosition
  autoScalingPosition: XYPosition
}

function largestInstance(sizes: Map<string, MeasuredSize>): MeasuredSize {
  const measured = [RDS_WRITER_NODE_ID, RDS_READER_NODE_ID].flatMap((id) => sizes.get(id) ?? [])

  return {
    width: Math.max(FALLBACK_RDS_INSTANCE_SIZE.width, ...measured.map((size) => size.width)),
    height: Math.max(FALLBACK_RDS_INSTANCE_SIZE.height, ...measured.map((size) => size.height)),
  }
}

export function useNetworkZoneLayout({ serviceFrame }: NetworkZoneLayoutArgs): NetworkZoneLayout {
  const sizes = useMeasuredNodeSizes()

  return useMemo(() => {
    const alb = sizes.get(ALB_NODE_ID)
    const auroraFrame = auroraFrameFor(largestInstance(sizes))
    const zones = networkZoneFrames(
      {
        left: ALB_POSITION.x,
        top: ALB_POSITION.y,
        right: ALB_POSITION.x + (alb?.width ?? FALLBACK_CARD_WIDTH),
        bottom: ALB_POSITION.y + (alb?.height ?? FALLBACK_CARD_HEIGHT),
      },
      privateTierBoxes(serviceFrame, auroraFrame),
    )

    const wafHeight = sizes.get(WAF_NODE_ID)?.height ?? FALLBACK_WAF_HEIGHT
    const autoScalingHeight = sizes.get(AUTO_SCALING_NODE_ID)?.height ?? FALLBACK_AUTO_SCALING_HEIGHT
    const doors = doorPositions(zones.vpc, serviceFrame)
    const regionalServices = regionalServicePositions(zones.vpc, serviceFrame)

    const boxAt = (position: XYPosition, id: string): ContentBox => {
      const size = sizes.get(id) ?? { width: FALLBACK_CARD_WIDTH, height: FALLBACK_CARD_HEIGHT }

      return {
        left: position.x,
        top: position.y,
        right: position.x + size.width,
        bottom: position.y + size.height,
      }
    }

    const regionFrame = frameAround(
      unionBox([
        frameContentBox(zones.vpc),
        boxAt({ x: ALB_POSITION.x, y: zones.controlPlaneBottom - wafHeight }, WAF_NODE_ID),
        boxAt({ x: TASK_COLUMN_X, y: zones.controlPlaneBottom - autoScalingHeight }, AUTO_SCALING_NODE_ID),
        boxAt(regionalServices.registry, ECR_NODE_ID),
        boxAt(regionalServices.logs, CLOUDWATCH_LOGS_NODE_ID),
        boxAt(regionalServices.secrets, SECRETS_MANAGER_NODE_ID),
        boxAt(regionalServices.storage, LAYER_STORAGE_NODE_ID),
        boxAt(CLUSTER_VOLUME_POSITION, CLUSTER_VOLUME_NODE_ID),
      ]),
    )

    return {
      framesByNodeId: new Map([
        [REGION_NODE_ID, regionFrame],
        [VPC_NODE_ID, zones.vpc],
        [PUBLIC_SUBNETS_NODE_ID, zones.publicSubnets],
        [PRIVATE_SUBNETS_NODE_ID, zones.privateSubnets],
        [RDS_CLUSTER_NODE_ID, auroraFrame],
      ]),
      positionsByNodeId: new Map([
        [INTERFACE_ENDPOINTS_NODE_ID, doors.interface],
        [GATEWAY_ENDPOINT_NODE_ID, doors.gateway],
        [ECR_NODE_ID, regionalServices.registry],
        [CLOUDWATCH_LOGS_NODE_ID, regionalServices.logs],
        [SECRETS_MANAGER_NODE_ID, regionalServices.secrets],
        [LAYER_STORAGE_NODE_ID, regionalServices.storage],
      ]),
      wafPosition: { x: ALB_POSITION.x, y: zones.controlPlaneBottom - wafHeight },
      autoScalingPosition: { x: TASK_COLUMN_X, y: zones.controlPlaneBottom - autoScalingHeight },
    }
  }, [sizes, serviceFrame])
}
