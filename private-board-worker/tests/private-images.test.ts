import { describe, expect, it } from 'vitest'
import {
  escapePrivateImageLikeQuery,
  normalizePrivateImageSearchQuery,
} from '../src/lib/private-images'

describe('개인 이미지 검색', () => {
  it('검색어의 앞뒤 공백을 제거하고 길이를 제한한다', () => {
    expect(normalizePrivateImageSearchQuery('  스크린샷  ')).toBe('스크린샷')
    expect(normalizePrivateImageSearchQuery('x'.repeat(200))).toHaveLength(120)
    expect(normalizePrivateImageSearchQuery(null)).toBe('')
  })

  it('LIKE 와일드카드를 문자 그대로 검색하도록 이스케이프한다', () => {
    expect(escapePrivateImageLikeQuery('100%_done\\x')).toBe('100\\%\\_done\\\\x')
  })
})