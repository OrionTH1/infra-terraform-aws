export const PACKET_SPEED_PX_PER_SECOND = 190
export const REPLICATION_PACKET_SPEED_PX_PER_SECOND = 400
export const MAX_LIVE_PACKETS = 260
export const MAX_STALL_MS = 600

export const PACKET_RADIUS = 3.5
export const PACKET_GLOW_PX = 4
export const PACKET_LANE_OFFSET_PX = 7
export const PACKET_FADE_MS = 150
export const PACKET_DWELL_MS = 220

const MIN_PACKETS_PER_SECOND = 0.4
const MAX_PACKETS_PER_SECOND = 1.5
const REQUESTS_PER_SECOND_PER_PACKET = 8
const SECONDS_PER_MINUTE = 60

export type PacketColor = 'default' | 'write' | 'blocked'

export interface ItineraryLeg {
  edgeId: string
  reversed: boolean
  color: PacketColor
  speedPxPerSecond: number
  entersNodeAtEnd: boolean
  dwellMs?: number
}

export interface Packet {
  id: number
  routeKey: string | null
  legs: ItineraryLeg[]
  legIndex: number
  legProgress: number
  dwellUntil: number | null
  stalledSince: number | null
  lastPosition: { x: number; y: number } | null
  color: PacketColor
}

export function packetsPerSecond(requestsPerMinute: number): number {
  if (requestsPerMinute <= 0) return 0

  const requestsPerSecond = requestsPerMinute / SECONDS_PER_MINUTE
  return Math.min(
    MAX_PACKETS_PER_SECOND,
    Math.max(MIN_PACKETS_PER_SECOND, requestsPerSecond / REQUESTS_PER_SECOND_PER_PACKET),
  )
}

export function isRouteIntact(legs: ItineraryLeg[], fromLegIndex: number, liveEdgeIds: Set<string>): boolean {
  for (let index = fromLegIndex; index < legs.length; index += 1) {
    if (!liveEdgeIds.has(legs[index].edgeId)) return false
  }

  return true
}

export function pathElementId(edgeId: string): string {
  return `flow-path-${edgeId}`
}
