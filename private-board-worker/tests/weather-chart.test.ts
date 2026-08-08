import { describe, expect, it } from 'vitest'
import { weatherBadgeCollisionCandidates, weatherChartYBounds } from '../src/shared/weather-chart'

describe('weatherChartYBounds', () => {
  it('keeps an additional five-degree tick above the previous chart range', () => {
    expect(weatherChartYBounds(-12.7, 39.4)).toEqual({ min: -20, max: 50 })
  })
})

describe('weatherBadgeCollisionCandidates', () => {
  it('checks the exact top boundary before moving a maximum badge below the graph', () => {
    const candidates = weatherBadgeCollisionCandidates(57.26, 50, 394, -1)

    expect(candidates.slice(0, 2)).toEqual([57.26, 50])
  })

  it('includes the exact bottom boundary before searching in the opposite direction', () => {
    const candidates = weatherBadgeCollisionCandidates(149.25, 50, 394, 1)

    expect(candidates.indexOf(394)).toBeLessThan(candidates.indexOf(141.25))
  })

  it('keeps collision avoidance within the endpoint attachment distance', () => {
    const candidates = weatherBadgeCollisionCandidates(149.25, 50, 394, 1, 30)

    expect(candidates.every((candidate) => Math.abs(candidate - 149.25) <= 30)).toBe(true)
    expect(candidates).not.toContain(181.25)
  })
})
