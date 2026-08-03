import { describe, expect, it } from 'vitest'
import {
  moveToPreviousPageOrder,
  personalBookmarkIcon,
  PERSONAL_BOOKMARKS_PER_PAGE,
} from '../src/lib/personal-bookmarks'
import { ValidationError } from '../src/lib/validation'

describe('개인 북마크', () => {
  it('앞 페이지 이동 시 이동 항목이 이전 페이지 마지막이 되고 기존 마지막 항목이 밀려난다', () => {
    const ids = Array.from({ length: PERSONAL_BOOKMARKS_PER_PAGE * 2 }, (_, index) => index + 1)
    const reordered = moveToPreviousPageOrder(ids, 150)

    expect(reordered).toHaveLength(200)
    expect(reordered[98]).toBe(99)
    expect(reordered[99]).toBe(150)
    expect(reordered[100]).toBe(100)
    expect(new Set(reordered).size).toBe(200)
  })

  it('현재 페이지에 속하지 않은 항목은 앞 페이지로 보내지 않는다', () => {
    const ids = Array.from({ length: 150 }, (_, index) => index + 1)
    expect(() => moveToPreviousPageOrder(ids, 50)).toThrow(
      '이 항목은 현재 페이지에서 앞 페이지로 이동할 수 없습니다.',
    )
  })

  it('업로드 아이콘 형식과 128KiB 제한을 검증한다', async () => {
    const icon = new File([new Uint8Array([1, 2, 3])], 'icon.png', { type: 'image/png' })
    await expect(personalBookmarkIcon(icon, true)).resolves.toMatchObject({
      contentType: 'image/png',
    })

    const invalid = new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' })
    await expect(personalBookmarkIcon(invalid, true)).rejects.toBeInstanceOf(ValidationError)

    const tooLarge = new File(
      [new Uint8Array(128 * 1024 + 1)],
      'large.png',
      { type: 'image/png' },
    )
    await expect(personalBookmarkIcon(tooLarge, true)).rejects.toBeInstanceOf(ValidationError)
  })
})
