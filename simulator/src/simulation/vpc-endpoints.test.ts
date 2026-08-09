import { describe, expect, it } from 'vitest'
import { GATEWAY_ENDPOINT, INTERFACE_ENDPOINTS, VPC_ENDPOINT_GROUPS } from './vpc-endpoints'
import { isPullingImage } from './image-pull'
import { servicesBehindDoor } from '../canvas/initial-graph'
import { AVAILABILITY_ZONES, REGION } from './network-topology'
import type { TaskStatus } from '../types/task-data'

describe('the endpoints terraform declares', () => {
  it('names every interface endpoint the private subnets need to work without a nat gateway', () => {
    expect(INTERFACE_ENDPOINTS.services).toEqual(['ecr.api', 'ecr.dkr', 'logs', 'secretsmanager'])
  })

  it('keeps the gateway apart from the interfaces, because only one of them answers to a security group', () => {
    expect(INTERFACE_ENDPOINTS.kind).toBe('interface')
    expect(GATEWAY_ENDPOINT.kind).toBe('gateway')
    expect(VPC_ENDPOINT_GROUPS).toHaveLength(2)
  })

  it('builds the service name from the region the subnets live in', () => {
    expect(GATEWAY_ENDPOINT.services).toEqual([`${REGION}.s3`])
    expect(AVAILABILITY_ZONES.every((zone) => zone.startsWith(REGION))).toBe(true)
  })
})

describe('when the endpoints are carrying traffic', () => {
  const statuses = (...values: TaskStatus[]) => values

  it('lights up while a task is still fetching its image', () => {
    expect(isPullingImage(statuses('provisioning'))).toBe(true)
  })

  it('goes dark as soon as the task reports the image is pulled', () => {
    expect(isPullingImage(statuses('starting'))).toBe(false)
  })

  it('stays quiet once every task is settled', () => {
    expect(isPullingImage(statuses('healthy', 'healthy'))).toBe(false)
  })

  it('stays quiet when nothing is running at all', () => {
    expect(isPullingImage([])).toBe(false)
  })

  it('lights up if any single task is pulling, however many are already healthy', () => {
    expect(isPullingImage(statuses('healthy', 'healthy', 'provisioning'))).toBe(true)
  })

  it('does not treat a task on its way out as an image pull', () => {
    expect(isPullingImage(statuses('draining', 'failed'))).toBe(false)
  })
})

describe('which services sit behind each door', () => {
  it('puts everything the interface endpoints reach on one side and s3 on the other', () => {
    expect(servicesBehindDoor('interface')).toEqual(['registry', 'logs', 'secrets'])
    expect(servicesBehindDoor('gateway')).toEqual(['storage'])
  })

  it('claims no service twice, so a door only lights for traffic that is really its own', () => {
    const claimed = [...servicesBehindDoor('interface'), ...servicesBehindDoor('gateway')]

    expect(new Set(claimed).size).toBe(claimed.length)
  })
})
