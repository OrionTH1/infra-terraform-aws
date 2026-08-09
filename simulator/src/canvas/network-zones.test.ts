import { describe, expect, it } from 'vitest'
import { SUBNET_FRAME_MIN_WIDTH, networkZoneFrames } from './network-zones'
import { frameContentBox, type ContentBox, type FrameBox } from './frame-metrics'
import {
  ALB_POSITION,
  AURORA_FRAME as REAL_AURORA_FRAME,
  CLUSTER_VOLUME_POSITION,
  DOOR_HEIGHT,
  DOOR_WIDTH,
  ENDPOINT_CARD_WIDTH,
  FALLBACK_CARD_HEIGHT,
  FALLBACK_CARD_WIDTH,
  LOGS_EGRESS_LANE,
  RDS_READER_POSITION,
  RDS_WRITER_POSITION,
  auroraFrameFor,
  doorPositions,
  privateTierBoxes,
  regionalServicePositions,
} from './initial-graph'

const ALB_BOX = { left: 360, top: 200, right: 570, bottom: 332 }
const SERVICE_FRAME: FrameBox = { position: { x: 876, y: 20 }, width: 322, height: 360 }
const AURORA_FRAME: FrameBox = { position: { x: 1548, y: 20 }, width: 764, height: 392 }

const REAL_ALB_BOX: ContentBox = {
  left: ALB_POSITION.x,
  top: ALB_POSITION.y,
  right: ALB_POSITION.x + FALLBACK_CARD_WIDTH,
  bottom: ALB_POSITION.y + FALLBACK_CARD_HEIGHT,
}

function zones() {
  return networkZoneFrames(ALB_BOX, [frameContentBox(SERVICE_FRAME), frameContentBox(AURORA_FRAME)])
}

function realZones(serviceFrame: FrameBox = SERVICE_FRAME) {
  return networkZoneFrames(REAL_ALB_BOX, privateTierBoxes(serviceFrame, REAL_AURORA_FRAME))
}

function contains(outer: FrameBox, inner: FrameBox): boolean {
  const a = frameContentBox(outer)
  const b = frameContentBox(inner)

  return a.left <= b.left && a.top <= b.top && a.right >= b.right && a.bottom >= b.bottom
}

describe('nesting', () => {
  it('puts both subnet tiers inside the vpc', () => {
    const { vpc, publicSubnets, privateSubnets } = zones()

    expect(contains(vpc, publicSubnets)).toBe(true)
    expect(contains(vpc, privateSubnets)).toBe(true)
  })

  it('puts the load balancer in the public tier and nothing else', () => {
    const { publicSubnets, privateSubnets } = zones()
    const box = frameContentBox(publicSubnets)

    expect(box.left).toBeLessThanOrEqual(ALB_BOX.left)
    expect(box.right).toBeGreaterThanOrEqual(ALB_BOX.right)
    expect(box.right).toBeLessThan(frameContentBox(privateSubnets).left)
  })

  it('puts the ecs service and the aurora cluster in the private tier', () => {
    const { privateSubnets } = zones()

    expect(contains(privateSubnets, SERVICE_FRAME)).toBe(true)
    expect(contains(privateSubnets, AURORA_FRAME)).toBe(true)
  })

  it('never lets the two tiers overlap', () => {
    const { publicSubnets, privateSubnets } = zones()

    expect(frameContentBox(publicSubnets).right).toBeLessThan(frameContentBox(privateSubnets).left)
  })

  it('stands the two tiers side by side on the same top and bottom edge', () => {
    const { publicSubnets, privateSubnets } = zones()

    expect(publicSubnets.position.y).toBe(privateSubnets.position.y)
    expect(publicSubnets.height).toBe(privateSubnets.height)
  })

  it('keeps the narrow tier wide enough for its own header to fit', () => {
    const { publicSubnets } = zones()

    expect(publicSubnets.width).toBeGreaterThanOrEqual(SUBNET_FRAME_MIN_WIDTH)
  })

  it('leaves the tier that is already wide at its content width', () => {
    const { privateSubnets } = zones()

    expect(privateSubnets.width).toBeGreaterThan(SUBNET_FRAME_MIN_WIDTH)
  })
})

