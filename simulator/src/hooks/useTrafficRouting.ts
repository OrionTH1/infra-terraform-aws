import { useEffect, useMemo } from 'react'
import { ALB_NODE_ID } from '../canvas/initial-graph'
import { distributeRoundRobin } from '../simulation/traffic-distribution'
import { targetsForRequests } from '../simulation/target-group'
import { toTrafficSource, type TrafficSourceNode } from '../simulation/traffic-source'
import { useSimulationStore, type SourceRate, type TaskRuntime } from '../store/useSimulationStore'
import type { SimulatorFlowEdge } from '../types/edge-data'
import type { SimulatorFlowNode } from '../types/node-data'

interface TrafficRoutingArgs {
  nodes: SimulatorFlowNode[]
  edges: SimulatorFlowEdge[]
  tasks: TaskRuntime[]
}

export interface TrafficRouting {
  requestsByUserId: Map<string, number>
  deliveredByUserId: Map<string, number>
  requestsByTaskId: Map<string, number>
  blockedUserIds: Set<string>
  blockedIpCountByUserId: Map<string, number>
  totalRequestsSent: number
  totalRequestsAtAlb: number
  healthyTaskCount: number
  servingTaskCount: number
  isFailingOpen: boolean
}

export function useTrafficRouting({ nodes, edges, tasks }: TrafficRoutingArgs): TrafficRouting {
  const setSourceRates = useSimulationStore((state) => state.setSourceRates)
  const blockedIps = useSimulationStore((state) => state.blockedIps)

  const trafficSources = useMemo(
    () => nodes.map(toTrafficSource).filter((source): source is TrafficSourceNode => source !== null),
    [nodes],
  )

  const connectedSourceIds = useMemo(
    () => new Set(edges.filter((edge) => edge.target === ALB_NODE_ID).map((edge) => edge.source)),
    [edges],
  )

  const requestsByUserId = useMemo(
    () => new Map(trafficSources.map((source) => [source.id, source.requestsPerMinute * source.sourceIps.length])),
    [trafficSources],
  )

  const sourceRates = useMemo<SourceRate[]>(() => {
    const byIp = new Map<string, number>()

    for (const source of trafficSources) {
      const requestsPerMinute = connectedSourceIds.has(source.id) ? source.requestsPerMinute : 0
      for (const ip of source.sourceIps) {
        byIp.set(ip, (byIp.get(ip) ?? 0) + requestsPerMinute)
      }
    }

    return [...byIp].map(([ip, requestsPerMinute]) => ({ ip, requestsPerMinute }))
  }, [trafficSources, connectedSourceIds])

  useEffect(() => {
    setSourceRates(sourceRates)
  }, [sourceRates, setSourceRates])

  const blockedIpSet = useMemo(() => new Set(blockedIps), [blockedIps])

  const blockedIpCountByUserId = useMemo(
    () =>
      new Map(
        trafficSources.map((source) => [source.id, source.sourceIps.filter((ip) => blockedIpSet.has(ip)).length]),
      ),
    [trafficSources, blockedIpSet],
  )

  const blockedUserIds = useMemo(
    () =>
      new Set(
        trafficSources
          .filter((source) => (blockedIpCountByUserId.get(source.id) ?? 0) === source.sourceIps.length)
          .map((source) => source.id),
      ),
    [trafficSources, blockedIpCountByUserId],
  )

  const deliveredByUserId = useMemo(
    () =>
      new Map(
        trafficSources.map((source) => [
          source.id,
          source.requestsPerMinute * (source.sourceIps.length - (blockedIpCountByUserId.get(source.id) ?? 0)),
        ]),
      ),
    [trafficSources, blockedIpCountByUserId],
  )

  const totalRequestsSent = useMemo(
    () => sourceRates.reduce((sum, rate) => sum + rate.requestsPerMinute, 0),
    [sourceRates],
  )

  const totalRequestsAtAlb = useMemo(
    () => sourceRates.reduce((sum, rate) => (blockedIpSet.has(rate.ip) ? sum : sum + rate.requestsPerMinute), 0),
    [sourceRates, blockedIpSet],
  )

  const healthyTaskCount = useMemo(() => tasks.filter((task) => task.status === 'healthy').length, [tasks])

  const serving = useMemo(() => targetsForRequests(tasks), [tasks])

  const requestsByTaskId = useMemo(
    () => distributeRoundRobin(totalRequestsAtAlb, serving.targets.map((task) => task.id)),
    [totalRequestsAtAlb, serving],
  )

  return {
    requestsByUserId,
    deliveredByUserId,
    requestsByTaskId,
    blockedUserIds,
    blockedIpCountByUserId,
    totalRequestsSent,
    totalRequestsAtAlb,
    healthyTaskCount,
    servingTaskCount: serving.targets.length,
    isFailingOpen: serving.isFailingOpen,
  }
}
