import { recordVisitor } from './visitor-stats'
import type { AppContext } from '../types'

export const VISITOR_PIXEL_PATH = '/visitor.png'

const TRANSPARENT_PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00,
  0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
])

export function isVisitorPixelPath(path: string): boolean {
  return path === VISITOR_PIXEL_PATH
}

export function visitorPixelResponse(): Response {
  return new Response(TRANSPARENT_PNG_BYTES.slice(), {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Content-Length': String(TRANSPARENT_PNG_BYTES.byteLength),
      'Content-Type': 'image/png',
      Pragma: 'no-cache',
    },
  })
}

export function queueVisitorPixelVisit(c: AppContext): void {
  const visit = recordVisitor(
    c.env.DB,
    c.req.raw,
    c.env.SESSION_SECRET,
    c.get('auth')?.user.id ?? null,
    200,
  ).catch((error: unknown) => {
    console.error('Visitor pixel tracking failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
      path: c.req.path,
    })
  })

  c.executionCtx.waitUntil(visit)
}
