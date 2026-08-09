import { beforeEach, describe, expect, it } from 'vitest'
import { useSimulationStore } from './useSimulationStore'
import { BOOT_CRITICAL_PATH_MS } from '../simulation/boot-graph'
import { OBSERVABILITY_ALARMS, firingAlarms } from '../simulation/observability-alarms'

const TICK_REAL_MS = 16
const BOOT_TIME_SCALE = 600
const ALARM_TIME_SCALE = 10

function advance(simMs: number) {
  const target = useSimulationStore.getState().clock + simMs
  while (useSimulationStore.getState().clock < target) {
    useSimulationStore.getState().tick(TICK_REAL_MS)
  }
}

function advanceUntil(reached: () => boolean, limitMs: number): boolean {
  const deadline = useSimulationStore.getState().clock + limitMs
  while (useSimulationStore.getState().clock < deadline) {
    if (reached()) return true
    advance(5_000)
  }

  return reached()
}

function board() {
  return useSimulationStore.getState().alarms
}

function blastEveryTask() {
  for (const task of useSimulationStore.getState().tasks) {
    useSimulationStore.getState().killTask(task.id)
  }
}

beforeEach(() => {
  useSimulationStore.setState(useSimulationStore.getInitialState(), true)
  useSimulationStore.getState().setTimeScale(BOOT_TIME_SCALE)
  advance(BOOT_CRITICAL_PATH_MS + 60_000)
  useSimulationStore.getState().setTimeScale(ALARM_TIME_SCALE)
})

describe('a service that is behaving', () => {
  it('leaves every alarm quiet', () => {
    advance(10 * 60_000)

    expect(firingAlarms(board())).toEqual([])
  })

  it('has actually gathered datapoints rather than sitting on insufficient data', () => {
    advance(10 * 60_000)

    expect(board().healthyHostCount.state).toBe('OK')
  })
})

describe('losing every task', () => {
  it('drives HealthyHostCount below the minimum and fires the alarm', () => {
    blastEveryTask()

    expect(advanceUntil(() => board().healthyHostCount.state === 'ALARM', 5 * 60_000)).toBe(true)
  })

  it('does not fire on the first breaching period, because evaluation_periods is 2', () => {
    blastEveryTask()
    advance(60_000)

    expect(board().healthyHostCount.state).toBe('OK')
  })

  it('names the terraform alarm it corresponds to', () => {
    blastEveryTask()
    advanceUntil(() => board().healthyHostCount.state === 'ALARM', 5 * 60_000)

    expect(firingAlarms(board()).map((alarm) => alarm.terraformAddress)).toContain(
      'aws_cloudwatch_metric_alarm.no_healthy_hosts',
    )
  })

  it('recovers on its own once the replacement tasks are healthy again', () => {
    blastEveryTask()
    expect(advanceUntil(() => board().healthyHostCount.state === 'ALARM', 5 * 60_000)).toBe(true)

    expect(advanceUntil(() => board().healthyHostCount.state === 'OK', 10 * 60_000)).toBe(true)
  })
})

describe('alarms the simulation has no metric for', () => {
  it('never fires them, instead of inventing a number', () => {
    blastEveryTask()
    advance(20 * 60_000)

    const unmodelled = OBSERVABILITY_ALARMS.filter((alarm) => !alarm.isModelled)

    expect(unmodelled.every((alarm) => board()[alarm.key].state === 'INSUFFICIENT_DATA')).toBe(true)
  })
})
