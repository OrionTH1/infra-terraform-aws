import { PACKET_SPEED_PX_PER_SECOND, type ItineraryLeg } from './packets'
import type { TaskStatus } from '../types/task-data'

const SECRET_FETCH_STATUSES: TaskStatus[] = ['starting']

export interface LogShipmentLegs {
  taskId: string
  endpointEdgeId: string
  serviceEdgeId: string
}

export interface SecretFetchLegs {
  taskId: string
  endpointEdgeId: string
  serviceEdgeId: string
}

function leg(edgeId: string, reversed: boolean, entersNodeAtEnd = true): ItineraryLeg {
  return { edgeId, reversed, color: 'default', speedPxPerSecond: PACKET_SPEED_PX_PER_SECOND, entersNodeAtEnd }
}

export function isFetchingSecret(status: TaskStatus): boolean {
  return SECRET_FETCH_STATUSES.includes(status)
}

export function buildLogShipment(legs: LogShipmentLegs, liveEdgeIds: Set<string>): ItineraryLeg[] {
  return [leg(legs.endpointEdgeId, false), leg(legs.serviceEdgeId, false)].filter((entry) =>
    liveEdgeIds.has(entry.edgeId),
  )
}

export function buildSecretFetch(legs: SecretFetchLegs, liveEdgeIds: Set<string>): ItineraryLeg[] {
  return [
    leg(legs.endpointEdgeId, false),
    leg(legs.serviceEdgeId, false),
    leg(legs.serviceEdgeId, true),
    leg(legs.endpointEdgeId, true),
  ].filter((entry) => liveEdgeIds.has(entry.edgeId))
}
