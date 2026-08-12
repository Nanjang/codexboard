import { describe, expect, it } from 'vitest'
import { formatPostListDateTime } from '../src/views/format'

describe('게시글 목록 시간 표시', () => {
  const now = Date.UTC(2026, 7, 12, 12, 0, 0)

  it('하루가 지나지 않았으면 경과 시간 단위만 표시한다', () => {
    expect(formatPostListDateTime(now - 11 * 60 * 60 * 1000, now)).toBe('11h')
    expect(formatPostListDateTime(now - 33 * 60 * 1000, now)).toBe('33m')
    expect(formatPostListDateTime(now - 50 * 1000, now)).toBe('50s')
  })

  it('하루 이상 지난 글은 월·일만 표시한다', () => {
    expect(formatPostListDateTime(Date.UTC(2026, 7, 10, 12, 0, 0), now)).toBe('08.10')
  })
})
