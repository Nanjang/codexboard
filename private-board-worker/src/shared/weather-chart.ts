export function weatherBadgeCollisionCandidates(
  preferred: number,
  minCenter: number,
  maxCenter: number,
  direction: -1 | 1,
): number[] {
  const candidates: number[] = []
  const addCandidates = (start: number, end: number, step: number): void => {
    for (let candidate = start; step < 0 ? candidate >= end : candidate <= end; candidate += step) {
      candidates.push(candidate)
    }
  }
  const preferredBoundary = direction < 0 ? minCenter : maxCenter
  const fallbackBoundary = direction < 0 ? maxCenter : minCenter

  addCandidates(preferred, preferredBoundary, direction * 8)
  candidates.push(preferredBoundary)
  addCandidates(preferred, fallbackBoundary, direction * -8)
  candidates.push(fallbackBoundary)
  return candidates
}
