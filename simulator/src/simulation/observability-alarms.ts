export type AlarmState = 'OK' | 'ALARM' | 'INSUFFICIENT_DATA'

export type ComparisonOperator = 'GreaterThanThreshold' | 'LessThanThreshold'

export type MissingDataTreatment = 'notBreaching' | 'breaching'

export type AlarmMetricKey =
  | 'unHealthyHostCount'
  | 'healthyHostCount'
  | 'errorRatePercent'
  | 'targetResponseTimeP99Seconds'
  | 'cpuUtilizationPercent'
  | 'memoryUtilizationPercent'
  | 'runningTaskCount'
  | 'databaseConnections'
  | 'appErrorLines'

export interface AlarmDefinition {
  key: AlarmMetricKey
  terraformAddress: string
  metricName: string
  namespace: string
  statistic: string
  periodMs: number
  evaluationPeriods: number
  threshold: number
  comparisonOperator: ComparisonOperator
  treatMissingData: MissingDataTreatment
  isModelled: boolean
}

const SECOND_MS = 1_000

export const OBSERVABILITY_ALARMS: AlarmDefinition[] = [
  {
    key: 'unHealthyHostCount',
    terraformAddress: 'aws_cloudwatch_metric_alarm.unhealthy_hosts',
    metricName: 'UnHealthyHostCount',
    namespace: 'AWS/ApplicationELB',
    statistic: 'Maximum',
    periodMs: 60 * SECOND_MS,
    evaluationPeriods: 2,
    threshold: 0,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
    isModelled: false,
  },
  {
    key: 'healthyHostCount',
    terraformAddress: 'aws_cloudwatch_metric_alarm.no_healthy_hosts',
    metricName: 'HealthyHostCount',
    namespace: 'AWS/ApplicationELB',
    statistic: 'Minimum',
    periodMs: 60 * SECOND_MS,
    evaluationPeriods: 2,
    threshold: 2,
    comparisonOperator: 'LessThanThreshold',
    treatMissingData: 'notBreaching',
    isModelled: true,
  },
  {
    key: 'errorRatePercent',
    terraformAddress: 'aws_cloudwatch_metric_alarm.error_rate',
    metricName: '5xx error rate (%)',
    namespace: 'AWS/ApplicationELB',
    statistic: 'Average',
    periodMs: 300 * SECOND_MS,
    evaluationPeriods: 2,
    threshold: 5,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
    isModelled: true,
  },
  {
    key: 'targetResponseTimeP99Seconds',
    terraformAddress: 'aws_cloudwatch_metric_alarm.latency_p99',
    metricName: 'TargetResponseTime',
    namespace: 'AWS/ApplicationELB',
    statistic: 'p99',
    periodMs: 300 * SECOND_MS,
    evaluationPeriods: 3,
    threshold: 5,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
    isModelled: true,
  },
  {
    key: 'cpuUtilizationPercent',
    terraformAddress: 'aws_cloudwatch_metric_alarm.cpu_high',
    metricName: 'CPUUtilization',
    namespace: 'AWS/ECS',
    statistic: 'Average',
    periodMs: 60 * SECOND_MS,
    evaluationPeriods: 5,
    threshold: 85,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
    isModelled: false,
  },
  {
    key: 'memoryUtilizationPercent',
    terraformAddress: 'aws_cloudwatch_metric_alarm.memory_high',
    metricName: 'MemoryUtilization',
    namespace: 'AWS/ECS',
    statistic: 'Average',
    periodMs: 60 * SECOND_MS,
    evaluationPeriods: 5,
    threshold: 80,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
    isModelled: false,
  },
  {
    key: 'runningTaskCount',
    terraformAddress: 'aws_cloudwatch_metric_alarm.running_tasks_low',
    metricName: 'RunningTaskCount',
    namespace: 'ECS/ContainerInsights',
    statistic: 'Average',
    periodMs: 60 * SECOND_MS,
    evaluationPeriods: 3,
    threshold: 2,
    comparisonOperator: 'LessThanThreshold',
    treatMissingData: 'breaching',
    isModelled: true,
  },
  {
    key: 'databaseConnections',
    terraformAddress: 'aws_cloudwatch_metric_alarm.db_connections_high',
    metricName: 'DatabaseConnections',
    namespace: 'AWS/RDS',
    statistic: 'Maximum',
    periodMs: 300 * SECOND_MS,
    evaluationPeriods: 2,
    threshold: 50,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
    isModelled: false,
  },
  {
    key: 'appErrorLines',
    terraformAddress: 'aws_cloudwatch_metric_alarm.app_errors',
    metricName: 'ApplicationErrorCount',
    namespace: 'ecs-portfolio/dev',
    statistic: 'Sum',
    periodMs: 300 * SECOND_MS,
    evaluationPeriods: 1,
    threshold: 10,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
    isModelled: false,
  },
]

