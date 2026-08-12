import type { TicketLane } from '../types'

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const monthDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
})

export function formatDateTime(timestamp: number): string {
  return dateTimeFormatter.format(new Date(timestamp))
}

export function formatPostListDateTime(timestamp: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - timestamp)
  if (elapsed < 24 * 60 * 60 * 1000) {
    if (elapsed < 60 * 1000) return `${Math.floor(elapsed / 1000)}s`
    if (elapsed < 60 * 60 * 1000) return `${Math.floor(elapsed / (60 * 1000))}m`
    return `${Math.floor(elapsed / (60 * 60 * 1000))}h`
  }

  return monthDayFormatter.format(new Date(timestamp)).replace(/[-/]/u, '.')
}

export function laneLabel(lane: TicketLane): string {
  switch (lane) {
    case 'long-term':
      return '장기작업'
    case 'todo':
      return '할 일'
    case 'doing':
      return '진행 중'
    case 'done':
      return '완료'
    case 'preserved':
      return '보존작업'
  }
}
