import { describe, expect, it } from 'vitest'
import {
  isVisitorPixelPath,
  visitorPixelResponse,
  VISITOR_PIXEL_PATH,
} from '../src/lib/visitor-pixel'

describe('방문자 PNG 픽셀', () => {
  it('외부 페이지에 삽입할 수 있는 1×1 투명 PNG를 반환한다', async () => {
    const response = visitorPixelResponse()
    const bytes = new Uint8Array(await response.arrayBuffer())

    expect(VISITOR_PIXEL_PATH).toBe('/visitor.png')
    expect(isVisitorPixelPath('/visitor.png')).toBe(true)
    expect(isVisitorPixelPath('/visitor.gif')).toBe(false)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Content-Length')).toBe(String(bytes.byteLength))
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(bytes.byteLength).toBe(67)
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  })
})
