import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bookmarkIconFallback,
  bookmarkIconUrl,
  fetchBookmarkIcon,
  fetchBookmarkIconUrl,
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

  it('favicon.ico가 없으면 페이지에 선언된 표준 아이콘을 가져온다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          `<html><head>
            <link rel="apple-touch-icon" sizes="180x180" href="/img/apple-icon.png">
            <link rel="icon" type="image/png" sizes="96x96" href="/img/favicon-96x96.png">
            <link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32x32.png">
          </head></html>`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { 'Content-Type': 'image/png' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const icon = await fetchBookmarkIcon('https://littlecandle.co.kr/')

    expect(icon).toEqual({
      bytes: new Uint8Array([137, 80, 78, 71]),
      contentType: 'image/png',
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://littlecandle.co.kr/favicon.ico')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://littlecandle.co.kr/')
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'https://littlecandle.co.kr/img/favicon-32x32.png',
    )
  })

  it('직접 입력한 HTTPS 아이콘 URL을 그대로 가져온다', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'image/webp' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const icon = await fetchBookmarkIconUrl('https://cdn.example.com/bookmark.webp')

    expect(icon).toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/webp',
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://cdn.example.com/bookmark.webp')
  })

  it('기본 아이콘은 선택한 색상으로 같은 모양을 렌더링한다', async () => {
    const green = await bookmarkIconFallback('green').text()
    const rose = await bookmarkIconFallback('rose').text()

    expect(green).toContain('d="M10 18 18 10m-6 0h6v6"')
    expect(rose).toContain('d="M10 18 18 10m-6 0h6v6"')
    expect(green).toContain('#157347')
    expect(rose).toContain('#b4235a')
  })
})
