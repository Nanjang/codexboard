import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/devlog-image-cache-entrypoint', () => ({
  DevlogImageCache: class DevlogImageCache {},
}))

import app from '../src/index'
import {
  DEVLOG_IMAGE_CACHE_HEADER,
  adminPageNumber,
  matchesIfNoneMatch,
} from '../src/lib/devlog-image-cache'
import type { Bindings } from '../src/types'

const IMAGE_HASH = 'a1b4093f8da2e457974b57ab9f069cbc2282d25de2126bf51b7d1c93e4bb508f'
const IMAGE_PATH = `/i/${IMAGE_HASH}.png`

class TestD1PreparedStatement implements D1PreparedStatement {
  values: unknown[] = []

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
    return Promise.reject(new Error('run is not used by this test'))
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return Promise.reject(new Error('all is not used by this test'))
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>
  raw<T = unknown[]>(_options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    return Promise.reject(new Error('raw is not used by this test'))
  }
}

class TestD1Session implements D1DatabaseSession {
  prepare(_query: string): D1PreparedStatement {
    return new TestD1PreparedStatement()
  }

  batch<T = unknown>(_statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return Promise.resolve([])
  }

  getBookmark(): string | null {
    return null
  }
}

class TestD1Database implements D1Database {
  batchCalls = 0
  readonly batches: TestD1PreparedStatement[][] = []

  prepare(_query: string): D1PreparedStatement {
    return new TestD1PreparedStatement()
  }

  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.batchCalls += 1
    this.batches.push(
      statements.filter(
        (statement): statement is TestD1PreparedStatement =>
          statement instanceof TestD1PreparedStatement,
      ),
    )
    return Promise.resolve([])
  }

  exec(_query: string): Promise<D1ExecResult> {
    return Promise.resolve({ count: 0, duration: 0 })
  }

  withSession(_constraintOrBookmark?: D1SessionBookmark | D1SessionConstraint): D1DatabaseSession {
    return new TestD1Session()
  }

  dump(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(0))
  }
}

class TestExecutionContext {
  readonly pending: Promise<unknown>[] = []
  readonly waitUntil = vi.fn((promise: Promise<unknown>) => {
    this.pending.push(promise)
  })
  readonly passThroughOnException = vi.fn()
  readonly props = undefined
  readonly exports: {
    app: Fetcher
    DevlogImageCache: Pick<Fetcher, 'fetch'>
  }

  get tracing(): ExecutionContext['tracing'] {
    throw new Error('tracing is not used by this test')
  }

  constructor(devlogImageCacheFetch: Fetcher['fetch']) {
    this.exports = {
      app: createFetcher(async () => new Response(null, { status: 404 })),
      DevlogImageCache: { fetch: devlogImageCacheFetch },
    }
  }
}

function workerExecutionContext(context: TestExecutionContext): ExecutionContext {
  // Node tests cannot construct Workers' runtime-branded loopback export stubs.
  return context as unknown as ExecutionContext
}

function createFetcher(fetch: Fetcher['fetch']): Fetcher {
  return {
    fetch,
    connect: () => {
      throw new Error('connect is not used by this test')
    },
  }
}

function createEnv(imageVaultFetch: Fetcher['fetch']): { db: TestD1Database; env: Bindings } {
  const db = new TestD1Database()
  const env: Bindings = {
    DB: db,
    ASSETS: createFetcher(async () => new Response(null, { status: 404 })),
    AUTH_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    WRITE_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    CF_VERSION_METADATA: {
      id: 'test-version',
      tag: '',
      timestamp: '2026-07-29T00:00:00.000Z',
    },
    IMAGE_VAULT: createFetcher(imageVaultFetch),
    BASE_URL: 'https://board.oc7.workers.dev',
    GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  }
  return { db, env }
}

async function settlePending(pending: Promise<unknown>[]): Promise<void> {
  await Promise.all(pending.splice(0))
}

describe('devlog image cache helpers', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['0', 1],
    ['-1', 1],
    ['1.5', 1],
    ['2', 2],
    ['10001', 10_000],
  ])('normalizes admin page %s to %i', (value, expected) => {
    expect(adminPageNumber(value)).toBe(expected)
  })

  it('matches strong, weak, wildcard, and comma-separated If-None-Match values', () => {
    const etag = `"sha256-${IMAGE_HASH}"`
    expect(matchesIfNoneMatch(etag, etag)).toBe(true)
    expect(matchesIfNoneMatch(`W/${etag}`, etag)).toBe(true)
    expect(matchesIfNoneMatch(`"other", ${etag}`, etag)).toBe(true)
    expect(matchesIfNoneMatch('*', etag)).toBe(true)
    expect(matchesIfNoneMatch('"other"', etag)).toBe(false)
    expect(matchesIfNoneMatch(undefined, etag)).toBe(false)
  })
})

