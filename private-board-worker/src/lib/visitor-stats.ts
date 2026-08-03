import { hmacSha256Base64Url } from './crypto'
import {
  FREE_D1_DATABASE_LIMIT_BYTES,
  type AccountD1StorageUsage,
} from './database-usage'
import type { PaginatedResult, VisitorPageViewRow } from '../types'

export { FREE_D1_DATABASE_LIMIT_BYTES } from './database-usage'

export interface VisitorStats {
  today: number
  total: number
  databaseUsagePercent: number
  databaseUsedMegabytes: number
  databaseUsageScope?: 'database' | 'account'
  databaseLimitMegabytes?: number
}

interface VisitorCountRow {
  count: number
}

interface VisitorChartCountRow {
  bucket_index: number
  unique_count: number
}

interface VisitorDailyChartCountRow {
  visit_day: string
  unique_count: number
}

export type VisitorChartRange = 'hour' | 'day' | 'week' | 'month'

export interface VisitorChartBucket {
  startAt: number
  label: string
  count: number
}

export interface VisitorTimeSeries {
  range: VisitorChartRange
  periodLabel: string
  bucketLabel: string
  buckets: VisitorChartBucket[]
  peakCount: number
}

export const VISITOR_LOG_PAGE_SIZE = 50
const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const KOREA_OFFSET_MS = 9 * HOUR_MS

const koreaDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const koreaMinuteFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const koreaHourFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  hourCycle: 'h23',
})

const koreaDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
})

const koreaPeriodFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function koreaVisitDay(timestamp: number): string {
  return koreaDayFormatter.format(new Date(timestamp))
}

export function visitorChartRange(value: string | null): VisitorChartRange {
  return value === 'hour' || value === 'week' || value === 'month' ? value : 'day'
}

export function visitorChartWindow(
  range: VisitorChartRange,
  now = Date.now(),
): { startAt: number; endAt: number; bucketMs: number; bucketCount: number } {
  if (range === 'hour') {
    const endAt = Math.floor(now / MINUTE_MS) * MINUTE_MS + MINUTE_MS
    return { startAt: endAt - 60 * MINUTE_MS, endAt, bucketMs: MINUTE_MS, bucketCount: 60 }
  }
  if (range === 'month') {
    const koreaDayStart = Math.floor((now + KOREA_OFFSET_MS) / DAY_MS) * DAY_MS - KOREA_OFFSET_MS
    const endAt = koreaDayStart + DAY_MS
    return { startAt: endAt - 30 * DAY_MS, endAt, bucketMs: DAY_MS, bucketCount: 30 }
  }

  const bucketCount = range === 'week' ? 168 : 24
  const endAt = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS
  return { startAt: endAt - bucketCount * HOUR_MS, endAt, bucketMs: HOUR_MS, bucketCount }
}

function visitorBucketLabel(range: VisitorChartRange, startAt: number): string {
  if (range === 'hour') return koreaMinuteFormatter.format(new Date(startAt))
  if (range === 'month') return koreaDateFormatter.format(new Date(startAt))
  return koreaHourFormatter.format(new Date(startAt))
}

export async function getVisitorTimeSeries(
  db: D1Database,
  range: VisitorChartRange,
  now = Date.now(),
): Promise<VisitorTimeSeries> {
  const window = visitorChartWindow(range, now)
  const counts = new Map<number, number>()

  if (range === 'month') {
    const result = await db
      .prepare(
        `
        SELECT visit_day, unique_count
        FROM visitor_daily_counts
        WHERE visit_day >= ?1 AND visit_day <= ?2
        ORDER BY visit_day
        `,
      )
      .bind(koreaVisitDay(window.startAt), koreaVisitDay(window.endAt - 1))
      .all<VisitorDailyChartCountRow>()
    const dayIndexes = new Map<string, number>()
    for (let index = 0; index < window.bucketCount; index += 1) {
      dayIndexes.set(koreaVisitDay(window.startAt + index * DAY_MS), index)
    }
    for (const row of result.results) {
      const index = dayIndexes.get(row.visit_day)
      if (index !== undefined) counts.set(index, row.unique_count)
    }
  } else {
    const result = await db
      .prepare(
        `
        SELECT
          CAST((visited_at - ?1) / ?2 AS INTEGER) AS bucket_index,
          COUNT(DISTINCT ip_address) AS unique_count
        FROM visitor_page_views
        WHERE visited_at >= ?1 AND visited_at < ?3
        GROUP BY bucket_index
        ORDER BY bucket_index
        `,
      )
      .bind(window.startAt, window.bucketMs, window.endAt)
      .all<VisitorChartCountRow>()
    for (const row of result.results) {
      if (row.bucket_index >= 0 && row.bucket_index < window.bucketCount) {
        counts.set(row.bucket_index, row.unique_count)
      }
    }
  }

  const buckets = Array.from({ length: window.bucketCount }, (_, index) => {
    const startAt = window.startAt + index * window.bucketMs
    return {
      startAt,
      label: visitorBucketLabel(range, startAt),
      count: counts.get(index) ?? 0,
    }
  })

  return {
    range,
    periodLabel: `${koreaPeriodFormatter.format(new Date(window.startAt))} ~ ${koreaPeriodFormatter.format(new Date(window.endAt - 1))}`,
    bucketLabel: range === 'hour' ? '1분' : range === 'month' ? '1일' : '1시간',
    buckets,
    peakCount: Math.max(0, ...buckets.map((bucket) => bucket.count)),
  }
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

export function databaseUsedMegabytes(sizeBytes: number): number {
  return Math.ceil(sizeBytes / 1_000_000)
}

export function applyAccountD1StorageUsage(
  stats: VisitorStats,
  usage: AccountD1StorageUsage,
): VisitorStats {
  return {
    ...stats,
    databaseUsagePercent: usage.percent,
    databaseUsedMegabytes: databaseUsedMegabytes(usage.usedBytes),
    databaseUsageScope: 'account',
    databaseLimitMegabytes: usage.limitBytes / 1_000_000,
  }
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

  const databaseSizeBytes = results[results.length - 1]?.meta.size_after ?? 0

  return {
    today: results[2]?.results[0]?.count ?? 0,
    total: results[3]?.results[0]?.count ?? 0,
    databaseUsagePercent: databaseUsagePercent(databaseSizeBytes),
    databaseUsedMegabytes: databaseUsedMegabytes(databaseSizeBytes),
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
    .on('[data-database-usage-tooltip]', {
      element(element) {
        const label = stats.databaseUsageScope === 'account'
          ? '계정 전체 D1 사용량'
          : '현재 D1 데이터베이스 사용량'
        const limitMegabytes = stats.databaseLimitMegabytes ?? FREE_D1_DATABASE_LIMIT_BYTES / 1_000_000
        element.setAttribute('title', `${label} ${stats.databaseUsedMegabytes}/${limitMegabytes} MB`)
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
