const WEATHER_CHART_TICK_SIZE = 5
const WEATHER_CHART_LOWER_PADDING = 5
const WEATHER_CHART_UPPER_PADDING = 10

export function weatherChartYBounds(dataMin: number, dataMax: number): { min: number; max: number } {
  let min = Math.floor((dataMin - WEATHER_CHART_LOWER_PADDING) / WEATHER_CHART_TICK_SIZE) * WEATHER_CHART_TICK_SIZE
  let max = Math.ceil((dataMax + WEATHER_CHART_UPPER_PADDING) / WEATHER_CHART_TICK_SIZE) * WEATHER_CHART_TICK_SIZE
  if (max - min < 20) {
    const center = (max + min) / 2
    min = Math.floor((center - 10) / WEATHER_CHART_TICK_SIZE) * WEATHER_CHART_TICK_SIZE
    max = min + 20
  }
  return { min, max }
}

export function weatherBadgeCollisionCandidates(
  preferred: number,
  minCenter: number,
  maxCenter: number,
  direction: -1 | 1,
  maxDisplacement = Number.POSITIVE_INFINITY,
): number[] {
  const candidates: number[] = []
  const addCandidates = (start: number, end: number, step: number): void => {
    for (let candidate = start; step < 0 ? candidate >= end : candidate <= end; candidate += step) {
      if (Math.abs(candidate - preferred) > maxDisplacement) break
      candidates.push(candidate)
    }
  }
  const preferredBoundary = direction < 0 ? minCenter : maxCenter
  const fallbackBoundary = direction < 0 ? maxCenter : minCenter

  addCandidates(preferred, preferredBoundary, direction * 8)
  if (Math.abs(preferredBoundary - preferred) <= maxDisplacement) candidates.push(preferredBoundary)
  addCandidates(preferred, fallbackBoundary, direction * -8)
  if (Math.abs(fallbackBoundary - preferred) <= maxDisplacement) candidates.push(fallbackBoundary)
  return candidates
}