export interface MetricPeriod {
  startedAt: number
  samples: number[]
}

export interface AlarmRuntime {
  state: AlarmState
  closedPeriods: number[]
  current: MetricPeriod | null
  enteredStateAt: number
}

export function createAlarmRuntime(now: number): AlarmRuntime {
  return { state: 'INSUFFICIENT_DATA', closedPeriods: [], current: null, enteredStateAt: now }
}

export function aggregate(samples: number[], statistic: string): number {
  if (statistic === 'Maximum') return Math.max(...samples)
  if (statistic === 'Minimum') return Math.min(...samples)
  if (statistic === 'Sum') return samples.reduce((total, sample) => total + sample, 0)

  return samples.reduce((total, sample) => total + sample, 0) / samples.length
}

export function breaches(datapoint: number, definition: AlarmDefinition): boolean {
  return definition.comparisonOperator === 'GreaterThanThreshold'
    ? datapoint > definition.threshold
    : datapoint < definition.threshold
}

function evaluate(runtime: AlarmRuntime, definition: AlarmDefinition): AlarmState {
  const { evaluationPeriods, treatMissingData } = definition
  const available = runtime.closedPeriods.slice(-evaluationPeriods)
  const missing = evaluationPeriods - available.length

  if (missing > 0 && treatMissingData === 'notBreaching') return available.length === 0 ? 'INSUFFICIENT_DATA' : 'OK'
  if (missing > 0 && treatMissingData === 'breaching' && runtime.closedPeriods.length === 0) return 'INSUFFICIENT_DATA'

  const breaching = [
    ...Array.from({ length: Math.max(0, missing) }, () => treatMissingData === 'breaching'),
    ...available.map((datapoint) => breaches(datapoint, definition)),
  ]

  return breaching.every(Boolean) ? 'ALARM' : 'OK'
}

export function recordSample(
  runtime: AlarmRuntime,
  definition: AlarmDefinition,
  sample: number,
  now: number,
): AlarmRuntime {
  const current = runtime.current ?? { startedAt: now, samples: [] }
  const isPeriodOver = now - current.startedAt >= definition.periodMs

  if (!isPeriodOver) {
    return { ...runtime, current: { ...current, samples: [...current.samples, sample] } }
  }

  const closed = current.samples.length > 0 ? aggregate(current.samples, definition.statistic) : null
  const closedPeriods =
    closed === null
      ? runtime.closedPeriods
      : [...runtime.closedPeriods, closed].slice(-definition.evaluationPeriods)

  const rolled: AlarmRuntime = {
    ...runtime,
    closedPeriods,
    current: { startedAt: now, samples: [sample] },
  }

  const state = evaluate(rolled, definition)

  return state === runtime.state ? rolled : { ...rolled, state, enteredStateAt: now }
}

export function isFiring(runtime: AlarmRuntime): boolean {
  return runtime.state === 'ALARM'
}

export type AlarmBoard = Record<AlarmMetricKey, AlarmRuntime>

export type AlarmSamples = Partial<Record<AlarmMetricKey, number>>

export function createAlarmBoard(now: number): AlarmBoard {
  return Object.fromEntries(
    OBSERVABILITY_ALARMS.map((alarm) => [alarm.key, createAlarmRuntime(now)]),
  ) as AlarmBoard
}

export function recordAlarmSamples(board: AlarmBoard, samples: AlarmSamples, now: number): AlarmBoard {
  let changed = false
  const next = { ...board }

  for (const alarm of OBSERVABILITY_ALARMS) {
    const sample = samples[alarm.key]
    if (sample === undefined) continue

    const advanced = recordSample(board[alarm.key], alarm, sample, now)
    if (advanced === board[alarm.key]) continue

    next[alarm.key] = advanced
    changed = true
  }

  return changed ? next : board
}

export function firingAlarms(board: AlarmBoard): AlarmDefinition[] {
  return OBSERVABILITY_ALARMS.filter((alarm) => isFiring(board[alarm.key]))
}

export function alarmName(definition: AlarmDefinition): string {
  return definition.terraformAddress.split('.')[1]
}

const COMPARISON_SYMBOL: Record<ComparisonOperator, string> = {
  GreaterThanThreshold: '>',
  LessThanThreshold: '<',
}

export function alarmCondition(definition: AlarmDefinition): string {
  const symbol = COMPARISON_SYMBOL[definition.comparisonOperator]
  const periodMinutes = definition.periodMs / 60_000

  return `${symbol} ${definition.threshold} · ${definition.evaluationPeriods}×${periodMinutes}m`
}
