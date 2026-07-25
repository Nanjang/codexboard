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

export function formatDateTime(timestamp: number): string {
  return dateTimeFormatter.format(new Date(timestamp))
}

export function laneLabel(lane: TicketLane): string {
  switch (lane) {
    case 'todo':
      return '할 일'
    case 'doing':
      return '진행 중'
    case 'done':
      return '완료'
  }
}
