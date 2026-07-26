import type { RssFeed, RssItem } from '../types'

const RSS_CACHE_SECONDS = 15 * 60
const RSS_FETCH_TIMEOUT_MS = 5_000
const RSS_MAX_BYTES = 512 * 1024
const RSS_MAX_ITEMS = 5
const RSS_MAX_REDIRECTS = 3
const RSS_SUMMARY_LENGTH = 180

export class RssFeedError extends Error {}

interface RssExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/u.test(part))) return false
  const octets = parts.map(Number)
  if (octets.some((octet) => octet > 255)) return false

  const first = octets[0]!
  const second = octets[1]!
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  )
}

function isUnsafeHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/u, '')
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.localdomain') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.home.arpa')
  ) {
    return true
  }
  if (normalized.startsWith('[')) return true
  return isPrivateIpv4(normalized)
}

export function normalizeRssUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new RssFeedError('올바른 RSS 주소를 입력하세요.')
  }

  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password ||
    isUnsafeHostname(url.hostname)
  ) {
    throw new RssFeedError('공개된 HTTPS RSS 주소만 사용할 수 있습니다.')
  }
  url.hash = ''
  const normalized = url.toString()
  if (normalized.length > 2048) throw new RssFeedError('RSS 주소는 2048자 이하여야 합니다.')
  return normalized
}

function decodeEntities(value: string): string {
  return value.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|amp|lt|gt|quot|apos);/giu,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      if (decimal) {
        const codePoint = Number.parseInt(decimal, 10)
        return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : entity
      }
      if (hexadecimal) {
        const codePoint = Number.parseInt(hexadecimal, 16)
        return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : entity
      }
      const named: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
      }
      return named[entity.toLowerCase()] ?? entity
    },
  )
}

