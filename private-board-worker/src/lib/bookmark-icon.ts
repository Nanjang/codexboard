import { normalizeRssUrl } from './rss'

const ICON_FETCH_TIMEOUT_MS = 3_000
const ICON_MAX_BYTES = 128 * 1024
const ICON_MAX_REDIRECTS = 2
const ICON_CACHE_SECONDS = 24 * 60 * 60
const FALLBACK_CACHE_SECONDS = 60 * 60

const ACCEPTED_ICON_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'application/octet-stream',
])

const FALLBACK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
  <rect width="28" height="28" rx="8" fill="#e7f3ea"/>
  <path d="M10 18 18 10m-6 0h6v6" fill="none" stroke="#157347" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

function iconHeaders(contentType: string, maxAge: number): HeadersInit {
  return {
    'Cache-Control': `private, max-age=${maxAge}`,
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
  }
}

export function bookmarkIconFallback(): Response {
  return new Response(FALLBACK_ICON, {
    headers: iconHeaders('image/svg+xml; charset=utf-8', FALLBACK_CACHE_SECONDS),
  })
}

export function storedBookmarkIcon(bytes: number[], contentType: string): Response {
  if (!ACCEPTED_ICON_TYPES.has(contentType) || bytes.length === 0 || bytes.length > ICON_MAX_BYTES) {
    return bookmarkIconFallback()
  }
  return new Response(new Uint8Array(bytes), {
    headers: iconHeaders(contentType, ICON_CACHE_SECONDS),
  })
}

export function bookmarkIconUrl(bookmarkUrl: string): string {
  const source = new URL(bookmarkUrl)
  const icon = new URL('/favicon.ico', source.origin)
  icon.protocol = 'https:'
  return normalizeRssUrl(icon.toString())
}

async function readIconBytes(response: Response): Promise<Uint8Array | null> {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > ICON_MAX_BYTES) {
    await response.body?.cancel()
    return null
  }
  if (!response.body) return null

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > ICON_MAX_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }

  if (size === 0) return null
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export interface BookmarkIconData {
  bytes: Uint8Array
  contentType: string
}

export async function fetchBookmarkIcon(bookmarkUrl: string): Promise<BookmarkIconData | null> {
  let currentUrl: string
  try {
    currentUrl = bookmarkIconUrl(bookmarkUrl)
  } catch {
    return null
  }

  for (let redirectCount = 0; redirectCount <= ICON_MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), ICON_FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'image/png,image/x-icon,image/vnd.microsoft.icon,image/webp,image/jpeg,image/gif;q=0.8',
        },
        signal: controller.signal,
        cf: {
          cacheEverything: true,
          cacheTtl: ICON_CACHE_SECONDS,
        },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location || redirectCount === ICON_MAX_REDIRECTS) return null
        try {
          currentUrl = normalizeRssUrl(new URL(location, currentUrl).toString())
        } catch {
          return null
        }
        continue
      }

      const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      if (!response.ok || !contentType || !ACCEPTED_ICON_TYPES.has(contentType)) {
        await response.body?.cancel()
        return null
      }

      const bytes = await readIconBytes(response)
      if (!bytes) return null
      const outputType = contentType === 'application/octet-stream' ? 'image/x-icon' : contentType
      return { bytes, contentType: outputType }
    } catch {
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  return null
}
