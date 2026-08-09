import { PACKET_SPEED_PX_PER_SECOND, type ItineraryLeg } from './packets'
import { RDS_READ_FRACTION, WORKLOAD } from './simulation-config'

export type QueryKind = 'read' | 'write'

export interface DatabaseLegs {
  instanceEdgeId: string
  volumeEdgeId: string
}

export interface ItineraryRequest {
  entryEdgeId: string
  albEdgeId: string
  junctionEdgeId: string | null
  readLegs: DatabaseLegs | null
  writeLegs: DatabaseLegs | null
  queries: QueryKind[]
  liveEdgeIds: Set<string>
  readServedFromCache: boolean
  answersWithError: boolean
}

const WRITES_EVERY = Math.round(1 / (1 - RDS_READ_FRACTION))

export function queriesForNextRequest(rotation: number): QueryKind[] {
  return Array.from({ length: WORKLOAD.queriesPerRequest }, (_, index) =>
    (rotation + index) % WRITES_EVERY === 0 ? 'write' : 'read',
  )
}

function leg(edgeId: string, reversed: boolean, entersNodeAtEnd = true): ItineraryLeg {
  return { edgeId, reversed, color: 'default', speedPxPerSecond: PACKET_SPEED_PX_PER_SECOND, entersNodeAtEnd }
}

export function buildRequestItinerary(request: ItineraryRequest): ItineraryLeg[] {
  const { entryEdgeId, albEdgeId, junctionEdgeId, queries, liveEdgeIds } = request

  const inbound = [leg(entryEdgeId, false), leg(albEdgeId, false)]
  const outbound = [leg(albEdgeId, true), leg(entryEdgeId, true)]

  if (request.answersWithError) {
    return [...inbound, ...outbound.map((entry) => ({ ...entry, color: 'rejected' as const }))]
  }

  if (junctionEdgeId === null) return [...inbound, ...outbound]

  const roundTrips = queries.flatMap((kind) => {
    const legs = kind === 'write' ? request.writeLegs : request.readLegs
    if (legs === null) return []

    const outward = [leg(junctionEdgeId, false, false), leg(legs.instanceEdgeId, false)]
    const homeward = [leg(legs.instanceEdgeId, true, false), leg(junctionEdgeId, true)]

    const readsStorage = kind === 'write' || !request.readServedFromCache
    if (readsStorage && liveEdgeIds.has(legs.volumeEdgeId)) {
      outward.push(leg(legs.volumeEdgeId, false))
      homeward.unshift(leg(legs.volumeEdgeId, true))
    }

    return [...outward, ...homeward]
  })

  return [...inbound, ...roundTrips, ...outbound]
}


export function abandonDatabaseTrip(
  legs: ItineraryLeg[],
  fromLegIndex: number,
  liveEdgeIds: Set<string>,
): ItineraryLeg[] | null {
  const homeward = legs
    .slice(fromLegIndex)
    .filter((leg) => leg.reversed && liveEdgeIds.has(leg.edgeId))
    .map((leg) => ({ ...leg, color: 'rejected' as const }))

  if (homeward.length === 0) return null

  return [...legs.slice(0, fromLegIndex), ...homeward]
}

export function divertToWriter(
  legs: ItineraryLeg[],
  fromLegIndex: number,
  readLegs: DatabaseLegs,
  writeLegs: DatabaseLegs,
): ItineraryLeg[] {
  return legs.map((leg, index) => {
    if (index < fromLegIndex) return leg
    if (leg.edgeId === readLegs.instanceEdgeId) return { ...leg, edgeId: writeLegs.instanceEdgeId }
    if (leg.edgeId === readLegs.volumeEdgeId) return { ...leg, edgeId: writeLegs.volumeEdgeId }

    return leg
  })
}
