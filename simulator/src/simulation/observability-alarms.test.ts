import { describe, expect, it } from 'vitest'
import {
  aggregate,
  alarmCondition,
  alarmName,
  createAlarmRuntime,
  OBSERVABILITY_ALARMS,
  recordSample,
  type AlarmDefinition,
  type AlarmRuntime,
} from './observability-alarms'

function definition(overrides: Partial<AlarmDefinition> = {}): AlarmDefinition {
  return {
    key: 'healthyHostCount',
    terraformAddress: 'aws_cloudwatch_metric_alarm.test',
    metricName: 'HealthyHostCount',
    namespace: 'AWS/ApplicationELB',
    statistic: 'Minimum',
    periodMs: 60_000,
    evaluationPeriods: 2,
    threshold: 2,
    comparisonOperator: 'LessThanThreshold',
    treatMissingData: 'notBreaching',
    isModelled: true,
    ...overrides,
  }
}

function feed(alarm: AlarmDefinition, samples: number[], stepMs = alarm.periodMs): AlarmRuntime {
  let runtime = createAlarmRuntime(0)
  samples.forEach((sample, index) => {
    runtime = recordSample(runtime, alarm, sample, index * stepMs)
  })

  return runtime
}

describe('what the simulator reads off the terraform', () => {
  it('carries all nine alarms of the observability module', () => {
    expect(OBSERVABILITY_ALARMS).toHaveLength(9)
  })

  it('gives every alarm the terraform address it came from', () => {
    const addresses = OBSERVABILITY_ALARMS.map((alarm) => alarm.terraformAddress)

    expect(new Set(addresses).size).toBe(addresses.length)
    expect(addresses.every((address) => address.startsWith('aws_cloudwatch_metric_alarm.'))).toBe(true)
  })

  it('is honest about which metrics the simulation actually produces', () => {
    const modelled = OBSERVABILITY_ALARMS.filter((alarm) => alarm.isModelled).map((alarm) => alarm.key)

    expect(modelled).toEqual([
      'healthyHostCount',
      'errorRatePercent',
      'targetResponseTimeP99Seconds',
      'runningTaskCount',
    ])
  })
})

describe('what the canvas prints for each alarm', () => {
  it('names the alarm the way the terraform resource is named', () => {
    const names = OBSERVABILITY_ALARMS.map(alarmName)

    expect(names).toContain('no_healthy_hosts')
    expect(names.every((name) => !name.includes('.'))).toBe(true)
  })

  it('spells out the threshold and how long it has to hold', () => {
    const noHealthyHosts = OBSERVABILITY_ALARMS.find((alarm) => alarm.key === 'healthyHostCount')

    expect(alarmCondition(noHealthyHosts!)).toBe('< 2 · 2×1m')
  })

  it('uses the greater-than symbol for the alarms that watch a ceiling', () => {
    const latency = OBSERVABILITY_ALARMS.find((alarm) => alarm.key === 'targetResponseTimeP99Seconds')

    expect(alarmCondition(latency!)).toBe('> 5 · 3×5m')
  })
})

describe('a period is closed with its own statistic', () => {
  it('takes the minimum for HealthyHostCount, not the average', () => {
    expect(aggregate([3, 1, 3], 'Minimum')).toBe(1)
  })

  it('takes the maximum for UnHealthyHostCount', () => {
    expect(aggregate([0, 2, 0], 'Maximum')).toBe(2)
  })

  it('sums the log error lines instead of averaging them', () => {
    expect(aggregate([4, 4, 4], 'Sum')).toBe(12)
  })

  it('falls back to the average for everything else', () => {
    expect(aggregate([1, 2, 3], 'Average')).toBe(2)
  })
})

describe('an alarm needs every evaluation period to breach', () => {
  it('stays OK while only the latest period is below the threshold', () => {
    const alarm = definition()

    expect(feed(alarm, [2, 2, 1]).state).toBe('OK')
  })

  it('fires once the breach has lasted the full two periods', () => {
    const alarm = definition()

    expect(feed(alarm, [2, 1, 1, 1]).state).toBe('ALARM')
  })

  it('takes three periods for the p99 latency alarm, matching evaluation_periods = 3', () => {
    const latency = definition({
      statistic: 'Average',
      threshold: 5,
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 3,
      periodMs: 300_000,
    })

    expect(feed(latency, [9, 9, 9]).state).toBe('OK')
    expect(feed(latency, [9, 9, 9, 9]).state).toBe('ALARM')
  })

  it('clears back to OK once a healthy period has actually closed', () => {
    const alarm = definition()
    const firing = feed(alarm, [1, 1, 1, 1])
    const settling = recordSample(firing, alarm, 5, 4 * alarm.periodMs)
    const recovered = recordSample(settling, alarm, 5, 5 * alarm.periodMs)

    expect(firing.state).toBe('ALARM')
    expect(settling.state).toBe('ALARM')
    expect(recovered.state).toBe('OK')
  })
})

describe('missing data is treated the way the terraform asks', () => {
  it('starts at INSUFFICIENT_DATA before any period has closed', () => {
    expect(createAlarmRuntime(0).state).toBe('INSUFFICIENT_DATA')
  })

  it('does not fire on a single breaching period when missing data is notBreaching', () => {
    const alarm = definition()

    expect(feed(alarm, [1, 1]).state).toBe('OK')
  })

  it('fires with one breaching period when missing data is breaching, as running_tasks_low does', () => {
    const runningTasks = definition({
      key: 'runningTaskCount',
      treatMissingData: 'breaching',
      evaluationPeriods: 3,
      statistic: 'Average',
    })

    expect(feed(runningTasks, [1, 1]).state).toBe('ALARM')
  })
})

describe('the moment an alarm changed state', () => {
  it('records when it started firing, so the canvas can time the animation', () => {
    const alarm = definition()
    const firing = feed(alarm, [2, 1, 1, 1])

    expect(firing.state).toBe('ALARM')
    expect(firing.enteredStateAt).toBe(3 * alarm.periodMs)
  })

  it('leaves the timestamp alone while the state holds', () => {
    const alarm = definition()
    const firing = feed(alarm, [2, 1, 1, 1])
    const stillFiring = recordSample(firing, alarm, 1, 4 * alarm.periodMs)

    expect(stillFiring.enteredStateAt).toBe(firing.enteredStateAt)
  })
})

describe('samples inside a period', () => {
  it('collapses many samples into one datapoint rather than counting each one', () => {
    const alarm = definition()
    const runtime = feed(alarm, [3, 3, 3, 3, 3, 1], alarm.periodMs / 5)

    expect(runtime.closedPeriods).toHaveLength(1)
  })

  it('lets one bad sample decide a Minimum period', () => {
    const alarm = definition()
    let runtime = createAlarmRuntime(0)
    for (const [index, sample] of [3, 3, 1, 3, 3, 3].entries()) {
      runtime = recordSample(runtime, alarm, sample, index * (alarm.periodMs / 5))
    }

    expect(runtime.closedPeriods).toEqual([1])
  })
})
