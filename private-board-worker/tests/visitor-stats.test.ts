import { describe, expect, it } from 'vitest'
import {
  databaseUsagePercent,
  databaseUsedMegabytes,
  FREE_D1_DATABASE_LIMIT_BYTES,
  getVisitorTimeSeries,
  koreaVisitDay,
  recordVisitor,
  shouldTrackVisitor,
  visitorChartRange,
  visitorChartWindow,
  visitorIp,
} from '../src/lib/visitor-stats'

const emptyMeta: D1Meta & Record<string, unknown> = {
  duration: 0,
  size_after: 0,
  rows_read: 0,
  rows_written: 0,
  last_row_id: 0,
  changed_db: false,
  changes: 0,
}

function d1Result<T>(results: T[], sizeAfter = 0): D1Result<T> {
  return { success: true, meta: { ...emptyMeta, size_after: sizeAfter }, results }
}

class VisitorStatement implements D1PreparedStatement {
  readonly query: string
  values: unknown[] = []

  constructor(query: string) {
    this.query = query
  }

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values
    return this
  }

  first<T = unknown>(_colName: string): Promise<T | null>
  first<T = Record<string, unknown>>(): Promise<T | null>
  first<T = unknown>(_colName?: string): Promise<T | null> {
    return Promise.resolve(null)
  }

  run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return Promise.reject(new Error('run is not used'))
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return Promise.reject(new Error('all is not used'))
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>
  raw<T = unknown[]>(_options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    return Promise.reject(new Error('raw is not used'))
  }
}

class VisitorSession implements D1DatabaseSession {
  prepare(query: string): D1PreparedStatement {
    return new VisitorStatement(query)
  }

  batch<T = unknown>(_statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return Promise.resolve([])
  }

  getBookmark(): string | null {
    return null
  }
}

class VisitorDatabase implements D1Database {
  readonly statements: VisitorStatement[] = []

  prepare(query: string): D1PreparedStatement {
    const statement = new VisitorStatement(query)
    this.statements.push(statement)
    return statement
  }

  batch<T = unknown>(_statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return Promise.resolve([
      d1Result<T>([]),
      d1Result<T>([]),
      d1Result([{ count: 12 }]) as D1Result<T>,
      d1Result([{ count: 3456 }], FREE_D1_DATABASE_LIMIT_BYTES / 4) as D1Result<T>,
    ])
  }

  exec(_query: string): Promise<D1ExecResult> {
    return Promise.resolve({ count: 0, duration: 0 })
  }

  withSession(_constraintOrBookmark?: D1SessionBookmark | D1SessionConstraint): D1DatabaseSession {
    return new VisitorSession()
  }

  dump(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(0))
  }
}

class ChartStatement extends VisitorStatement {
  constructor(query: string, private readonly rows: Record<string, unknown>[]) {
    super(query)
  }

  override all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return Promise.resolve(d1Result(this.rows as T[]))
  }
}

class ChartDatabase extends VisitorDatabase {
  constructor(private readonly rows: Record<string, unknown>[]) {
    super()
  }

  override prepare(query: string): D1PreparedStatement {
    return new ChartStatement(query, this.rows)
  }
}

