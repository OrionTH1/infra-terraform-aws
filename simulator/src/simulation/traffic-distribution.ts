export function distributeRoundRobin(totalRequests: number, targetIds: string[]): Map<string, number> {
  const shares = new Map<string, number>()
  if (targetIds.length === 0) return shares

  const base = Math.floor(totalRequests / targetIds.length)
  const remainder = totalRequests % targetIds.length
  targetIds.forEach((id, index) => shares.set(id, base + (index < remainder ? 1 : 0)))

  return shares
}

export function splitReadWrite(totalRequests: number, readFraction: number): { reads: number; writes: number } {
  const reads = Math.round(totalRequests * readFraction)
  return { reads, writes: totalRequests - reads }
}

export interface UserTrafficSplit {
  delivered: number
  turnedAway: number
}

export function splitAtTheDoor(
  requestsPerMinute: number,
  deliveredPerMinute: number,
  hasNoReachableTargets: boolean,
): UserTrafficSplit {
  const delivered = hasNoReachableTargets ? 0 : Math.min(deliveredPerMinute, requestsPerMinute)

  return { delivered, turnedAway: Math.max(0, requestsPerMinute - delivered) }
}
