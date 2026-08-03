import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FREE_D1_ACCOUNT_LIMIT_BYTES,
  getAccountD1Storage,
  getDatabaseUsageStats,
} from '../src/lib/database-usage'
import type { Bindings } from '../src/types'

const baseEnv = {
  D1_ACCOUNT_STORAGE_LIMIT_BYTES: String(FREE_D1_ACCOUNT_LIMIT_BYTES),
} as Bindings

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('D1 usage statistics', () => {
  it('sums the largest recent storage sample for each account database', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            viewer: {
              accounts: [
                {
                  d1StorageAdaptiveGroups: [
                    {
                      max: { databaseSizeBytes: 100 },
                      dimensions: { databaseId: 'database-a', date: '2026-08-03' },
                    },
                    {
                      max: { databaseSizeBytes: 120 },
                      dimensions: { databaseId: 'database-a', date: '2026-08-04' },
                    },
                    {
                      max: { databaseSizeBytes: 80 },
                      dimensions: { databaseId: 'database-b', date: '2026-08-04' },
                    },
                  ],
                },
              ],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getAccountD1Storage({
      ...baseEnv,
      CLOUDFLARE_ACCOUNT_ID: 'account-1',
      CLOUDFLARE_API_TOKEN: 'token-1',
    } as Bindings)

    expect(result.status).toBe('available')
    expect(result.usage).toMatchObject({
      usedBytes: 200,
      databaseCount: 2,
      limitBytes: FREE_D1_ACCOUNT_LIMIT_BYTES,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/graphql',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('reports when account analytics credentials are not configured', async () => {
    const result = await getAccountD1Storage(baseEnv)

    expect(result).toEqual({ usage: null, status: 'not-configured' })
  })

  it('returns current database size and table row counts together', async () => {
    const prepare = vi.fn((query: string) => {
      if (query.includes('sqlite_schema')) {
        return {
          all: async () => ({
            success: true,
            meta: { size_after: 4096 },
            results: [{ name: 'posts' }, { name: 'users' }],
          }),
        }
      }
      return {
        bind: (...tableNames: string[]) => ({
          all: async () => ({
            success: true,
            meta: { size_after: 4096 },
            results: tableNames.map((tableName) => ({
              table_name: tableName,
              row_count: tableName === 'posts' ? 7 : 2,
            })),
          }),
        }),
      }
    })
    const database = {
      prepare,
    } as unknown as D1Database

    const result = await getDatabaseUsageStats(database, baseEnv)

    expect(result.databaseSizeBytes).toBe(4096)
    expect(result.totalRows).toBe(9)
    expect(result.tables).toEqual([
      { name: 'posts', rowCount: 7 },
      { name: 'users', rowCount: 2 },
    ])
    expect(result.accountStatus).toBe('not-configured')
    expect(prepare).toHaveBeenCalledTimes(2)
  })
})