describe('방문자 통계', () => {
  it('관리자 시계열 범위와 구간 수를 제한한다', () => {
    const now = Date.UTC(2026, 6, 30, 3, 27, 45)
    expect(visitorChartRange('hour')).toBe('hour')
    expect(visitorChartRange('week')).toBe('week')
    expect(visitorChartRange('month')).toBe('month')
    expect(visitorChartRange('invalid')).toBe('day')

    expect(visitorChartWindow('hour', now).bucketCount).toBe(60)
    expect(visitorChartWindow('hour', now).bucketMs).toBe(60_000)
    expect(visitorChartWindow('day', now).bucketCount).toBe(24)
    expect(visitorChartWindow('day', now).bucketMs).toBe(3_600_000)
    expect(visitorChartWindow('week', now).bucketCount).toBe(168)
    expect(visitorChartWindow('week', now).bucketMs).toBe(3_600_000)
    expect(visitorChartWindow('month', now).bucketCount).toBe(30)
    expect(visitorChartWindow('month', now).bucketMs).toBe(86_400_000)
  })

  it('시계열에서 조회되지 않은 구간을 0명으로 채운다', async () => {
    const now = Date.UTC(2026, 6, 30, 3, 27, 45)
    const chart = await getVisitorTimeSeries(
      new ChartDatabase([
        { bucket_index: 0, unique_count: 2 },
        { bucket_index: 23, unique_count: 5 },
      ]),
      'day',
      now,
    )

    expect(chart.buckets).toHaveLength(24)
    expect(chart.buckets[0]?.count).toBe(2)
    expect(chart.buckets[1]?.count).toBe(0)
    expect(chart.buckets[23]?.count).toBe(5)
    expect(chart.peakCount).toBe(5)
    expect(chart.bucketLabel).toBe('1시간')
  })

  it('한국 시간 날짜 경계를 사용한다', () => {
    expect(koreaVisitDay(Date.UTC(2026, 6, 29, 14, 59, 59))).toBe('2026-07-29')
    expect(koreaVisitDay(Date.UTC(2026, 6, 29, 15, 0, 0))).toBe('2026-07-30')
  })

  it('실제 HTML GET 응답만 집계한다', () => {
    const htmlResponse = new Response('<!doctype html>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
    expect(shouldTrackVisitor(new Request('https://board.example.com/login'), htmlResponse)).toBe(true)
    expect(
      shouldTrackVisitor(
        new Request('https://board.example.com/login', { headers: { Purpose: 'prefetch' } }),
        htmlResponse,
      ),
    ).toBe(false)
    expect(
      shouldTrackVisitor(
        new Request('https://board.example.com/api/data'),
        Response.json({ ok: true }),
      ),
    ).toBe(false)
    expect(
      shouldTrackVisitor(
        new Request('https://board.example.com/login', { method: 'HEAD' }),
        htmlResponse,
      ),
    ).toBe(false)
    expect(
      shouldTrackVisitor(
        new Request('https://board.example.com/login', {
          headers: { 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors' },
        }),
        htmlResponse,
      ),
    ).toBe(false)
    expect(
      shouldTrackVisitor(
        new Request('https://board.example.com/login', {
          headers: { 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' },
        }),
        htmlResponse,
      ),
    ).toBe(true)
  })

  it('D1 무료 플랜의 DB당 한도 대비 사용률을 계산한다', () => {
    expect(databaseUsagePercent(FREE_D1_DATABASE_LIMIT_BYTES / 4)).toBe(25)
    expect(databaseUsedMegabytes(125_000_000)).toBe(125)
    expect(databaseUsedMegabytes(125_000_001)).toBe(126)
  })

  it('Cloudflare 원본 IP만 신뢰한다', () => {
    expect(
      visitorIp(
        new Request('https://board.example.com', {
          headers: {
            'CF-Connecting-IP': '2001:db8::1',
            'X-Forwarded-For': '198.51.100.10',
          },
        }),
      ),
    ).toBe('2001:db8::1')
    expect(
      visitorIp(
        new Request('https://board.example.com', {
          headers: { 'X-Forwarded-For': '198.51.100.10' },
        }),
      ),
    ).toBeNull()
  })

  it('매 페이지 접속 로그에 IP와 Referer 원문을 저장하고 카운터 테이블에는 저장하지 않는다', async () => {
    const db = new VisitorDatabase()
    const referer =
      'https://search.example.com/results?q=%EC%9B%90%EB%AC%B8&token=keep-this#section'
    const request = new Request('https://board.example.com/devlogs?page=2', {
      headers: {
        'CF-Connecting-IP': '203.0.113.20',
        Referer: referer,
        'User-Agent': 'Visitor Test Browser/1.0',
      },
    })

    const stats = await recordVisitor(
      db,
      request,
      'visitor-test-secret-with-enough-length',
      'member-1',
      200,
      Date.UTC(2026, 6, 30, 3),
    )

    expect(stats).toEqual({
      today: 12,
      total: 3456,
      databaseUsagePercent: 25,
      databaseUsedMegabytes: 125,
    })
    expect(db.statements[0]?.query).toContain('INSERT INTO visitor_page_views')
    expect(db.statements[0]?.values).toEqual([
      '2026-07-30',
      Date.UTC(2026, 6, 30, 3),
      '203.0.113.20',
      referer,
      'Visitor Test Browser/1.0',
      '/devlogs?page=2',
      'member-1',
      200,
    ])
    expect(db.statements[1]?.query).toContain('INSERT OR IGNORE INTO visitor_daily_uniques')
    expect(db.statements[1]?.values).not.toContain('203.0.113.20')
    expect(db.statements[1]?.values).not.toContain(referer)
  })

  it('Cloudflare IP가 없으면 로그와 카운터를 기록하지 않는다', async () => {
    const db = new VisitorDatabase()
    const stats = await recordVisitor(
      db,
      new Request('https://board.example.com/login'),
      'visitor-test-secret-with-enough-length',
      null,
      200,
    )

    expect(stats).toBeNull()
    expect(db.statements).toHaveLength(0)
  })
})
