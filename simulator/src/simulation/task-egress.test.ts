import { describe, expect, it } from 'vitest'
import { buildLogShipment, buildSecretFetch, isFetchingSecret } from './task-egress'
import { securityGroupBoundary } from './security-groups'
import { TASK_STATUS_MESSAGE } from '../types/task-data'

const SERVICE_TO_ENDPOINT = 'ecs-service-interface-endpoints'
const ENDPOINT_TO_LOGS = 'interface-endpoints-cloudwatch-logs'

const TASK_TO_ENDPOINT = 'task-1-secrets-manager'
const ENDPOINT_TO_SECRETS = 'interface-endpoints-secrets-manager'

const LOG_LEGS = {
  taskId: 'task-1',
  endpointEdgeId: SERVICE_TO_ENDPOINT,
  serviceEdgeId: ENDPOINT_TO_LOGS,
}

const SECRET_LEGS = {
  taskId: 'task-1',
  endpointEdgeId: TASK_TO_ENDPOINT,
  serviceEdgeId: ENDPOINT_TO_SECRETS,
}

const LOGS_UP = new Set([SERVICE_TO_ENDPOINT, ENDPOINT_TO_LOGS])
const SECRETS_UP = new Set([TASK_TO_ENDPOINT, ENDPOINT_TO_SECRETS])

describe('shipping a log line', () => {
  it('still names the task whose request produced it, so the line keeps its cause', () => {
    expect(LOG_LEGS.taskId).toBe('task-1')
  })

  it('leaves on the one line the whole service shares, rather than a line per task', () => {
    const legs = buildLogShipment(LOG_LEGS, LOGS_UP)

    expect(legs.map((leg) => leg.edgeId)).toEqual([SERVICE_TO_ENDPOINT, ENDPOINT_TO_LOGS])
    expect(legs.every((leg) => !leg.reversed)).toBe(true)
  })

  it('drops the legs whose edge is gone', () => {
    expect(buildLogShipment(LOG_LEGS, new Set([SERVICE_TO_ENDPOINT]))).toHaveLength(1)
  })
})

describe('fetching the database password', () => {
  it('goes out and comes back, because the container waits for the value', () => {
    const legs = buildSecretFetch(SECRET_LEGS, SECRETS_UP)

    expect(legs.map((leg) => `${leg.edgeId}${leg.reversed ? ' back' : ''}`)).toEqual([
      TASK_TO_ENDPOINT,
      ENDPOINT_TO_SECRETS,
      `${ENDPOINT_TO_SECRETS} back`,
      `${TASK_TO_ENDPOINT} back`,
    ])
  })

  it('gives back nothing when the endpoint is unreachable', () => {
    expect(buildSecretFetch(SECRET_LEGS, new Set())).toEqual([])
  })
})

describe('which security group rule every one of these calls leaves under', () => {
  it('is the same egress side of ecs_sg that the database traffic already leaves by', () => {
    const rules = securityGroupBoundary('task', 'out')?.rules ?? []

    expect(rules.every((rule) => rule.direction === 'egress')).toBe(true)
    expect(rules.map((rule) => rule.peer)).toContain('vpc_endpoints_sg')
  })
})

describe('when a task asks for its secret', () => {
  it('happens in the stage that is starting the container, not the one pulling the image', () => {
    expect(isFetchingSecret('starting')).toBe(true)
    expect(TASK_STATUS_MESSAGE.starting).toContain('starting container')
  })

  it('never happens while the image is still coming down', () => {
    expect(isFetchingSecret('provisioning')).toBe(false)
  })

  it('never happens again once the task is serving traffic', () => {
    expect(isFetchingSecret('healthy')).toBe(false)
    expect(isFetchingSecret('registering')).toBe(false)
  })
})