describe('devlog image route cache', () => {
  it('tracks a cached entrypoint miss then hit without a second VPC fetch', async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71])
    const imageVaultFetch = vi.fn<Fetcher['fetch']>(async () => {
      return new Response(imageBytes, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Type': 'image/png',
          ETag: `"sha256-${IMAGE_HASH}"`,
        },
      })
    })
    let cacheRequestCount = 0
    const devlogImageCacheFetch = vi.fn<Fetcher['fetch']>(async (input) => {
      cacheRequestCount += 1
      if (cacheRequestCount === 1) {
        const upstream = await imageVaultFetch(input)
        const headers = new Headers(upstream.headers)
        headers.set('Cf-Cache-Status', 'MISS')
        return new Response(upstream.body, {
          status: upstream.status,
          headers,
        })
      }
      return new Response(imageBytes, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Cf-Cache-Status': 'HIT',
          'Content-Type': 'image/png',
          ETag: `"sha256-${IMAGE_HASH}"`,
        },
      })
    })
    const { db, env } = createEnv(imageVaultFetch)
    const execution = new TestExecutionContext(devlogImageCacheFetch)

    const miss = await app.request(
      `https://board.oc7.workers.dev${IMAGE_PATH}?request=first`,
      { headers: { 'If-None-Match': '"sha256-example"' } },
      env,
      workerExecutionContext(execution),
    )

    expect(miss.status).toBe(200)
    expect(miss.headers.get(DEVLOG_IMAGE_CACHE_HEADER)).toBe('MISS')
    expect(await miss.arrayBuffer()).toEqual(imageBytes.buffer)
    expect(imageVaultFetch).toHaveBeenCalledTimes(1)
    expect(devlogImageCacheFetch).toHaveBeenCalledTimes(1)
    expect(execution.waitUntil).toHaveBeenCalledTimes(1)
    const firstEntrypointRequest = devlogImageCacheFetch.mock.calls[0]?.[0]
    expect(firstEntrypointRequest).toBeInstanceOf(Request)
    expect((firstEntrypointRequest as Request).url).toBe(
      `https://board.oc7.workers.dev${IMAGE_PATH}`,
    )
    expect((firstEntrypointRequest as Request).headers.get('Accept')).toBe('image/png')
    expect((firstEntrypointRequest as Request).headers.get('If-None-Match')).toBeNull()
    await settlePending(execution.pending)

    const hit = await app.request(
      `https://board.oc7.workers.dev${IMAGE_PATH}?request=second`,
      undefined,
      env,
      workerExecutionContext(execution),
    )

    expect(hit.status).toBe(200)
    expect(hit.headers.get(DEVLOG_IMAGE_CACHE_HEADER)).toBe('HIT')
    expect(await hit.arrayBuffer()).toEqual(imageBytes.buffer)
    expect(imageVaultFetch).toHaveBeenCalledTimes(1)
    expect(devlogImageCacheFetch).toHaveBeenCalledTimes(2)
    expect(execution.waitUntil).toHaveBeenCalledTimes(2)
    const secondEntrypointRequest = devlogImageCacheFetch.mock.calls[1]?.[0]
    expect(secondEntrypointRequest).toBeInstanceOf(Request)
    expect((secondEntrypointRequest as Request).url).toBe(
      `https://board.oc7.workers.dev${IMAGE_PATH}`,
    )
    await settlePending(execution.pending)

    const notModified = await app.request(
      `https://board.oc7.workers.dev${IMAGE_PATH}`,
      { headers: { 'If-None-Match': `"sha256-${IMAGE_HASH}"` } },
      env,
      workerExecutionContext(execution),
    )

    expect(notModified.status).toBe(304)
    expect(notModified.headers.get(DEVLOG_IMAGE_CACHE_HEADER)).toBe('HIT')
    expect(imageVaultFetch).toHaveBeenCalledTimes(1)
    expect(devlogImageCacheFetch).toHaveBeenCalledTimes(3)
    const conditionalEntrypointRequest = devlogImageCacheFetch.mock.calls[2]?.[0]
    expect((conditionalEntrypointRequest as Request).headers.get('If-None-Match')).toBeNull()
    await settlePending(execution.pending)

    expect(db.batchCalls).toBe(3)
    expect(db.batches.map((batch) => batch[0]?.values[3])).toEqual(['MISS', 'HIT', 'HIT'])
    expect(db.batches.map((batch) => batch[0]?.values[4])).toEqual([200, 200, 304])
  })

  it('marks an upstream 404 as a miss and prevents it from being stored by clients', async () => {
    const imageVaultFetch = vi.fn<Fetcher['fetch']>(async () => {
      throw new Error('the outer route must use the cached entrypoint')
    })
    const devlogImageCacheFetch = vi.fn<Fetcher['fetch']>(async () => {
      return new Response(null, {
        status: 404,
        headers: { 'Cf-Cache-Status': 'MISS' },
      })
    })
    const { db, env } = createEnv(imageVaultFetch)
    const execution = new TestExecutionContext(devlogImageCacheFetch)

    const response = await app.request(
      `https://board.oc7.workers.dev${IMAGE_PATH}`,
      undefined,
      env,
      workerExecutionContext(execution),
    )

    expect(response.status).toBe(404)
    expect(response.headers.get(DEVLOG_IMAGE_CACHE_HEADER)).toBe('MISS')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(devlogImageCacheFetch).toHaveBeenCalledTimes(1)
    expect(imageVaultFetch).not.toHaveBeenCalled()
    expect(execution.waitUntil).toHaveBeenCalledTimes(1)
    await settlePending(execution.pending)
    expect(db.batchCalls).toBe(1)
    expect(db.batches[0]?.[0]?.values[3]).toBe('MISS')
    expect(db.batches[0]?.[0]?.values[4]).toBe(404)
  })
})
