import { normalizeRssUrl } from './rss'
import type { BookmarkIconColor } from '../types'
import {
  bookmarkIconPalette,
  DEFAULT_BOOKMARK_ICON_COLOR,
} from './bookmark-icon-palette'

const ICON_FETCH_TIMEOUT_MS = 3_000
const ICON_MAX_BYTES = 128 * 1024
const ICON_PAGE_MAX_BYTES = 256 * 1024
const ICON_MAX_REDIRECTS = 2
const ICON_MAX_CANDIDATES = 4
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

function iconHeaders(contentType: string, maxAge: number): HeadersInit {
  return {
    'Cache-Control': `private, max-age=${maxAge}`,
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
  }
}

export function bookmarkIconFallback(
  color: BookmarkIconColor = DEFAULT_BOOKMARK_ICON_COLOR,
): Response {
  const palette = bookmarkIconPalette(color)
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
  <rect width="28" height="28" rx="8" fill="${palette.background}"/>
  <path d="M10 18 18 10m-6 0h6v6" fill="none" stroke="${palette.foreground}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
  return new Response(icon, {
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

interface FetchedBookmarkIcon {
  icon: BookmarkIconData
  url: string
}

async function fetchIconAt(iconUrl: string): Promise<FetchedBookmarkIcon | null> {
  let currentUrl = iconUrl
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
      return {
        icon: { bytes, contentType: outputType },
        url: currentUrl,
      }
    } catch {
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  return null
}

export async function fetchBookmarkIconUrl(iconUrl: string): Promise<BookmarkIconData | null> {
  try {
    return (await fetchIconAt(normalizeRssUrl(iconUrl)))?.icon ?? null
  } catch {
    return null
  }
}

async function readPageHtml(response: Response): Promise<string | null> {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > ICON_PAGE_MAX_BYTES) {
    await response.body?.cancel()
    return null
  }
  if (!response.body) return null

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytesRead = 0
  let html = ''

  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytesRead += chunk.value.byteLength
      if (bytesRead > ICON_PAGE_MAX_BYTES) {
        await reader.cancel()
        return null
      }
      html += decoder.decode(chunk.value, { stream: true })
    }
    return html + decoder.decode()
  } finally {
    reader.releaseLock()
  }
}

interface IconCandidate {
  url: string
  rank: number
  position: number
}

function tagAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>()
  const pattern = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gu
  let match: RegExpExecArray | null

  while ((match = pattern.exec(tag))) {
    const name = match[1]?.toLowerCase()
    const value = match[2] ?? match[3] ?? match[4]
    if (name && value !== undefined) attributes.set(name, value)
  }
  return attributes
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/giu, '&')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
}

function iconSizeRank(value: string | undefined): number {
  if (!value) return 500
  const sizes = Array.from(value.matchAll(/(\d+)x(\d+)/giu))
  if (sizes.length === 0) return value.toLowerCase().includes('any') ? 400 : 500
  return Math.min(
    ...sizes.map((match) => {
      const width = Number(match[1])
      const height = Number(match[2])
      return Math.abs(Math.max(width, height) - 32)
    }),
  )
}

function iconUrlsFromHtml(html: string, pageUrl: string): string[] {
  const candidates: IconCandidate[] = []
  const tags = html.match(/<link\b[^>]*>/giu) ?? []

  for (const [position, tag] of tags.entries()) {
    const attributes = tagAttributes(tag)
    const relTokens = (attributes.get('rel') ?? '')
      .toLowerCase()
      .split(/\s+/u)
      .filter(Boolean)
    const isStandardIcon = relTokens.includes('icon')
    const isTouchIcon = relTokens.includes('apple-touch-icon')
    if (!isStandardIcon && !isTouchIcon) continue

    const href = decodeHtmlAttribute(attributes.get('href') ?? '').trim()
    if (!href) continue

    try {
      const url = normalizeRssUrl(new URL(href, pageUrl).toString())
      const typeRank = isStandardIcon && !isTouchIcon ? 0 : 1_000
      candidates.push({
        url,
        rank: typeRank + iconSizeRank(attributes.get('sizes')),
        position,
      })
    } catch {
      continue
    }
  }

  candidates.sort((left, right) => left.rank - right.rank || left.position - right.position)
  return Array.from(new Set(candidates.map((candidate) => candidate.url))).slice(
    0,
    ICON_MAX_CANDIDATES,
  )
}

async function discoverIconUrls(bookmarkUrl: string): Promise<string[]> {
  let currentUrl = normalizeRssUrl(bookmarkUrl)

  for (let redirectCount = 0; redirectCount <= ICON_MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), ICON_FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9',
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
        if (!location || redirectCount === ICON_MAX_REDIRECTS) return []
        currentUrl = normalizeRssUrl(new URL(location, currentUrl).toString())
        continue
      }

      const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      if (
        !response.ok ||
        (contentType !== 'text/html' && contentType !== 'application/xhtml+xml')
      ) {
        await response.body?.cancel()
        return []
      }

      const html = await readPageHtml(response)
      return html ? iconUrlsFromHtml(html, currentUrl) : []
    } catch {
      return []
    } finally {
      clearTimeout(timeout)
    }
  }

  return []
}

async function resolveBookmarkIcon(bookmarkUrl: string): Promise<FetchedBookmarkIcon | null> {
  let defaultIconUrl: string
  let normalizedBookmarkUrl: string
  try {
    defaultIconUrl = bookmarkIconUrl(bookmarkUrl)
    const pageUrl = new URL(bookmarkUrl)
    pageUrl.protocol = 'https:'
    normalizedBookmarkUrl = normalizeRssUrl(pageUrl.toString())
  } catch {
    return null
  }

  const defaultIcon = await fetchIconAt(defaultIconUrl)
  if (defaultIcon) return defaultIcon

  const discoveredUrls = await discoverIconUrls(normalizedBookmarkUrl)
  for (const iconUrl of discoveredUrls) {
    if (iconUrl === defaultIconUrl) continue
    const icon = await fetchIconAt(iconUrl)
    if (icon) return icon
  }

  return null
}

export async function discoverBookmarkIconUrl(bookmarkUrl: string): Promise<string | null> {
  return (await resolveBookmarkIcon(bookmarkUrl))?.url ?? null
}

export async function fetchBookmarkIcon(bookmarkUrl: string): Promise<BookmarkIconData | null> {
  return (await resolveBookmarkIcon(bookmarkUrl))?.icon ?? null
}