function plainText(value: string, maxLength: number): string {
  const withoutCdata = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, '$1')
  const normalized = decodeEntities(withoutCdata)
    .replace(/<[^>]*>/gu, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trimEnd()}…` : normalized
}

function tagValue(block: string, names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(':', '\\:')
    const pattern = new RegExp(
      `<(?:[\\w.-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}\\s*>`,
      'iu',
    )
    const match = pattern.exec(block)
    if (match?.[1]) return match[1]
  }
  return null
}

function atomLink(block: string): string | null {
  const links = block.match(/<(?:[\w.-]+:)?link\b[^>]*>/giu) ?? []
  for (const link of links) {
    const rel = /\brel\s*=\s*["']([^"']+)["']/iu.exec(link)?.[1]?.toLowerCase()
    const href = /\bhref\s*=\s*["']([^"']+)["']/iu.exec(link)?.[1]
    if (href && (!rel || rel === 'alternate')) return decodeEntities(href)
  }
  return null
}

function safeItemUrl(value: string | null, baseUrl: string): string | null {
  if (!value) return null
  try {
    const url = new URL(plainText(value, 2048), baseUrl)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      isUnsafeHostname(url.hostname)
    ) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

function publishedTimestamp(value: string | null): number | null {
  if (!value) return null
  const timestamp = Date.parse(plainText(value, 160))
  return Number.isFinite(timestamp) ? timestamp : null
}

function parseItem(block: string, baseUrl: string): RssItem | null {
  const title = plainText(tagValue(block, ['title']) ?? '', 180)
  const link =
    safeItemUrl(atomLink(block), baseUrl) ??
    safeItemUrl(tagValue(block, ['link']), baseUrl) ??
    safeItemUrl(tagValue(block, ['guid', 'id']), baseUrl)
  if (!title || !link) return null

  const summary = plainText(
    tagValue(block, ['description', 'summary', 'content', 'content:encoded']) ?? '',
    RSS_SUMMARY_LENGTH,
  )
  const publishedAt = publishedTimestamp(
    tagValue(block, ['pubDate', 'published', 'updated', 'date', 'dc:date']),
  )
  return { title, url: link, summary, publishedAt }
}

export function parseRssFeed(xml: string, sourceUrl: string): RssFeed {
  const isAtom = /<(?:[\w.-]+:)?feed\b/iu.test(xml)
  const isRss = /<(?:[\w.-]+:)?(?:rss|rdf:RDF)\b/iu.test(xml) || /<(?:[\w.-]+:)?channel\b/iu.test(xml)
  if (!isAtom && !isRss) throw new RssFeedError('지원하는 RSS 또는 Atom 형식이 아닙니다.')

  const itemPattern = isAtom
    ? /<(?:[\w.-]+:)?entry\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?entry\s*>/giu
    : /<(?:[\w.-]+:)?item\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?item\s*>/giu
  const items: Array<RssItem & { position: number }> = []
  let match: RegExpExecArray | null
  let position = 0

  while ((match = itemPattern.exec(xml)) && items.length < 30) {
    const item = parseItem(match[1] ?? '', sourceUrl)
    if (item) items.push({ ...item, position })
    position += 1
  }

  items.sort((left, right) => {
    if (left.publishedAt === null && right.publishedAt === null) return left.position - right.position
    if (left.publishedAt === null) return 1
    if (right.publishedAt === null) return -1
    return right.publishedAt - left.publishedAt || left.position - right.position
  })

  const feedTitle = plainText(tagValue(xml, ['title']) ?? '', 120)
  return {
    title: feedTitle || null,
    sourceUrl,
    fetchedAt: Date.now(),
    items: items.slice(0, RSS_MAX_ITEMS).map(({ position: _position, ...item }) => item),
  }
}

async function readTextLimited(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > RSS_MAX_BYTES) {
    await response.body?.cancel()
    throw new RssFeedError('RSS 응답 크기가 너무 큽니다.')
  }
  if (!response.body) throw new RssFeedError('RSS 응답 내용이 비어 있습니다.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytesRead = 0
  let result = ''
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    void reader.cancel()
  }, RSS_FETCH_TIMEOUT_MS)

  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) {
        if (timedOut) throw new RssFeedError('RSS 서버 응답 시간이 초과되었습니다.')
        break
      }
      bytesRead += chunk.value.byteLength
      if (bytesRead > RSS_MAX_BYTES) {
        await reader.cancel()
        throw new RssFeedError('RSS 응답 크기가 너무 큽니다.')
      }
      result += decoder.decode(chunk.value, { stream: true })
    }
    return result + decoder.decode()
  } catch (error) {
    if (timedOut) throw new RssFeedError('RSS 서버 응답 시간이 초과되었습니다.')
    throw error
  } finally {
    clearTimeout(timeout)
    reader.releaseLock()
  }
}

async function fetchWithSafeRedirects(url: string): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = normalizeRssUrl(url)

  for (let redirectCount = 0; redirectCount <= RSS_MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), RSS_FETCH_TIMEOUT_MS)
    let response: Response

    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9',
        },
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RssFeedError('RSS 서버 응답 시간이 초과되었습니다.')
      }
      throw new RssFeedError('RSS 서버에 연결하지 못했습니다.')
    } finally {
      clearTimeout(timeout)
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location || redirectCount === RSS_MAX_REDIRECTS) {
        throw new RssFeedError('RSS 주소의 리다이렉트를 처리하지 못했습니다.')
      }
      currentUrl = normalizeRssUrl(new URL(location, currentUrl).toString())
      continue
    }
    return { response, finalUrl: currentUrl }
  }

  throw new RssFeedError('RSS 주소의 리다이렉트가 너무 많습니다.')
}

async function cacheKey(url: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function cachedFeed(payload: string): RssFeed | null {
  try {
    const feed = JSON.parse(payload) as RssFeed
    if (
      !feed ||
      typeof feed !== 'object' ||
      typeof feed.sourceUrl !== 'string' ||
      typeof feed.fetchedAt !== 'number' ||
      !Number.isFinite(feed.fetchedAt) ||
      !Array.isArray(feed.items) ||
      feed.items.length > RSS_MAX_ITEMS
    ) {
      return null
    }
    normalizeRssUrl(feed.sourceUrl)
    const validItems = feed.items.every(
      (item) =>
        item &&
        typeof item.title === 'string' &&
        item.title.length <= 180 &&
        typeof item.url === 'string' &&
        safeItemUrl(item.url, feed.sourceUrl) !== null &&
        typeof item.summary === 'string' &&
        item.summary.length <= RSS_SUMMARY_LENGTH &&
        (item.publishedAt === null ||
          (typeof item.publishedAt === 'number' && Number.isFinite(item.publishedAt))),
    )
    if (!validItems) return null
    return feed
  } catch {
    return null
  }
}

export async function loadRssFeed(
  url: string,
  db: D1Database,
  executionContext: RssExecutionContext,
): Promise<RssFeed> {
  const normalizedUrl = normalizeRssUrl(url)
  const key = await cacheKey(normalizedUrl)
  const cached = await db
    .prepare(
      `
      SELECT payload
      FROM rss_feed_cache
      WHERE url_hash = ?1 AND expires_at > ?2
      LIMIT 1
      `,
    )
    .bind(key, Date.now())
    .first<{ payload: string }>()
  const parsedCache = cached?.payload ? cachedFeed(cached.payload) : null
  if (parsedCache) return parsedCache

  const { response, finalUrl } = await fetchWithSafeRedirects(normalizedUrl)
  if (!response.ok) {
    await response.body?.cancel()
    throw new RssFeedError(`RSS 서버가 오류 상태(${response.status})를 반환했습니다.`)
  }

  const xml = await readTextLimited(response)
  const feed = parseRssFeed(xml, finalUrl)
  const now = Date.now()
  executionContext.waitUntil(
    db
      .prepare(
        `
        INSERT INTO rss_feed_cache (url_hash, source_url, payload, expires_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(url_hash) DO UPDATE SET
          source_url = excluded.source_url,
          payload = excluded.payload,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at
        `,
      )
      .bind(key, normalizedUrl, JSON.stringify(feed), now + RSS_CACHE_SECONDS * 1000, now)
      .run()
      .catch((error: unknown) => {
        console.warn('RSS cache write failed', {
          message: error instanceof Error ? error.message.slice(0, 160) : 'unknown',
        })
      }),
  )
  return feed
}
