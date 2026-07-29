import { HTTPException } from 'hono/http-exception'
import type { AppContext, AuthContext } from '../types'
import { sha256Hex, safeEqual } from './crypto'
import { getBaseUrl, secureCookies, turnstileEnabled, validateRuntimeConfig } from './env'
import { r2ImageOrigins } from './r2'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const GOOGLE_AUTHORIZATION_ORIGIN = 'https://accounts.google.com'

export type SameOriginFailureStage = 'request-url' | 'origin-header' | 'referer-header' | 'referer-invalid'

export interface SameOriginFailureDetails {
  stage: SameOriginFailureStage
  expectedOrigin: string
  requestOrigin: string
  originHeader: string | null
  refererOrigin: string | null
  method: string
  path: string
}

export class SameOriginError extends HTTPException {
  readonly details: SameOriginFailureDetails

  constructor(details: SameOriginFailureDetails, message = '허용되지 않은 요청 출처입니다.') {
    super(403, { message })
    this.name = 'SameOriginError'
    this.details = details
  }
}

export function isPublicPath(path: string): boolean {
  return (
    path === '/' ||
    path === '/login' ||
    path === '/privacy' ||
    path === '/terms' ||
    path === '/health' ||
    path === '/auth/google/start' ||
    path === '/auth/google/callback' ||
    path === '/devlogs' ||
    path === '/boards/development' ||
    /^\/devlogs\/u\/[^/]+(?:\/posts\/[1-9][0-9]*)?$/u.test(path) ||
    path.startsWith('/assets/')
  )
}

export function requireAuth(c: AppContext): AuthContext {
  const auth = c.get('auth')
  if (!auth) throw new HTTPException(401, { message: '로그인이 필요합니다.' })
  return auth
}

export function assertCsrf(c: AppContext, suppliedToken: string | null | undefined): void {
  const auth = requireAuth(c)
  if (!suppliedToken || !safeEqual(auth.csrfToken, suppliedToken)) {
    throw new HTTPException(403, { message: '요청 검증에 실패했습니다. 페이지를 새로고침하세요.' })
  }
}

export function assertSameOrigin(c: AppContext): void {
  const method = c.req.method.toUpperCase()
  if (!UNSAFE_METHODS.has(method)) return

  const expectedOrigin = getBaseUrl(c.env).origin
  const requestUrl = new URL(c.req.url)
  const requestOrigin = requestUrl.origin
  const originHeader = c.req.header('Origin') ?? null
  const referer = c.req.header('Referer')
  let refererOrigin: string | null = null

  if (!originHeader && referer) {
    try {
      refererOrigin = new URL(referer).origin
    } catch {
      throw new SameOriginError(
        {
          stage: 'referer-invalid',
          expectedOrigin,
          requestOrigin,
          originHeader,
          refererOrigin: null,
          method,
          path: requestUrl.pathname,
        },
        '요청 출처를 확인할 수 없습니다.',
      )
    }
  }

  const details = (stage: SameOriginFailureStage): SameOriginFailureDetails => ({
    stage,
    expectedOrigin,
    requestOrigin,
    originHeader,
    refererOrigin,
    method,
    path: requestUrl.pathname,
  })

  if (requestOrigin !== expectedOrigin) {
    throw new SameOriginError(details('request-url'))
  }

  if (originHeader && originHeader !== expectedOrigin) {
    throw new SameOriginError(details('origin-header'))
  }

  if (!originHeader && refererOrigin && refererOrigin !== expectedOrigin) {
    throw new SameOriginError(details('referer-header'))
  }
}

export async function enforceAuthRateLimit(c: AppContext): Promise<void> {
  const actor = [c.req.header('CF-Connecting-IP') ?? 'unknown', c.req.header('User-Agent') ?? 'unknown'].join('|')
  const key = await sha256Hex(`auth:${actor}`)
  const result = await c.env.AUTH_RATE_LIMITER.limit({ key })
  if (!result.success) {
    throw new HTTPException(429, { message: '로그인 요청이 너무 많습니다. 잠시 후 다시 시도하세요.' })
  }
}

export async function enforceWriteRateLimit(c: AppContext, bucket: string): Promise<void> {
  const auth = requireAuth(c)
  const result = await c.env.WRITE_RATE_LIMITER.limit({ key: `${auth.user.id}:${bucket}` })
  if (!result.success) {
    throw new HTTPException(429, { message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' })
  }
}

export function contentSecurityPolicy(
  hasTurnstile: boolean,
  imageOrigins: { apiOrigin: string; publicOrigin: string } | null = null,
): string {
  const imageSource = imageOrigins ? `img-src 'self' https: ${imageOrigins.publicOrigin}` : "img-src 'self' https:"
  const connectSources = ["'self'"]
  if (hasTurnstile) connectSources.push('https://challenges.cloudflare.com')
  if (imageOrigins) connectSources.push(imageOrigins.apiOrigin)

  return [
    "default-src 'self'",
    hasTurnstile ? "script-src 'self' https://challenges.cloudflare.com" : "script-src 'self'",
    "style-src 'self'",
    imageSource,
    "font-src 'self'",
    `connect-src ${connectSources.join(' ')}`,
    hasTurnstile ? 'frame-src https://challenges.cloudflare.com' : "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    `form-action 'self' ${GOOGLE_AUTHORIZATION_ORIGIN}`,
    "frame-ancestors 'none'",
    "manifest-src 'none'",
    "media-src 'none'",
  ].join('; ')
}

export async function securityMiddleware(c: AppContext, next: () => Promise<void>): Promise<void> {
  validateRuntimeConfig(c.env)
  await next()

  const isAsset = c.req.path.startsWith('/assets/')
  const policy = contentSecurityPolicy(turnstileEnabled(c.env), r2ImageOrigins(c.env))

  c.header('Content-Security-Policy', policy)
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
  c.header('Cross-Origin-Opener-Policy', 'same-origin')
  c.header('Cross-Origin-Resource-Policy', 'same-origin')

  if (secureCookies(c.env)) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  if (isAsset) {
    c.header('Cache-Control', 'public, max-age=300, must-revalidate')
  } else {
    c.header('Cache-Control', 'private, no-store')
    c.header('Pragma', 'no-cache')
  }
}
