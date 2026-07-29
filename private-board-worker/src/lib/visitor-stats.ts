import { hmacSha256Base64Url } from './crypto'
import type { PaginatedResult, VisitorPageViewRow } from '../types'

export interface VisitorStats {
  today: number
  total: number
  databaseUsagePercent: number
}

interface VisitorCountRow {
  count: number
}

export const VISITOR_LOG_PAGE_SIZE = 50
export const FREE_D1_DATABASE_LIMIT_BYTES = 500_000_000

const koreaDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function koreaVisitDay(timestamp: number): string {
  return koreaDayFormatter.format(new Date(timestamp))
}

export function visitorIp(request: Request): string | null {
  const connectingIp = request.headers.get('CF-Connecting-IP')?.trim()
  return connectingIp || null
}

export function shouldTrackVisitor(request: Request, response: Response): boolean {
  if (request.method !== 'GET') return false
  const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? ''
  if (!contentType.includes('text/html')) return false
  const purpose = `${request.headers.get('Purpose') ?? ''} ${request.headers.get('Sec-Purpose') ?? ''}`
  if (purpose.toLowerCase().includes('prefetch')) return false
  const fetchDestination = request.headers.get('Sec-Fetch-Dest')
  if (fetchDestination && fetchDestination.toLowerCase() !== 'document') return false
  const fetchMode = request.headers.get('Sec-Fetch-Mode')
  if (fetchMode && fetchMode.toLowerCase() !== 'navigate') return false
  return true
}

export function databaseUsagePercent(sizeBytes: number): number {
  return (sizeBytes / FREE_D1_DATABASE_LIMIT_BYTES) * 100
}

export async function recordVisitor(
  db: D1Database,
  request: Request,
  secret: string,
  userId: string | null,
  responseStatus: number,
  now = Date.now(),
): Promise<VisitorStats | null> {
  const ipAddress = visitorIp(request)
  if (!ipAddress) return null

  const visitDay = koreaVisitDay(now)
  const userAgent = request.headers.get('User-Agent') ?? ''
  const referer = request.headers.get('Referer') ?? ''
  const pageUrl = new URL(request.url)
  const path = `${pageUrl.pathname}${pageUrl.search}`
  const visitorHash = await hmacSha256Base64Url(
    secret,
    `daily-visitor:${visitDay}\n${ipAddress}`,
  )

  const results = await db.batch<VisitorCountRow>([
    db
      .prepare(
        `
        INSERT INTO visitor_page_views (
          visit_day,
          visited_at,
          ip_address,
          referer,
          user_agent,
          path,
          user_id,
          response_status
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        `,
      )
      .bind(visitDay, now, ipAddress, referer, userAgent, path, userId, responseStatus),
    db
      .prepare(
        `
        INSERT OR IGNORE INTO visitor_daily_uniques (visit_day, visitor_hash, first_seen_at)
        VALUES (?1, ?2, ?3)
        `,
      )
      .bind(visitDay, visitorHash, now),
    db
      .prepare('SELECT unique_count AS count FROM visitor_daily_counts WHERE visit_day = ?1')
      .bind(visitDay),
    db.prepare('SELECT unique_count AS count FROM visitor_total_stats WHERE singleton_id = 1'),
  ])

  return {
    today: results[2]?.results[0]?.count ?? 0,
    total: results[3]?.results[0]?.count ?? 0,
    databaseUsagePercent: databaseUsagePercent(
      results[results.length - 1]?.meta.size_after ?? 0,
    ),
  }
}

export function injectVisitorStats(response: Response, stats: VisitorStats): Response {
  return new HTMLRewriter()
    .on('[data-visitor-today]', {
      element(element) {
        element.setInnerContent(stats.today.toLocaleString('ko-KR'))
      },
    })
    .on('[data-visitor-total]', {
      element(element) {
        element.setInnerContent(stats.total.toLocaleString('ko-KR'))
      },
    })
    .on('[data-database-usage]', {
      element(element) {
        const formatted = Math.round(stats.databaseUsagePercent).toString()
        element.setInnerContent(`${formatted}%`)
        element.setAttribute('aria-label', `${formatted}%`)
      },
    })
    .on('[data-database-usage-bar]', {
      element(element) {
        element.setAttribute(
          'value',
          Math.min(100, Math.max(0, stats.databaseUsagePercent)).toString(),
        )
      },
    })
    .transform(response)
}

export async function listVisitorPageViews(
  db: D1Database,
  page: number,
): Promise<PaginatedResult<VisitorPageViewRow>> {
  const total = await db
    .prepare('SELECT COUNT(*) AS count FROM visitor_page_views')
    .first<VisitorCountRow>()
  const totalItems = total?.count ?? 0
  const totalPages = Math.ceil(totalItems / VISITOR_LOG_PAGE_SIZE)
  const result = await db
    .prepare(
      `
      SELECT
        id,
        visit_day,
        visited_at,
        ip_address,
        referer,
        user_agent,
        path,
        user_id,
        response_status
      FROM visitor_page_views
      ORDER BY id DESC
      LIMIT ?1 OFFSET ?2
      `,
    )
    .bind(VISITOR_LOG_PAGE_SIZE, (page - 1) * VISITOR_LOG_PAGE_SIZE)
    .all<VisitorPageViewRow>()

  return {
    items: result.results,
    page,
    pageSize: VISITOR_LOG_PAGE_SIZE,
    totalItems,
    totalPages,
  }
}
