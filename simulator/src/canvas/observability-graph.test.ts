import { describe, expect, it } from 'vitest'
import {
  ALARMS_TO_SNS_EDGE_ID,
  CLOUDWATCH_ALARMS_NODE_ID,
  SNS_TOPIC_NODE_ID,
  initialEdges,
  initialNodes,
} from './initial-graph'

function nodeById(id: string) {
  return initialNodes.find((node) => node.id === id)
}

describe('the observability corner of the canvas', () => {
  it('puts the alarms and the topic on the board from the start', () => {
    expect(nodeById(CLOUDWATCH_ALARMS_NODE_ID)?.type).toBe('cloudWatchAlarms')
    expect(nodeById(SNS_TOPIC_NODE_ID)?.type).toBe('snsTopic')
  })

  it('sits them in the control plane row, above the vpc', () => {
    const alarms = nodeById(CLOUDWATCH_ALARMS_NODE_ID)
    const sns = nodeById(SNS_TOPIC_NODE_ID)

    expect(alarms?.position.y).toBe(sns?.position.y)
    expect(sns!.position.x).toBeGreaterThan(alarms!.position.x)
  })

  it('draws alarm_actions as the one edge between them', () => {
    const edge = initialEdges.find((candidate) => candidate.id === ALARMS_TO_SNS_EDGE_ID)

    expect(edge?.source).toBe(CLOUDWATCH_ALARMS_NODE_ID)
    expect(edge?.target).toBe(SNS_TOPIC_NODE_ID)
    expect(edge?.data?.isActive).toBe(false)
  })

  it('connects that edge to handles the two nodes actually declare', () => {
    const edge = initialEdges.find((candidate) => candidate.id === ALARMS_TO_SNS_EDGE_ID)

    expect(edge?.sourceHandle).toBe('notify-out')
    expect(edge?.targetHandle).toBe('notify-in')
  })

  it('leaves them off the request path — nothing routes traffic into them', () => {
    const trafficEdges = initialEdges.filter((edge) => edge.type === 'requestFlow')
    const observabilityIds = [CLOUDWATCH_ALARMS_NODE_ID, SNS_TOPIC_NODE_ID]

    expect(
      trafficEdges.some((edge) => observabilityIds.includes(edge.source) || observabilityIds.includes(edge.target)),
    ).toBe(false)
  })
})
