import { WorkerEntrypoint } from 'cloudflare:workers'
import type { Bindings } from './types'
import {
  DEVLOG_IMAGE_CACHE_CONTROL,
  imageServiceFetch,
} from './lib/image-service'
import {
  DEVLOG_IMAGE_FILENAME_PATTERN,
  IMAGE_PUBLIC_PREFIX,
  imageContentTypeForExtension,
  isAllowedImageExtension,
} from './shared/images'

export class DevlogImageCache extends WorkerEntrypoint<Bindings> {
  override async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, {
        status: 405,
        headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' },
      })
    }

    const url = new URL(request.url)
    const legacyPrefix = '/devlog-images/i/'
    const prefix = url.pathname.startsWith(`${IMAGE_PUBLIC_PREFIX}/`)
      ? `${IMAGE_PUBLIC_PREFIX}/`
      : url.pathname.startsWith(legacyPrefix)
        ? legacyPrefix
        : null
    if (!prefix) {
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    }

    const match = DEVLOG_IMAGE_FILENAME_PATTERN.exec(url.pathname.slice(prefix.length))
    if (!match) {
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    }

    const hash = match[1]!
    const extension = match[2]!
    if (!isAllowedImageExtension(extension)) {
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    }
    const expectedContentType = imageContentTypeForExtension(extension)
    if (!expectedContentType) {
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    }

    let upstream: Response
    try {
      const headers = new Headers({ Accept: expectedContentType })

      upstream = await imageServiceFetch(this.env, `/i/${hash}.${extension}`, {
        method: request.method,
        headers,
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }

    const responseHeaders = new Headers({
      'Cache-Control': upstream.headers.get('Cache-Control') ?? DEVLOG_IMAGE_CACHE_CONTROL,
      'Content-Type': upstream.headers.get('Content-Type') ?? expectedContentType,
      ETag: upstream.headers.get('ETag') ?? `"sha256-${hash}"`,
    })
    const contentLength = upstream.headers.get('Content-Length')
    if (contentLength) responseHeaders.set('Content-Length', contentLength)

    if (upstream.status === 304) {
      await upstream.body?.cancel()
      return new Response(null, { status: 304, headers: responseHeaders })
    }
    if (upstream.status === 404) {
      await upstream.body?.cancel()
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    }

    const upstreamContentType =
      upstream.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
    if (!upstream.ok || upstreamContentType !== expectedContentType) {
      await upstream.body?.cancel()
      return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }

    if (request.method === 'HEAD') {
      await upstream.body?.cancel()
      return new Response(null, {
        status: upstream.status,
        headers: responseHeaders,
      })
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  }
}
