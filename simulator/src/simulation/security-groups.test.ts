import { describe, expect, it } from 'vitest'
import {
  ALB_TO_ECS_PAIR,
  ECS_TO_RDS_PAIR,
  SECURITY_GROUP_BOUNDARIES,
  boundaryDirection,
  boundaryKey,
  formatRule,
  securityGroupBoundary,
  type SecurityGroupBoundary,
  type SecurityGroupRule,
} from './security-groups'
import {
  ENDPOINT_TO_LOGS_EDGE_ID,
  ENDPOINT_TO_SECRETS_EDGE_ID,
  JUNCTION_TO_READER_EDGE_ID,
  JUNCTION_TO_WRITER_EDGE_ID,
  SERVICE_TO_ENDPOINT_EDGE_ID,
  albToTaskEdgeId,
  isEdgeUnderSecurityGroupRule,
  taskToJunctionEdgeId,
  taskToRegistryEdgeId,
  taskToSecretsEdgeId,
  taskToStorageEdgeId,
} from '../canvas/initial-graph'

function boundariesInPair(pairId: string): SecurityGroupBoundary[] {
  return Object.values(SECURITY_GROUP_BOUNDARIES).filter((boundary) => boundary.pairId === pairId)
}

function facingRules(pairId: string): SecurityGroupRule[] {
  const [one, other] = boundariesInPair(pairId)
  const securityGroups = new Set([one, other].flatMap((boundary) => boundary.rules.map((rule) => rule.securityGroup)))

  return [one, other].flatMap((boundary) => boundary.rules.filter((rule) => securityGroups.has(rule.peer)))
}

describe('the catalog', () => {
  it('covers every handle that sits on a network boundary', () => {
    expect(Object.keys(SECURITY_GROUP_BOUNDARIES).sort()).toEqual([
      'alb:in',
      'alb:out',
      'ecsService:logs-out',
      'rdsInstance:in',
      'task:in',
      'task:out',
    ])
  })

  it('has nothing to say about a control plane handle', () => {
    expect(securityGroupBoundary('alb', 'metric-out')).toBeNull()
    expect(securityGroupBoundary('autoScaling', 'desired-count-out')).toBeNull()
    expect(securityGroupBoundary('rdsInstance', 'replicate-in')).toBeNull()
  })

  it('gives every rule of a boundary the same direction', () => {
    for (const boundary of Object.values(SECURITY_GROUP_BOUNDARIES)) {
      const directions = new Set(boundary.rules.map((rule) => rule.direction))

      expect(directions.size).toBe(1)
    }
  })

  it('never declares a boundary with no rule at all', () => {
    for (const boundary of Object.values(SECURITY_GROUP_BOUNDARIES)) {
      expect(boundary.rules.length).toBeGreaterThan(0)
    }
  })
})

describe('rules that come in pairs', () => {
  it.each([ALB_TO_ECS_PAIR, ECS_TO_RDS_PAIR])('joins exactly two boundaries for %s', (pairId) => {
    expect(boundariesInPair(pairId)).toHaveLength(2)
  })

  it.each([ALB_TO_ECS_PAIR, ECS_TO_RDS_PAIR])('puts one egress against one ingress for %s', (pairId) => {
    const directions = boundariesInPair(pairId).map(boundaryDirection).sort()

    expect(directions).toEqual(['egress', 'ingress'])
  })

  it.each([ALB_TO_ECS_PAIR, ECS_TO_RDS_PAIR])('agrees on the port at both ends of %s', (pairId) => {
    const ports = new Set(facingRules(pairId).map((rule) => rule.port))

    expect(ports.size).toBe(1)
  })

  it('leaves the egress that does not face the pair out of the handshake', () => {
    const taskEgress = securityGroupBoundary('task', 'out')?.rules ?? []

    expect(taskEgress).toHaveLength(3)
    expect(facingRules(ECS_TO_RDS_PAIR)).toHaveLength(2)
  })

  it('points each side of a pair at the security group of the other', () => {
    const egress = securityGroupBoundary('alb', 'out')
    const ingress = securityGroupBoundary('task', 'in')

    expect(egress?.rules[0].peer).toBe(ingress?.rules[0].securityGroup)
    expect(ingress?.rules[0].peer).toBe(egress?.rules[0].securityGroup)
  })
})

describe('the public edge of the VPC', () => {
  it('leaves the load balancer ingress unpaired, since the internet has no security group', () => {
    expect(securityGroupBoundary('alb', 'in')?.pairId).toBeNull()
  })

  it('is the only boundary that opens to an address range instead of a security group', () => {
    const openToTheWorld = Object.values(SECURITY_GROUP_BOUNDARIES).filter((boundary) =>
      boundary.rules.some((rule) => rule.peer.includes('/')),
    )

    expect(openToTheWorld).toHaveLength(1)
  })
})

