import { create } from 'zustand'
import {
  AURORA_FAILOVER_MS,
  AURORA_REBUILD_WRITER_MS,
  AURORA_SERVERLESS,
  AUTOSCALING,
  BOOT_TIME_SCALE,
  DEFAULT_TIME_SCALE,
  LATENCY,
  RDS_INSTANCE_FAILED_LINGER_MS,
  RDS_READ_FRACTION,
  IMAGE_PULL_TIMEOUT_MS,
  TASK_LIFECYCLE,
} from '../simulation/simulation-config'
import {
  advanceResourceLedger,
  areAllCreated,
  createResourceLedger,
  isCreated,
  BOOT_GRAPH,
  type ResourceLedger,
} from '../simulation/boot-graph'
import {
  RDS_FIRST_INSTANCE_ID,
  RDS_SECOND_INSTANCE_ID,
  isAcceptingTraffic,
  needsWriterPromotion,
  routeAuroraTraffic,
  vacantInstanceId,
} from '../simulation/aurora'
import {
  advanceAcu,
  demandedAcu,
  queriesForRequests,
  readerFloorAcu,
  runningFloorAcu,
} from '../simulation/aurora-capacity'
import {
  IDLE_LATENCY,
  appendLatencySample,
  computeLatency,
  p99Ms,
  sameDisplayedLatency,
  smoothLatency,
  type LatencyBreakdown,
} from '../simulation/latency'
import { isRunningTask, selectDrainIndexes } from '../simulation/scale-in'
import {
  createAlarmBoard,
  recordAlarmSamples,
  type AlarmBoard,
} from '../simulation/observability-alarms'
import { splitReadWrite } from '../simulation/traffic-distribution'
import { advanceWafSource, createWafSource, windowRequestCount, type WafSourceState } from '../simulation/waf'
import type { TaskStatus } from '../types/task-data'
import type { RdsInstanceLifecycle, RdsInstanceRole } from '../types/node-data'

const SCALE_IN_MARGIN = 0.7

export interface SourceRate {
  ip: string
  requestsPerMinute: number
}

export interface TaskRuntime {
  id: string
  instanceId: number
  status: TaskStatus
  stageEnteredAt: number
  createdAt: number
}

export interface RdsInstanceRuntime {
  instanceId: number
  lifecycle: RdsInstanceLifecycle
  stageEnteredAt: number
  durationMs: number | null
  acu: number
}

export interface RdsSlots {
  writer: RdsInstanceRuntime | null
  reader: RdsInstanceRuntime | null
}

interface SimulationState {
  tasks: TaskRuntime[]
  resources: ResourceLedger
  isApplyComplete: boolean
  hasChosenTimeScale: boolean
  currentRequestRate: number
  sourceRates: SourceRate[]
  wafSources: Record<string, WafSourceState>
  blockedIps: string[]
  wafBlockedRequests: number
  clock: number
  timeScale: number
  lastScaleOutAt: number
  lastScaleInAt: number
  scaleOutBreachAt: number | null
  scaleInBreachAt: number | null
  desiredCount: number
  nextInstanceId: number
  rdsSlots: RdsSlots
  hasSeededRdsWriter: boolean
  hasSeededRdsReader: boolean
  alarms: AlarmBoard
  latency: LatencyBreakdown
  displayedLatency: LatencyBreakdown
  latencyHistory: number[]
  lastLatencySampleAt: number
  killTask: (taskId: string) => void
  killRdsInstance: (role: RdsInstanceRole) => void
  setSourceRates: (rates: SourceRate[]) => void
  setTimeScale: (timeScale: number) => void
  completeImagePull: (taskId: string) => void
  tick: (elapsedRealMs: number) => void
}

function desiredTaskCount(requestsPerMinute: number, targetPerTask: number): number {
  return Math.min(AUTOSCALING.maxCapacity, Math.max(AUTOSCALING.minCapacity, Math.ceil(requestsPerMinute / targetPerTask)))
}

function isRunning(task: TaskRuntime): boolean {
  return isRunningTask(task.status)
}

function launchTasks(count: number, firstInstanceId: number, now: number): TaskRuntime[] {
  return Array.from({ length: count }, (_, offset) => {
    const instanceId = firstInstanceId + offset
    return {
      id: `task-${instanceId}`,
      instanceId,
      status: 'provisioning' as const,
      stageEnteredAt: now,
      createdAt: now,
    }
  })
}

function sameRates(current: SourceRate[], next: SourceRate[]): boolean {
  return (
    current.length === next.length &&
    current.every((rate, index) => rate.ip === next[index].ip && rate.requestsPerMinute === next[index].requestsPerMinute)
  )
}