describe('the doors in the vpc wall', () => {
  it('sits both of them astride the boundary, half in and half out', () => {
    const { vpc } = realZones()
    const doors = doorPositions(vpc, SERVICE_FRAME)
    const wall = frameContentBox(vpc).bottom

    for (const door of [doors.interface, doors.gateway]) {
      expect(door.y).toBeLessThan(wall)
      expect(door.y + DOOR_HEIGHT).toBeGreaterThan(wall)
    }
  })

  it('centres the gateway on the single service it opens onto', () => {
    const { vpc } = realZones()
    const doors = doorPositions(vpc, SERVICE_FRAME)
    const services = regionalServicePositions(vpc, SERVICE_FRAME)

    expect(doors.gateway.x + DOOR_WIDTH / 2).toBe(services.storage.x + ENDPOINT_CARD_WIDTH / 2)
  })

  it('centres the interface door over every service that reaches out through it', () => {
    const { vpc } = realZones()
    const doors = doorPositions(vpc, SERVICE_FRAME)
    const services = regionalServicePositions(vpc, SERVICE_FRAME)
    const span = (services.registry.x + services.secrets.x + ENDPOINT_CARD_WIDTH) / 2

    expect(doors.interface.x + DOOR_WIDTH / 2).toBe(span)
  })

  it('opens the interface door somewhere the gateway does not', () => {
    const doors = doorPositions(realZones().vpc, SERVICE_FRAME)

    expect(doors.interface.x + DOOR_WIDTH).toBeLessThan(doors.gateway.x)
  })

  it('keeps the two doors apart', () => {
    const doors = doorPositions(realZones().vpc, SERVICE_FRAME)

    expect(doors.gateway.x).toBeGreaterThan(doors.interface.x + DOOR_WIDTH)
  })

  it('follows the wall down as the task column grows', () => {
    const taller: FrameBox = { position: { x: 876, y: -200 }, width: 322, height: 800 }

    expect(doorPositions(realZones(taller).vpc, taller).interface.y).toBeGreaterThan(
      doorPositions(realZones().vpc, SERVICE_FRAME).interface.y,
    )
  })
})

describe('the lane the log stream leaves by', () => {
  const TALLER_THAN_AURORA: FrameBox = { position: { x: 876, y: -200 }, width: 322, height: 800 }

  it('always leaves room below the task column, whichever side of the tier is taller', () => {
    for (const serviceFrame of [SERVICE_FRAME, TALLER_THAN_AURORA]) {
      const tier = frameContentBox(realZones(serviceFrame).privateSubnets)

      expect(tier.bottom - frameContentBox(serviceFrame).bottom).toBeGreaterThan(LOGS_EGRESS_LANE)
    }
  })

  it('gives the line somewhere to curve instead of dropping straight onto the wall', () => {
    const door = doorPositions(realZones(TALLER_THAN_AURORA).vpc, TALLER_THAN_AURORA).interface

    expect(door.y - frameContentBox(TALLER_THAN_AURORA).bottom).toBeGreaterThan(LOGS_EGRESS_LANE)
  })
})

describe('the canvas the simulator actually draws', () => {
  it('wraps the real aurora cluster and load balancer without inverting anything', () => {
    const { vpc, publicSubnets, privateSubnets } = realZones()

    for (const frame of [vpc, publicSubnets, privateSubnets]) {
      expect(frame.width).toBeGreaterThan(0)
      expect(frame.height).toBeGreaterThan(0)
    }

    expect(contains(vpc, privateSubnets)).toBe(true)
    expect(contains(privateSubnets, REAL_AURORA_FRAME)).toBe(true)
  })

  it('leaves the cluster volume outside the vpc, where aurora storage actually lives', () => {
    expect(CLUSTER_VOLUME_POSITION.x).toBeGreaterThan(frameContentBox(realZones().vpc).right)
  })
})

describe('the aurora cluster frame', () => {
  it('wraps both instances whatever height their cards turn out to measure', () => {
    const tallCard = { width: 240, height: 300 }
    const box = frameContentBox(auroraFrameFor(tallCard))

    expect(box.top).toBeLessThanOrEqual(RDS_WRITER_POSITION.y)
    expect(box.bottom).toBeGreaterThanOrEqual(RDS_READER_POSITION.y + tallCard.height)
    expect(box.left).toBeLessThanOrEqual(RDS_WRITER_POSITION.x)
    expect(box.right).toBeGreaterThanOrEqual(RDS_WRITER_POSITION.x + tallCard.width)
  })

  it('grows with the card instead of clipping it', () => {
    const short = auroraFrameFor({ width: 210, height: 140 })
    const tall = auroraFrameFor({ width: 210, height: 300 })

    expect(tall.height).toBeGreaterThan(short.height)
  })
})

describe('the control plane sits outside the network', () => {
  it('leaves room above the vpc for the regional services', () => {
    const { vpc, controlPlaneBottom } = zones()

    expect(controlPlaneBottom).toBeLessThan(vpc.position.y)
  })

  it('follows the vpc up when the service frame grows', () => {
    const taller: FrameBox = { position: { x: 876, y: -200 }, width: 322, height: 800 }
    const grown = networkZoneFrames(ALB_BOX, [frameContentBox(taller), frameContentBox(AURORA_FRAME)])

    expect(grown.controlPlaneBottom).toBeLessThan(zones().controlPlaneBottom)
  })
})