describe('which edges a hovered rule lights up', () => {
  const ALB_EGRESS = boundaryKey('alb', 'out')
  const TASK_INGRESS = boundaryKey('task', 'in')
  const TASK_EGRESS = boundaryKey('task', 'out')
  const RDS_INGRESS = boundaryKey('rdsInstance', 'in')

  it('lights every alb to task edge from either side of the front boundary', () => {
    for (const boundary of [ALB_EGRESS, TASK_INGRESS]) {
      expect(isEdgeUnderSecurityGroupRule(albToTaskEdgeId('task-1'), boundary)).toBe(true)
      expect(isEdgeUnderSecurityGroupRule(albToTaskEdgeId('task-7'), boundary)).toBe(true)
    }
  })

  it('lights the whole path to the database, junction included', () => {
    expect(isEdgeUnderSecurityGroupRule(taskToJunctionEdgeId('task-1'), TASK_EGRESS)).toBe(true)
    expect(isEdgeUnderSecurityGroupRule(JUNCTION_TO_WRITER_EDGE_ID, TASK_EGRESS)).toBe(true)
    expect(isEdgeUnderSecurityGroupRule(JUNCTION_TO_READER_EDGE_ID, TASK_EGRESS)).toBe(true)
  })

  it('lights the calls to the endpoints too, because the same egress rules allow them', () => {
    for (const edgeId of [
      taskToRegistryEdgeId('task-1'),
      taskToStorageEdgeId('task-1'),
      taskToSecretsEdgeId('task-1'),
    ]) {
      expect(isEdgeUnderSecurityGroupRule(edgeId, TASK_EGRESS)).toBe(true)
    }
  })

  it('gives the shared log line its own boundary, on the frame it actually leaves', () => {
    const SERVICE_EGRESS = boundaryKey('ecsService', 'logs-out')

    expect(isEdgeUnderSecurityGroupRule(SERVICE_TO_ENDPOINT_EDGE_ID, SERVICE_EGRESS)).toBe(true)
    expect(isEdgeUnderSecurityGroupRule(SERVICE_TO_ENDPOINT_EDGE_ID, TASK_EGRESS)).toBe(false)
    expect(isEdgeUnderSecurityGroupRule(taskToRegistryEdgeId('task-1'), SERVICE_EGRESS)).toBe(false)
  })

  it('declares that line under the same security group the tasks egress by', () => {
    const service = securityGroupBoundary('ecsService', 'logs-out')?.rules ?? []
    const task = securityGroupBoundary('task', 'out')?.rules ?? []

    expect(service).toHaveLength(1)
    expect(task).toContainEqual(service[0])
  })

  it('stops at the endpoint, since nothing beyond it answers to this security group', () => {
    expect(isEdgeUnderSecurityGroupRule(ENDPOINT_TO_LOGS_EDGE_ID, TASK_EGRESS)).toBe(false)
    expect(isEdgeUnderSecurityGroupRule(ENDPOINT_TO_SECRETS_EDGE_ID, TASK_EGRESS)).toBe(false)
  })

  it('leaves the endpoint traffic dark from the database side, which never allowed it', () => {
    expect(isEdgeUnderSecurityGroupRule(taskToJunctionEdgeId('task-1'), RDS_INGRESS)).toBe(true)
    expect(isEdgeUnderSecurityGroupRule(SERVICE_TO_ENDPOINT_EDGE_ID, RDS_INGRESS)).toBe(false)
  })

  it('keeps the two boundaries from lighting each other up', () => {
    expect(isEdgeUnderSecurityGroupRule(albToTaskEdgeId('task-1'), TASK_EGRESS)).toBe(false)
    expect(isEdgeUnderSecurityGroupRule(JUNCTION_TO_WRITER_EDGE_ID, ALB_EGRESS)).toBe(false)
  })

  it('lights nothing while no boundary is hovered', () => {
    expect(isEdgeUnderSecurityGroupRule(albToTaskEdgeId('task-1'), null)).toBe(false)
    expect(isEdgeUnderSecurityGroupRule(JUNCTION_TO_WRITER_EDGE_ID, null)).toBe(false)
  })
})

describe('formatting a rule for the hover', () => {
  it('puts the peer first when traffic is coming in, so the arrow follows the flow', () => {
    expect(formatRule({ direction: 'ingress', securityGroup: 'ecs_sg', protocol: 'tcp', port: 8080, peer: 'alb_sg' }))
      .toBe('alb_sg → tcp/8080')
  })

  it('puts the peer last when traffic is leaving, keeping the arrow pointing the same way', () => {
    expect(formatRule({ direction: 'egress', securityGroup: 'ecs_sg', protocol: 'tcp', port: 5432, peer: 'rds_sg' }))
      .toBe('tcp/5432 → rds_sg')
  })

  it('never points the arrow against the way traffic travels on the canvas', () => {
    for (const boundary of Object.values(SECURITY_GROUP_BOUNDARIES)) {
      for (const rule of boundary.rules) {
        expect(formatRule(rule)).not.toContain('←')
      }
    }
  })
})
