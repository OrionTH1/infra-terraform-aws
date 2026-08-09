import { describe, expect, it } from 'vitest'
import { splitAtTheDoor } from './traffic-distribution'

describe('a group whose addresses are not all rate limited', () => {
  it('sends the allowed share on and turns the rest away, from the same source', () => {
    expect(splitAtTheDoor(3600, 1200, false)).toEqual({ delivered: 1200, turnedAway: 2400 })
  })

  it('turns everything away once every address is blocked', () => {
    expect(splitAtTheDoor(2400, 0, false)).toEqual({ delivered: 0, turnedAway: 2400 })
  })

  it('lets everything through when nothing is blocked', () => {
    expect(splitAtTheDoor(1200, 1200, false)).toEqual({ delivered: 1200, turnedAway: 0 })
  })

  it('turns everything away only when no target is reachable at all, whatever the rate limiter says', () => {
    expect(splitAtTheDoor(3600, 1200, true)).toEqual({ delivered: 0, turnedAway: 3600 })
  })

  it('never reports more delivered than was sent', () => {
    expect(splitAtTheDoor(600, 5000, false)).toEqual({ delivered: 600, turnedAway: 0 })
  })

  it('has nothing to split while the source is silent', () => {
    expect(splitAtTheDoor(0, 0, false)).toEqual({ delivered: 0, turnedAway: 0 })
  })
})
