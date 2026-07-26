import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bookmarkIconFallback,
  bookmarkIconUrl,
  fetchBookmarkIcon,
  storedBookmarkIcon,
} from '../src/lib/bookmark-icon'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('북마크 사이트 아이콘', () => {
  it('북마크 호스트의 HTTPS favicon 주소를 만든다', () => {
    expect(bookmarkIconUrl('http://example.com/docs?page=1')).toBe(
      'https://example.com/favicon.ico',
    )
    expect(() => bookmarkIconUrl('https://127.0.0.1/docs')).toThrow()
  })

  it('허용된 이미지 응답만 크기 제한 안에서 전달한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(new Uint8Array([0, 1, 2, 3]), {
          headers: { 'Content-Type': 'image/png' },
        }),
      ),
    )

    const icon = await fetchBookmarkIcon('https://example.com/docs')

    expect(icon).not.toBeNull()
    const response = storedBookmarkIcon(Array.from(icon?.bytes ?? []), icon?.contentType ?? '')
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toContain('private')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0, 1, 2, 3]))
  })

  it('아이콘이 없거나 이미지가 아니면 내부 기본 아이콘을 반환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>not an icon</html>', { status: 200 })),
    )

    const icon = await fetchBookmarkIcon('https://example.com/docs')
    const fallback = bookmarkIconFallback()

    expect(icon).toBeNull()
    expect(fallback.headers.get('content-type')).toContain('image/svg+xml')
  })
})
