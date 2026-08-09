import type { TaskStatus } from '../types/task-data'

const REGISTERED_STATUSES: TaskStatus[] = ['registering', 'healthy', 'draining']

export function isRegisteredTarget(status: TaskStatus): boolean {
  return REGISTERED_STATUSES.includes(status)
}

export interface TargetSelection<T> {
  targets: T[]
  isFailingOpen: boolean
}

export function targetsForRequests<T extends { status: TaskStatus }>(tasks: T[]): TargetSelection<T> {
  const healthy = tasks.filter((task) => task.status === 'healthy')
  if (healthy.length > 0) return { targets: healthy, isFailingOpen: false }

  const registered = tasks.filter((task) => task.status === 'registering')

  return { targets: registered, isFailingOpen: registered.length > 0 }
}