function sameIds(current: string[], next: string[]): boolean {
  return current.length === next.length && current.every((id, index) => id === next[index])
}

function advanceTask(task: TaskRuntime, now: number): TaskRuntime | null {
  const elapsed = now - task.stageEnteredAt

  if (task.status === 'provisioning' && elapsed >= IMAGE_PULL_TIMEOUT_MS) {
    return { ...task, status: 'starting', stageEnteredAt: now }
  }
  if (task.status === 'starting' && elapsed >= TASK_LIFECYCLE.startingMs) {
    return { ...task, status: 'registering', stageEnteredAt: now }
  }
  if (task.status === 'registering' && elapsed >= TASK_LIFECYCLE.registeringMs) {
    return { ...task, status: 'healthy', stageEnteredAt: now }
  }
  if (task.status === 'draining' && elapsed >= TASK_LIFECYCLE.drainingMs) {
    return null
  }
  if (task.status === 'failed' && elapsed >= TASK_LIFECYCLE.failedLingerMs) {
    return null
  }
  return task
}

function advanceRdsSlot(slot: RdsInstanceRuntime | null, now: number): RdsInstanceRuntime | null {
  if (!slot || slot.durationMs === null) return slot
  if (now - slot.stageEnteredAt < slot.durationMs) return slot
  if (slot.lifecycle === 'failed') return null
  return { ...slot, lifecycle: 'available', stageEnteredAt: now, durationMs: null }
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  tasks: [],
  resources: createResourceLedger(),
  isApplyComplete: false,
  hasChosenTimeScale: false,
  currentRequestRate: 0,
  sourceRates: [],
  wafSources: {},
  blockedIps: [],
  wafBlockedRequests: 0,
  clock: 0,
  timeScale: BOOT_TIME_SCALE,
  lastScaleOutAt: -Infinity,
  lastScaleInAt: -Infinity,
  scaleOutBreachAt: null,
  scaleInBreachAt: null,
  desiredCount: AUTOSCALING.minCapacity,
  nextInstanceId: 1,
  rdsSlots: { writer: null, reader: null },
  hasSeededRdsWriter: false,
  hasSeededRdsReader: false,
  alarms: createAlarmBoard(0),
  latency: IDLE_LATENCY,
  displayedLatency: IDLE_LATENCY,
  latencyHistory: [],
  lastLatencySampleAt: 0,

  killRdsInstance: (role) =>
    set((state) => {
      const slot = state.rdsSlots[role]
      if (!slot || slot.lifecycle === 'failed') return state

      return {
        rdsSlots: {
          ...state.rdsSlots,
          [role]: {
            ...slot,
            lifecycle: 'failed' as const,
            stageEnteredAt: state.clock,
            durationMs: RDS_INSTANCE_FAILED_LINGER_MS,
          },
        },
      }
    }),

  killTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId && task.status !== 'failed'
          ? {
              ...task,
              status: 'failed' as const,
              stageEnteredAt: state.clock,
            }
          : task,
      ),
    })),

  setSourceRates: (rates) =>
    set((state) => (sameRates(state.sourceRates, rates) ? state : { sourceRates: rates })),

  setTimeScale: (timeScale) => set({ timeScale, hasChosenTimeScale: true }),

  completeImagePull: (taskId) =>
    set((state) => {
      const task = state.tasks.find((entry) => entry.id === taskId)
      if (task === undefined || task.status !== 'provisioning') return state

      return {
        tasks: state.tasks.map((entry) =>
          entry.id === taskId ? { ...entry, status: 'starting' as const, stageEnteredAt: state.clock } : entry,
        ),
      }
    }),

  tick: (elapsedRealMs) => {
    const state = get()
    const now = state.clock + elapsedRealMs * state.timeScale

    const resources = advanceResourceLedger(state.resources, now)
    const isApplyComplete = areAllCreated(resources)
    const hasServiceStarted = isCreated(resources, 'ecsService')

    const advanced = state.tasks.map((task) => advanceTask(task, now)).filter((task): task is TaskRuntime => task !== null)
    const lifecycleChanged =
      advanced.length !== state.tasks.length || advanced.some((task, index) => task !== state.tasks[index])

    let tasks = lifecycleChanged ? advanced : state.tasks
    let desiredCount = state.desiredCount
    let lastScaleOutAt = state.lastScaleOutAt
    let lastScaleInAt = state.lastScaleInAt
    let nextInstanceId = state.nextInstanceId

    const wafSources: Record<string, WafSourceState> = {}
    const blockedIps: string[] = []
    let wafBlockedRequests = state.wafBlockedRequests
    let currentRequestRate = 0

    const activeRates = new Map(state.sourceRates.map((rate) => [rate.ip, rate.requestsPerMinute]))

    const trackedIps = new Set([...Object.keys(state.wafSources), ...activeRates.keys()])

    for (const ip of trackedIps) {
      const requestsPerMinute = activeRates.get(ip) ?? 0
      const previous = state.wafSources[ip]
      const source = advanceWafSource(previous ?? createWafSource(now), requestsPerMinute, now - state.clock, now)

      wafBlockedRequests += source.blockedRequests - (previous?.blockedRequests ?? 0)

      if (source.isBlocked) blockedIps.push(ip)
      else currentRequestRate += requestsPerMinute

      const isStillRemembered = activeRates.has(ip) || source.isBlocked || windowRequestCount(source) > 0
      if (isStillRemembered) wafSources[ip] = source
    }

    const scaleOutTarget = desiredTaskCount(currentRequestRate, AUTOSCALING.targetRequestsPerMinutePerTask)
    const scaleInTarget = desiredTaskCount(currentRequestRate, AUTOSCALING.targetRequestsPerMinutePerTask * SCALE_IN_MARGIN)

    let scaleOutBreachAt = scaleOutTarget > desiredCount ? (state.scaleOutBreachAt ?? now) : null
    let scaleInBreachAt = scaleInTarget < desiredCount ? (state.scaleInBreachAt ?? now) : null

    const scaleOutAlarm = scaleOutBreachAt !== null && now - scaleOutBreachAt >= AUTOSCALING.scaleOutEvaluationMs
    const scaleInAlarm = scaleInBreachAt !== null && now - scaleInBreachAt >= AUTOSCALING.scaleInEvaluationMs

    if (scaleOutAlarm && now - lastScaleOutAt >= AUTOSCALING.scaleOutCooldownMs) {
      desiredCount = scaleOutTarget
      lastScaleOutAt = now
      scaleOutBreachAt = null
      scaleInBreachAt = null
    } else if (scaleInAlarm && now - lastScaleInAt >= AUTOSCALING.scaleInCooldownMs) {
      const drainIndexes = new Set(selectDrainIndexes(tasks.map((task) => task.status), scaleInTarget))

      if (drainIndexes.size > 0) {
        tasks = tasks.map((task, index) =>
          drainIndexes.has(index)
            ? { ...task, status: 'draining', stageEnteredAt: now }
            : task,
        )
        desiredCount = scaleInTarget
        lastScaleInAt = now
        scaleOutBreachAt = null
        scaleInBreachAt = null
      }
    }

    const missingCount = hasServiceStarted ? desiredCount - tasks.filter(isRunning).length : 0
    if (missingCount > 0) {
      tasks = [...tasks, ...launchTasks(missingCount, nextInstanceId, now)]
      nextInstanceId += missingCount
    }

    const tasksChanged = tasks !== state.tasks

    const hasJustFinishedApplying = isApplyComplete && !state.isApplyComplete

    let writer = advanceRdsSlot(state.rdsSlots.writer, now)
    let reader = advanceRdsSlot(state.rdsSlots.reader, now)
    let hasSeededRdsWriter = state.hasSeededRdsWriter
    let hasSeededRdsReader = state.hasSeededRdsReader

    if (writer === null && isCreated(resources, 'rdsWriter')) {
      if (!hasSeededRdsWriter) {
        writer = {
          instanceId: RDS_FIRST_INSTANCE_ID,
          lifecycle: 'available',
          stageEnteredAt: now,
          durationMs: null,
          acu: runningFloorAcu(),
        }
        hasSeededRdsWriter = true
      } else if (reader && reader.lifecycle === 'available') {
        writer = {
          instanceId: reader.instanceId,
          lifecycle: 'promoting',
          stageEnteredAt: now,
          durationMs: AURORA_FAILOVER_MS,
          acu: reader.acu,
        }
        reader = {
          instanceId: vacantInstanceId(writer),
          lifecycle: 'provisioning',
          stageEnteredAt: now,
          durationMs: BOOT_GRAPH.rdsReader.durationMs,
          acu: runningFloorAcu(),
        }
      } else {
        writer = {
          instanceId: vacantInstanceId(reader),
          lifecycle: 'provisioning',
          stageEnteredAt: now,
          durationMs: AURORA_REBUILD_WRITER_MS,
          acu: runningFloorAcu(),
        }
      }
    }

    if (reader === null && isCreated(resources, 'rdsReader')) {
      if (!hasSeededRdsReader) {
        reader = {
          instanceId: RDS_SECOND_INSTANCE_ID,
          lifecycle: 'available',
          stageEnteredAt: now,
          durationMs: null,
          acu: runningFloorAcu(),
        }
        hasSeededRdsReader = true
      } else {
        reader = {
          instanceId: vacantInstanceId(writer),
          lifecycle: 'provisioning',
          stageEnteredAt: now,
          durationMs: BOOT_GRAPH.rdsReader.durationMs,
          acu: runningFloorAcu(),
        }
      }
    }

    if (writer && reader && needsWriterPromotion(writer.lifecycle, reader.lifecycle)) {
      const stillBeingCreated = writer
      writer = {
        instanceId: reader.instanceId,
        lifecycle: 'promoting',
        stageEnteredAt: now,
        durationMs: AURORA_FAILOVER_MS,
        acu: reader.acu,
      }
      reader = stillBeingCreated
    }

    const healthyTaskCount = tasks.filter((task) => task.status === 'healthy').length
    const deliveredRequests = healthyTaskCount > 0 ? currentRequestRate : 0
    const { reads, writes } = splitReadWrite(deliveredRequests, RDS_READ_FRACTION)
    const auroraTraffic = routeAuroraTraffic(reads, writes, {
      isWriterAvailable: isAcceptingTraffic(writer?.lifecycle),
      isReaderAvailable: isAcceptingTraffic(reader?.lifecycle),
    })

    const deltaMs = now - state.clock

    const writerAcu =
      writer && isAcceptingTraffic(writer.lifecycle)
        ? advanceAcu(writer.acu, demandedAcu(queriesForRequests(auroraTraffic.writerRequestsPerMinute)), deltaMs)
        : (writer?.acu ?? runningFloorAcu())
    const readerDemand = Math.max(
      demandedAcu(queriesForRequests(auroraTraffic.readerRequestsPerMinute)),
      readerFloorAcu(writerAcu, AURORA_SERVERLESS.promotionTier),
    )
    const readerAcu =
      reader && isAcceptingTraffic(reader.lifecycle)
        ? advanceAcu(reader.acu, readerDemand, deltaMs)
        : (reader?.acu ?? runningFloorAcu())

    if (writer && writer.acu !== writerAcu) writer = { ...writer, acu: writerAcu }
    if (reader && reader.acu !== readerAcu) reader = { ...reader, acu: readerAcu }

    const latency = smoothLatency(
      state.latency,
      computeLatency({
        requestsPerMinutePerTask: healthyTaskCount > 0 ? deliveredRequests / healthyTaskCount : 0,
        writerRequestsPerMinute: auroraTraffic.writerRequestsPerMinute,
        readerRequestsPerMinute: auroraTraffic.readerRequestsPerMinute,
        writerAcu,
        readerAcu,
      }),
      deltaMs,
    )

    const isLatencySampleDue = now - state.lastLatencySampleAt >= LATENCY.historySampleMs

    const alarms = hasServiceStarted
      ? recordAlarmSamples(
          state.alarms,
          {
            healthyHostCount: healthyTaskCount,
            runningTaskCount: tasks.filter((task) => isRunningTask(task.status)).length,
            targetResponseTimeP99Seconds: p99Ms(latency.totalMs) / 1000,
            errorRatePercent: healthyTaskCount === 0 && currentRequestRate > 0 ? 100 : 0,
          },
          now,
        )
      : state.alarms

    set({
      clock: now,
      resources,
      alarms,
      latency,
      displayedLatency: sameDisplayedLatency(state.displayedLatency, latency) ? state.displayedLatency : latency,
      latencyHistory: isLatencySampleDue
        ? appendLatencySample(state.latencyHistory, latency.totalMs)
        : state.latencyHistory,
      lastLatencySampleAt: isLatencySampleDue ? now : state.lastLatencySampleAt,
      isApplyComplete,
      timeScale: hasJustFinishedApplying && !state.hasChosenTimeScale ? DEFAULT_TIME_SCALE : state.timeScale,
      tasks: tasksChanged ? tasks : state.tasks,
      currentRequestRate,
      wafSources,
      wafBlockedRequests,
      blockedIps: sameIds(state.blockedIps, blockedIps) ? state.blockedIps : blockedIps,
      desiredCount,
      lastScaleOutAt,
      lastScaleInAt,
      nextInstanceId,
      scaleOutBreachAt,
      scaleInBreachAt,
      rdsSlots: writer === state.rdsSlots.writer && reader === state.rdsSlots.reader ? state.rdsSlots : { writer, reader },
      hasSeededRdsWriter,
      hasSeededRdsReader,
    })
  },
}))
