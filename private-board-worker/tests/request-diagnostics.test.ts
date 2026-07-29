import { describe, expect, it, vi } from 'vitest'
import { RequestProcessError } from '../src/lib/request-diagnostics'

describe('요청 처리 진단', () => {
  it('완료 단계와 실패 단계 및 실제 런타임 사유를 순서대로 보존한다', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_250)
    const error = new RequestProcessError(
      [{ label: '1. 게시글 조회', value: '성공 · 게시글 3' }],
      '이미지 포함 HTML 정제',
      1_200,
      new TypeError('Invalid HTML handler'),
    )

    expect(error.diagnostics).toEqual([
      { label: '1. 게시글 조회', value: '성공 · 게시글 3' },
      { label: '2. 이미지 포함 HTML 정제', value: '실패 · 50ms 경과' },
      { label: '3. 상세 사유', value: 'TypeError: Invalid HTML handler' },
    ])
    vi.restoreAllMocks()
  })

  it('오류 메시지에 포함된 인증 정보 형태의 값은 마스킹한다', () => {
    const error = new RequestProcessError(
      [],
      'D1 게시글 저장',
      Date.now(),
      new Error('Bearer abc123 token=plain-secret cookie:session-value'),
    )

    const reason = error.diagnostics.at(-1)?.value
    expect(reason).toContain('Bearer [REDACTED]')
    expect(reason).toContain('token=[REDACTED]')
    expect(reason).toContain('cookie:[REDACTED]')
    expect(reason).not.toContain('abc123')
    expect(reason).not.toContain('plain-secret')
    expect(reason).not.toContain('session-value')
  })
})
