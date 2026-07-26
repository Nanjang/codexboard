import { describe, expect, it } from 'vitest'
import {
  boardSlug,
  bookmarkUrl,
  multiline,
  nickname,
  positiveInteger,
  singleLine,
  ticketLane,
  ValidationError,
} from '../src/lib/validation'

describe('입력 검증', () => {
  it('제목의 줄바꿈과 앞뒤 공백을 정규화한다', () => {
    expect(singleLine('  첫 줄\r\n둘째 줄  ', '제목', 30)).toBe('첫 줄 둘째 줄')
  })

  it('본문은 일반 텍스트 줄바꿈을 보존한다', () => {
    expect(multiline('  한 줄\r\n두 줄  ', '본문', 30)).toBe('한 줄\n두 줄')
  })

  it('허용되지 않은 닉네임 문자를 거부한다', () => {
    expect(() => nickname('<script>')).toThrow(ValidationError)
    expect(nickname('홍 길동_01')).toBe('홍 길동_01')
  })

  it('양의 안전한 정수만 ID로 허용한다', () => {
    expect(positiveInteger('42')).toBe(42)
    expect(() => positiveInteger('0')).toThrow(ValidationError)
    expect(() => positiveInteger('1 OR 1=1')).toThrow(ValidationError)
  })

  it('고정된 게시판과 티켓 상태만 허용한다', () => {
    expect(boardSlug('free')).toBe('free')
    expect(boardSlug('inquiry')).toBe('inquiry')
    expect(ticketLane('doing')).toBe('doing')
    expect(() => boardSlug('admin')).toThrow(ValidationError)
    expect(() => ticketLane('archived')).toThrow(ValidationError)
  })

  it('북마크는 안전한 http 또는 https URL만 허용한다', () => {
    expect(bookmarkUrl('https://example.com/docs')).toBe('https://example.com/docs')
    expect(() => bookmarkUrl('javascript:alert(1)')).toThrow(ValidationError)
    expect(() => bookmarkUrl('https://user:password@example.com/')).toThrow(ValidationError)
  })
})
