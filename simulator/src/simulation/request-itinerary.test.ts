import { describe, expect, it } from 'vitest'
import {
  abandonDatabaseTrip,
  buildRequestItinerary,
  queriesForNextRequest,
  type QueryKind,
} from './request-itinerary'
import { PACKET_SPEED_PX_PER_SECOND } from './packets'
import { WORKLOAD } from './simulation-config'

const ENTRY = 'user-to-alb'
const ALB = 'alb-to-task'
const JUNCTION = 'task-to-junction'
const READER = 'junction-to-reader'
const READER_VOLUME = 'reader-to-volume'
const WRITER = 'junction-to-writer'
const WRITER_VOLUME = 'writer-to-volume'

const EVERYTHING_UP = new Set([ENTRY, ALB, JUNCTION, READER, READER_VOLUME, WRITER, WRITER_VOLUME])

function itinerary(queries: QueryKind[], liveEdgeIds = EVERYTHING_UP, readServedFromCache = false) {
  return buildRequestItinerary({
    readServedFromCache,
    entryEdgeId: ENTRY,
    albEdgeId: ALB,
    junctionEdgeId: JUNCTION,
    readLegs: { instanceEdgeId: READER, volumeEdgeId: READER_VOLUME },
    writeLegs: { instanceEdgeId: WRITER, volumeEdgeId: WRITER_VOLUME },
    queries,
    liveEdgeIds,
    answersWithError: false,
  })
}

describe('the shape of a request', () => {
  it('arrives through the load balancer and leaves the same way', () => {
    const legs = itinerary(['read'])

    expect(legs[0]).toMatchObject({ edgeId: ENTRY, reversed: false })
    expect(legs[1]).toMatchObject({ edgeId: ALB, reversed: false })
    expect(legs.at(-2)).toMatchObject({ edgeId: ALB, reversed: true })
    expect(legs.at(-1)).toMatchObject({ edgeId: ENTRY, reversed: true })
  })

  it('goes to the database and comes back before answering the user', () => {
    const legs = itinerary(['read']).map((leg) => `${leg.edgeId}${leg.reversed ? ' back' : ''}`)

    expect(legs).toEqual([
      ENTRY,
      ALB,
      JUNCTION,
      READER,
      READER_VOLUME,
      `${READER_VOLUME} back`,
      `${READER} back`,
      `${JUNCTION} back`,
      `${ALB} back`,
      `${ENTRY} back`,
    ])
  })

  it('adds a round trip for each query it is given', () => {
    const one = itinerary(['read']).length
    const three = itinerary(['read', 'read', 'read']).length

    expect(three - one).toBe((one - 4) * 2)
  })

  it('travels every leg at the same speed', () => {
    const speeds = new Set(itinerary(['read']).map((entry) => entry.speedPxPerSecond))

    expect(speeds).toEqual(new Set([PACKET_SPEED_PX_PER_SECOND]))
  })

  it('sends writes to the writer and reads to the replica', () => {
    const legs = itinerary(['write', 'read'])

    expect(legs.some((leg) => leg.edgeId === WRITER)).toBe(true)
    expect(legs.some((leg) => leg.edgeId === READER)).toBe(true)
  })

  it('gives every leg of a request the same colour, whatever the query is', () => {
    const colours = new Set([...itinerary(['write']), ...itinerary(['read'])].map((leg) => leg.color))

    expect(colours).toEqual(new Set(['default']))
  })
})

describe('the junction is a drawing artifact, not a resource', () => {
  it('does not treat arriving at the junction as entering a node', () => {
    const legs = itinerary(['read'])
    const towardsJunction = legs.find((entry) => entry.edgeId === JUNCTION && !entry.reversed)

    expect(towardsJunction?.entersNodeAtEnd).toBe(false)
  })

  it('does not treat coming back to the junction as entering a node either', () => {
    const legs = itinerary(['read'])
    const backFromReader = legs.find((entry) => entry.edgeId === READER && entry.reversed)

    expect(backFromReader?.entersNodeAtEnd).toBe(false)
  })

  it('still holds the request at every real resource on the way', () => {
    const legs = itinerary(['read'])
    const holding = legs.filter((entry) => entry.entersNodeAtEnd).map((entry) => entry.edgeId)

    expect(holding).toEqual([ENTRY, ALB, READER, READER_VOLUME, READER_VOLUME, JUNCTION, ALB, ENTRY])
  })
})

describe('a read the reader can answer from memory', () => {
  it('turns around at the instance instead of going on to storage', () => {
    const legs = itinerary(['read'], EVERYTHING_UP, true).map((leg) => leg.edgeId)

    expect(legs).not.toContain(READER_VOLUME)
    expect(legs).toContain(READER)
  })

  it('still crosses the volume when the page is not cached', () => {
    expect(itinerary(['read'], EVERYTHING_UP, false).map((leg) => leg.edgeId)).toContain(READER_VOLUME)
  })

  it('sends a write to storage whatever the cache holds, because redo must be durable', () => {
    expect(itinerary(['write'], EVERYTHING_UP, true).map((leg) => leg.edgeId)).toContain(WRITER_VOLUME)
  })
})

