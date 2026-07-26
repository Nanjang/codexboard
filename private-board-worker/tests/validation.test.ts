import { describe, expect, it } from 'vitest'
import {
  boardSlug,
  bookmarkUrl,
  isNumericMemoValue,
  multiline,
  nickname,
  optionalSingleLine,
  positiveInteger,
  rssUrl,
  singleLine,
  ticketLane,
  validateMemoUrlTemplate,
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
    expect(boardSlug('development')).toBe('development')
    expect(boardSlug('news')).toBe('news')
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

  it('RSS는 공개 HTTPS 주소만 허용한다', () => {
    expect(rssUrl('https://example.com/feed.xml')).toBe('https://example.com/feed.xml')
    expect(() => rssUrl('http://example.com/feed.xml')).toThrow(ValidationError)
    expect(() => rssUrl('https://127.0.0.1/feed.xml')).toThrow(ValidationError)
    expect(() => rssUrl('https://service.internal/feed.xml')).toThrow(ValidationError)
  })

  it('메모 값의 숫자 여부를 부호와 소수까지 일관되게 판별한다', () => {
    expect(isNumericMemoValue('00123')).toBe(true)
    expect(isNumericMemoValue('-12.5')).toBe(true)
    expect(isNumericMemoValue('12A')).toBe(false)
    expect(isNumericMemoValue('검색어')).toBe(false)
  })

  it('URL 일부는 빈 값을 허용하고 줄바꿈을 정규화한다', () => {
    expect(optionalSingleLine(null, '앞 URL', 1000)).toBe('')
    expect(optionalSingleLine(' https://example.com/\r\nsearch/ ', '앞 URL', 1000)).toBe(
      'https://example.com/ search/',
    )
  })

  it('메모 URL 조합은 안전한 절대 http 또는 https 주소만 허용한다', () => {
    expect(() => validateMemoUrlTemplate('https://example.com/search?q=', '&from=memo', '문자')).not.toThrow()
    expect(() => validateMemoUrlTemplate('', '', '문자')).not.toThrow()
    expect(() => validateMemoUrlTemplate('javascript:alert(', ')', '문자')).toThrow(ValidationError)
    expect(() => validateMemoUrlTemplate('/relative/', '', '숫자')).toThrow(ValidationError)
  })
})
