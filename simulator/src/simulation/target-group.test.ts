import { describe, expect, it } from 'vitest'
import { isRegisteredTarget, targetsForRequests } from './target-group'
import type { TaskStatus } from '../types/task-data'

const target = (id: string, status: TaskStatus) => ({ id, status })

describe('which targets the load balancer sends a request to', () => {
  it('uses the healthy ones and ignores everything else while any of them exists', () => {
    const selection = targetsForRequests([
      target('task-1', 'healthy'),
      target('task-2', 'registering'),
      target('task-3', 'draining'),
    ])

    expect(selection.targets.map((task) => task.id)).toEqual(['task-1'])
    expect(selection.isFailingOpen).toBe(false)
  })

  it('falls open onto the registered but unhealthy targets when no healthy one is left', () => {
    const selection = targetsForRequests([target('task-1', 'failed'), target('task-2', 'registering')])

    expect(selection.targets.map((task) => task.id)).toEqual(['task-2'])
    expect(selection.isFailingOpen).toBe(true)
  })

  it('never sends a new request to a target that is draining, which is what draining means', () => {
    const selection = targetsForRequests([target('task-1', 'draining')])

    expect(selection.targets).toEqual([])
    expect(selection.isFailingOpen).toBe(false)
  })

  it('has nowhere to send anything when every task died', () => {
    const selection = targetsForRequests([target('task-1', 'failed'), target('task-2', 'provisioning')])

    expect(selection.targets).toEqual([])
    expect(selection.isFailingOpen).toBe(false)
  })

  it('counts as registered the same statuses the target group counts, draining included', () => {
    const registered: TaskStatus[] = ['registering', 'healthy', 'draining']
    const absent: TaskStatus[] = ['provisioning', 'starting', 'failed']

    expect(registered.every(isRegisteredTarget)).toBe(true)
    expect(absent.some(isRegisteredTarget)).toBe(false)
  })
})
