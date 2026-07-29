import { describe, expect, it } from 'vitest'
import {
  bookmarkIconColor,
  bookmarkIconMode,
  manualBookmarkIconUrl,
  ValidationError,
} from '../src/lib/validation'

describe('북마크 아이콘 선택 검증', () => {
  it('기본 아이콘과 직접 URL 방식을 구분한다', () => {
    expect(bookmarkIconMode('default')).toBe('default')
    expect(bookmarkIconMode('url')).toBe('url')
    expect(() => bookmarkIconMode('auto')).toThrow(ValidationError)
  })

  it('지원하는 기본 아이콘 5색만 허용한다', () => {
    expect(['green', 'blue', 'purple', 'orange', 'rose'].map(bookmarkIconColor)).toEqual([
      'green',
      'blue',
      'purple',
      'orange',
      'rose',
    ])
    expect(() => bookmarkIconColor('black')).toThrow(ValidationError)
  })

  it('직접 입력한 아이콘은 공개 HTTPS URL만 허용한다', () => {
    expect(manualBookmarkIconUrl('https://cdn.example.com/icon.png')).toBe(
      'https://cdn.example.com/icon.png',
    )
    expect(() => manualBookmarkIconUrl('http://example.com/icon.png')).toThrow(ValidationError)
    expect(() => manualBookmarkIconUrl('https://127.0.0.1/icon.png')).toThrow(ValidationError)
  })
})
