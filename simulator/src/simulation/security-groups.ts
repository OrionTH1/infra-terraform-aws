export type SecurityGroupDirection = 'ingress' | 'egress'

export interface SecurityGroupRule {
  direction: SecurityGroupDirection
  securityGroup: string
  protocol: string
  port: number
  peer: string
}

export interface SecurityGroupBoundary {
  pairId: string | null
  rules: SecurityGroupRule[]
}

export const ALB_TO_ECS_PAIR = 'alb-to-ecs'
export const ECS_TO_RDS_PAIR = 'ecs-to-rds'

const PUBLIC_INTERNET = '0.0.0.0/0'
const S3_PREFIX_LIST = 'pl-s3'
const APP_PORT = 8080
const POSTGRES_PORT = 5432
const HTTPS_PORT = 443

export function boundaryKey(nodeType: string, handleId: string): string {
  return `${nodeType}:${handleId}`
}

export const SECURITY_GROUP_BOUNDARIES: Record<string, SecurityGroupBoundary> = {
  [boundaryKey('alb', 'in')]: {
    pairId: null,
    rules: [
      { direction: 'ingress', securityGroup: 'alb_sg', protocol: 'tcp', port: 80, peer: PUBLIC_INTERNET },
      { direction: 'ingress', securityGroup: 'alb_sg', protocol: 'tcp', port: HTTPS_PORT, peer: PUBLIC_INTERNET },
    ],
  },
  [boundaryKey('alb', 'out')]: {
    pairId: ALB_TO_ECS_PAIR,
    rules: [{ direction: 'egress', securityGroup: 'alb_sg', protocol: 'tcp', port: APP_PORT, peer: 'ecs_sg' }],
  },
  [boundaryKey('task', 'in')]: {
    pairId: ALB_TO_ECS_PAIR,
    rules: [{ direction: 'ingress', securityGroup: 'ecs_sg', protocol: 'tcp', port: APP_PORT, peer: 'alb_sg' }],
  },
  [boundaryKey('task', 'out')]: {
    pairId: ECS_TO_RDS_PAIR,
    rules: [
      { direction: 'egress', securityGroup: 'ecs_sg', protocol: 'tcp', port: POSTGRES_PORT, peer: 'rds_sg' },
      { direction: 'egress', securityGroup: 'ecs_sg', protocol: 'tcp', port: HTTPS_PORT, peer: 'vpc_endpoints_sg' },
      { direction: 'egress', securityGroup: 'ecs_sg', protocol: 'tcp', port: HTTPS_PORT, peer: S3_PREFIX_LIST },
    ],
  },
  [boundaryKey('ecsService', 'logs-out')]: {
    pairId: null,
    rules: [
      { direction: 'egress', securityGroup: 'ecs_sg', protocol: 'tcp', port: HTTPS_PORT, peer: 'vpc_endpoints_sg' },
    ],
  },
  [boundaryKey('rdsInstance', 'in')]: {
    pairId: ECS_TO_RDS_PAIR,
    rules: [{ direction: 'ingress', securityGroup: 'rds_sg', protocol: 'tcp', port: POSTGRES_PORT, peer: 'ecs_sg' }],
  },
}

export function securityGroupBoundary(nodeType: string, handleId: string): SecurityGroupBoundary | null {
  return SECURITY_GROUP_BOUNDARIES[boundaryKey(nodeType, handleId)] ?? null
}

export function boundaryDirection(boundary: SecurityGroupBoundary): SecurityGroupDirection {
  return boundary.rules[0].direction
}

export function formatRule(rule: SecurityGroupRule): string {
  const port = `${rule.protocol}/${rule.port}`
  return rule.direction === 'ingress' ? `${rule.peer} → ${port}` : `${port} → ${rule.peer}`
}
