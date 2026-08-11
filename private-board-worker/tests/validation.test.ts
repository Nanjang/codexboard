import { describe, expect, it } from 'vitest'
import {
  boardSlug,
  bookmarkUrl,
  isNumericMemoValue,
  memoLinkUrl,
  multiline,
  nickname,
  optionalSingleLine,
  positiveInteger,
  rssUrl,
  singleLine,
  ticketCreationRequestId,
  ticketChecklistEnabled,
  ticketChecklistItems,
  ticketExternalLinks,
  ticketLane,
  ticketTagColor,
  ticketTagTextColor,
  ticketTagIds,
  optionalHexColor,
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

  it('태그 색상과 복수 태그 ID를 제한한다', () => {
    expect(ticketTagColor('blue')).toBe('blue')
    expect(ticketTagColor('yellow')).toBe('yellow')
    expect(ticketTagColor('gray-dark')).toBe('gray-dark')
    expect(ticketTagTextColor('black')).toBe('black')
    expect(optionalHexColor('FFFFFF', '배경색')).toBe('#FFFFFF')
    expect(optionalHexColor('#f6e7a6', '배경색')).toBe('#F6E7A6')
    expect(optionalHexColor('', '배경색')).toBeNull()
    expect(ticketTagIds(['2', '7'])).toEqual([2, 7])
    expect(() => ticketTagColor('rainbow')).toThrow(ValidationError)
    expect(() => ticketTagTextColor('yellow')).toThrow(ValidationError)
    expect(() => optionalHexColor('FFFFF', '배경색')).toThrow(ValidationError)
    expect(() => ticketTagIds(['2', '2'])).toThrow(ValidationError)
    expect(() => ticketTagIds(Array.from({ length: 11 }, (_, index) => String(index + 1)))).toThrow(ValidationError)
  })

  it('티켓 생성 요청값은 UUID v4만 허용한다', () => {
    expect(ticketCreationRequestId('F47AC10B-58CC-4372-A567-0E02B2C3D479')).toBe(
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    )
    expect(() => ticketCreationRequestId('reused-key')).toThrow(ValidationError)
    expect(() => ticketCreationRequestId(null)).toThrow(ValidationError)
  })

  it('체크리스트 활성 상태와 항목 완료 상태를 검증한다', () => {
    const form = new FormData()
    form.append('checklist_enabled', 'on')
    form.append('checklist_item_key', '12')
    form.append('checklist_item_title', '문서 확인')
    form.append('checklist_item_completed', '12')
    form.append('checklist_item_key', 'new-0')
    form.append('checklist_item_title', '배포 확인')

    expect(ticketChecklistEnabled(form)).toBe(true)
    expect(ticketChecklistItems(form)).toEqual([
      { id: 12, title: '문서 확인', completed: true },
      { id: null, title: '배포 확인', completed: false },
    ])

    const invalid = new FormData()
    invalid.append('checklist_item_key', 'new-0')
    invalid.append('checklist_item_title', '항목')
    invalid.append('checklist_item_key', 'new-0')
    invalid.append('checklist_item_title', '중복')
    expect(() => ticketChecklistItems(invalid)).toThrow(ValidationError)
  })

  it('외부 문서 링크는 설명과 안전한 http 또는 https URL을 복수로 검증한다', () => {
    const form = new FormData()
    form.append('external_link_key', 'new-0')
    form.append('external_link_label', '기획 문서')
    form.append('external_link_url', 'https://docs.example.com/spec')
    form.append('external_link_key', '12')
    form.append('external_link_label', '릴리스 기록')
    form.append('external_link_url', 'http://example.com/releases')

    expect(ticketExternalLinks(form)).toEqual([
      { id: null, label: '기획 문서', url: 'https://docs.example.com/spec' },
      { id: 12, label: '릴리스 기록', url: 'http://example.com/releases' },
    ])

    const invalidProtocol = new FormData()
    invalidProtocol.append('external_link_key', 'new-0')
    invalidProtocol.append('external_link_label', '위험한 링크')
    invalidProtocol.append('external_link_url', 'javascript:alert(1)')
    expect(() => ticketExternalLinks(invalidProtocol)).toThrow(ValidationError)

    const incomplete = new FormData()
    incomplete.append('external_link_key', 'new-0')
    incomplete.append('external_link_label', '설명만')
    incomplete.append('external_link_url', '')
    expect(() => ticketExternalLinks(incomplete)).toThrow(ValidationError)
  })

  it('북마크는 안전한 http 또는 https URL만 허용한다', () => {
    expect(bookmarkUrl('https://example.com/docs')).toBe('https://example.com/docs')
    expect(() => bookmarkUrl('javascript:alert(1)')).toThrow(ValidationError)
    expect(() => bookmarkUrl('https://user:password@example.com/')).toThrow(ValidationError)
  })

  it('링크 타입 메모는 안전한 http 또는 https URL만 허용한다', () => {
    expect(memoLinkUrl('https://example.com/direct-link')).toBe('https://example.com/direct-link')
    expect(() => memoLinkUrl('javascript:alert(1)')).toThrow(ValidationError)
    expect(() => memoLinkUrl('/relative/path')).toThrow(ValidationError)
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