describe('when the load balancer falls open onto an unhealthy target', () => {
  const failOpen = buildRequestItinerary({
    readServedFromCache: false,
    entryEdgeId: ENTRY,
    albEdgeId: ALB,
    junctionEdgeId: JUNCTION,
    readLegs: { instanceEdgeId: READER, volumeEdgeId: READER_VOLUME },
    writeLegs: { instanceEdgeId: WRITER, volumeEdgeId: WRITER_VOLUME },
    queries: ['read'],
    liveEdgeIds: EVERYTHING_UP,
    answersWithError: true,
  })

  it('still carries the request all the way to the task, because the request really arrives', () => {
    expect(failOpen.slice(0, 2).map((leg) => leg.edgeId)).toEqual([ENTRY, ALB])
  })

  it('never reaches the database, since the target is not serving yet', () => {
    expect(failOpen.map((leg) => leg.edgeId)).not.toContain(JUNCTION)
  })

  it('answers with an error rather than being turned away at the door', () => {
    const homeward = failOpen.filter((leg) => leg.reversed)

    expect(homeward).toHaveLength(2)
    expect(homeward.every((leg) => leg.color === 'rejected')).toBe(true)
  })
})

describe('when the database cannot be reached', () => {
  it('turns the request around at the task instead of stranding it', () => {
    const legs = buildRequestItinerary({
      readServedFromCache: false,
      entryEdgeId: ENTRY,
      albEdgeId: ALB,
      junctionEdgeId: null,
      readLegs: null,
      writeLegs: null,
      queries: ['read'],
      liveEdgeIds: EVERYTHING_UP,
      answersWithError: false,
    })

    expect(legs.map((leg) => leg.edgeId)).toEqual([ENTRY, ALB, ALB, ENTRY])
  })

  it('skips the shared volume leg while it is missing', () => {
    const withoutVolume = new Set([ENTRY, ALB, JUNCTION, READER])
    const legs = itinerary(['read'], withoutVolume)

    expect(legs.some((leg) => leg.edgeId === READER_VOLUME)).toBe(false)
    expect(legs.some((leg) => leg.edgeId === READER)).toBe(true)
  })
})

describe('how many queries a request makes', () => {
  it('makes exactly one round trip to the database', () => {
    expect(queriesForNextRequest(0)).toHaveLength(WORKLOAD.queriesPerRequest)
  })

  it('keeps writes a minority across successive requests', () => {
    const kinds = Array.from({ length: 60 }, (_, rotation) => queriesForNextRequest(rotation)).flat()
    const writes = kinds.filter((kind) => kind === 'write').length

    expect(writes).toBeGreaterThan(0)
    expect(writes / kinds.length).toBeLessThan(0.5)
  })
})

describe('a request already in flight when the database goes away', () => {
  const NO_DATABASE = new Set([ENTRY, ALB])

  function inFlightAtTheReader() {
    const legs = itinerary(['read'])
    return { legs, legIndex: legs.findIndex((leg) => leg.edgeId === READER && !leg.reversed) }
  }

  it('is not thrown away — it turns around and answers the user', () => {
    const { legs, legIndex } = inFlightAtTheReader()
    const homeward = abandonDatabaseTrip(legs, legIndex, NO_DATABASE)

    expect(homeward).not.toBeNull()
    expect(homeward?.slice(legIndex).map((leg) => leg.edgeId)).toEqual([ALB, ENTRY])
  })

  it('keeps the legs it already travelled, so it does not jump across the canvas', () => {
    const { legs, legIndex } = inFlightAtTheReader()
    const homeward = abandonDatabaseTrip(legs, legIndex, NO_DATABASE)

    expect(homeward?.slice(0, legIndex)).toEqual(legs.slice(0, legIndex))
  })

  it('comes back marked as rejected rather than as a healthy response', () => {
    const { legs, legIndex } = inFlightAtTheReader()
    const homeward = abandonDatabaseTrip(legs, legIndex, NO_DATABASE)

    expect(new Set(homeward?.slice(legIndex).map((leg) => leg.color))).toEqual(new Set(['rejected']))
  })

  it('drops the request only when there is no way home left', () => {
    const { legs, legIndex } = inFlightAtTheReader()

    expect(abandonDatabaseTrip(legs, legIndex, new Set<string>())).toBeNull()
  })

  it('always gives up on what is ahead — the caller is the one that decides to call it', () => {
    const legs = itinerary(['read'])
    const homeward = abandonDatabaseTrip(legs, 0, EVERYTHING_UP)

    expect(homeward?.map((leg) => leg.edgeId)).toEqual(legs.filter((leg) => leg.reversed).map((leg) => leg.edgeId))
  })
})
