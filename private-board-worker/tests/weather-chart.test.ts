import { describe, expect, it } from 'vitest'
import { weatherBadgeCollisionCandidates } from '../src/shared/weather-chart'

describe('weatherBadgeCollisionCandidates', () => {
  it('checks the exact top boundary before moving a maximum badge below the graph', () => {
    const candidates = weatherBadgeCollisionCandidates(57.26, 50, 394, -1)

    expect(candidates.slice(0, 2)).toEqual([57.26, 50])
  })

  it('includes the exact bottom boundary before searching in the opposite direction', () => {
    const candidates = weatherBadgeCollisionCandidates(149.25, 50, 394, 1)

    expect(candidates.indexOf(394)).toBeLessThan(candidates.indexOf(141.25))
  })
})
