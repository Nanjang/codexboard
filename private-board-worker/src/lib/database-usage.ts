import type { Bindings } from '../types'

export const FREE_D1_DATABASE_LIMIT_BYTES = 500_000_000
export const FREE_D1_ACCOUNT_LIMIT_BYTES = 5_000_000_000

const DEFAULT_D1_DATABASE_LIMIT_BYTES = FREE_D1_DATABASE_LIMIT_BYTES
const DEFAULT_D1_ACCOUNT_LIMIT_BYTES = FREE_D1_ACCOUNT_LIMIT_BYTES
const ACCOUNT_USAGE_CACHE_TTL_SECONDS = 300

const TABLE_USAGE_QUERY = `
  SELECT table_name, row_count
  FROM (
    SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
    UNION ALL SELECT 'auth_accounts', COUNT(*) FROM auth_accounts
    UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
    UNION ALL SELECT 'boards', COUNT(*) FROM boards
    UNION ALL SELECT 'posts', COUNT(*) FROM posts
    UNION ALL SELECT 'comments', COUNT(*) FROM comments
    UNION ALL SELECT 'tickets', COUNT(*) FROM tickets
    UNION ALL SELECT 'user_dashboards', COUNT(*) FROM user_dashboards
    UNION ALL SELECT 'dashboard_widgets', COUNT(*) FROM dashboard_widgets
    UNION ALL SELECT 'rss_feed_cache', COUNT(*) FROM rss_feed_cache
    UNION ALL SELECT 'user_memo_settings', COUNT(*) FROM user_memo_settings
    UNION ALL SELECT 'private_memos', COUNT(*) FROM private_memos
    UNION ALL SELECT 'memo_url_patterns', COUNT(*) FROM memo_url_patterns
    UNION ALL SELECT 'private_images', COUNT(*) FROM private_images
    UNION ALL SELECT 'custom_themes', COUNT(*) FROM custom_themes
    UNION ALL SELECT 'user_shared_themes', COUNT(*) FROM user_shared_themes
    UNION ALL SELECT 'user_theme_preferences', COUNT(*) FROM user_theme_preferences
    UNION ALL SELECT 'image_service_settings', COUNT(*) FROM image_service_settings
    UNION ALL SELECT 'devlog_image_cache_requests', COUNT(*) FROM devlog_image_cache_requests
    UNION ALL SELECT 'devlog_image_cache_file_stats', COUNT(*) FROM devlog_image_cache_file_stats
    UNION ALL SELECT 'visitor_page_views', COUNT(*) FROM visitor_page_views
    UNION ALL SELECT 'visitor_daily_uniques', COUNT(*) FROM visitor_daily_uniques
    UNION ALL SELECT 'visitor_daily_counts', COUNT(*) FROM visitor_daily_counts
    UNION ALL SELECT 'visitor_total_stats', COUNT(*) FROM visitor_total_stats
    UNION ALL SELECT 'post_image_links', COUNT(*) FROM post_image_links
    UNION ALL SELECT 'personal_bookmarks', COUNT(*) FROM personal_bookmarks
  )
  ORDER BY row_count DESC, table_name ASC
`

const ACCOUNT_STORAGE_QUERY = `
  query D1AccountStorage($accountTag: string!, $start: Date, $end: Date) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        d1StorageAdaptiveGroups(
          limit: 10000
          filter: { date_geq: $start, date_leq: $end }
        ) {
          max { databaseSizeBytes }
          dimensions { databaseId date }
        }
      }
    }
  }
`

interface TableUsageRow {
  table_name: string
  row_count: number
}

interface AccountStorageGroup {
  max?: { databaseSizeBytes?: unknown }
  dimensions?: { databaseId?: unknown; date?: unknown }
}

interface AccountD1StorageUsageResponse {
  data?: {
    viewer?: {
      accounts?: Array<{
        d1StorageAdaptiveGroups?: AccountStorageGroup[]
      }>
    }
  }
  errors?: unknown
}

export interface DatabaseTableUsage {
  name: string
  rowCount: number
}

export interface AccountD1StorageUsage {
  usedBytes: number
  limitBytes: number
  percent: number
  databaseCount: number
  measuredAt: number
}

export type AccountD1StorageStatus = 'available' | 'not-configured' | 'error'

export interface AccountD1StorageResult {
  usage: AccountD1StorageUsage | null
  status: AccountD1StorageStatus
}

export interface DatabaseUsageStats {
  databaseSizeBytes: number
  databaseLimitBytes: number
  databasePercent: number
  totalRows: number
  tables: DatabaseTableUsage[]
  measuredAt: number
  account: AccountD1StorageUsage | null
  accountStatus: AccountD1StorageStatus
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function databaseLimitBytes(env: Bindings): number {
  return positiveNumber(env.D1_DATABASE_STORAGE_LIMIT_BYTES, DEFAULT_D1_DATABASE_LIMIT_BYTES)
}

function accountLimitBytes(env: Bindings): number {
  return positiveNumber(env.D1_ACCOUNT_STORAGE_LIMIT_BYTES, DEFAULT_D1_ACCOUNT_LIMIT_BYTES)
}

function percent(usedBytes: number, limitBytes: number): number {
  return (usedBytes / limitBytes) * 100
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function nonNegativeNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function utcDate(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  return date.toISOString().slice(0, 10)
}

function accountUsageCacheKey(): Request {
  return new Request('https://codexboard.internal/cache/d1-account-storage')
}

function defaultCache(): Cache | null {
  if (typeof caches === 'undefined') return null
  const cache = (caches as CacheStorage & { default?: Cache }).default
  return cache ?? null
}

async function readCachedAccountUsage(env: Bindings): Promise<AccountD1StorageUsage | null> {
  const cache = defaultCache()
  if (!cache) return null
  const response = await cache.match(accountUsageCacheKey())
  if (!response) return null
  try {
    const value = (await response.json()) as unknown
    const record = asRecord(value)
    const usedBytes = nonNegativeNumber(record?.usedBytes)
    const databaseCount = nonNegativeNumber(record?.databaseCount)
    const measuredAt = nonNegativeNumber(record?.measuredAt)
    if (usedBytes === null || databaseCount === null || measuredAt === null) return null
    const limitBytes = accountLimitBytes(env)
    return {
      usedBytes,
      limitBytes,
      percent: percent(usedBytes, limitBytes),
      databaseCount,
      measuredAt,
    }
  } catch {
    return null
  }
}

async function writeCachedAccountUsage(usage: AccountD1StorageUsage): Promise<void> {
  const cache = defaultCache()
  if (!cache) return
  await cache.put(
    accountUsageCacheKey(),
    new Response(
      JSON.stringify({
        usedBytes: usage.usedBytes,
        databaseCount: usage.databaseCount,
        measuredAt: usage.measuredAt,
      }),
      {
        headers: {
          'Cache-Control': `max-age=${ACCOUNT_USAGE_CACHE_TTL_SECONDS}`,
          'Content-Type': 'application/json',
        },
      },
    ),
  )
}

function accountStorageGroups(value: unknown): AccountStorageGroup[] | null {
  const response = asRecord(value) as AccountD1StorageUsageResponse | null
  const accounts = response?.data?.viewer?.accounts
  const groups = accounts?.[0]?.d1StorageAdaptiveGroups
  return Array.isArray(groups) ? groups : null
}

async function queryAccountD1Storage(env: Bindings): Promise<AccountD1StorageUsage | null> {
  const accountTag = env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim()
  if (!accountTag || !apiToken) return null

  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: ACCOUNT_STORAGE_QUERY,
      variables: {
        accountTag,
        start: utcDate(-1),
        end: utcDate(0),
      },
    }),
  })
  if (!response.ok) throw new Error(`D1 storage analytics request failed with status ${response.status}`)

  const groups = accountStorageGroups(await response.json())
  if (!groups) throw new Error('D1 storage analytics response did not contain database groups')

  const sizesByDatabase = new Map<string, number>()
  for (const group of groups) {
    const dimensions = asRecord(group.dimensions)
    const databaseId = typeof dimensions?.databaseId === 'string' ? dimensions.databaseId : ''
    const sizeBytes = nonNegativeNumber(asRecord(group.max)?.databaseSizeBytes)
    if (!databaseId || sizeBytes === null) continue
    sizesByDatabase.set(databaseId, Math.max(sizesByDatabase.get(databaseId) ?? 0, sizeBytes))
  }

  const usedBytes = Array.from(sizesByDatabase.values()).reduce((total, value) => total + value, 0)
  const limitBytes = accountLimitBytes(env)
  const measuredAt = Date.now()
  return {
    usedBytes,
    limitBytes,
    percent: percent(usedBytes, limitBytes),
    databaseCount: sizesByDatabase.size,
    measuredAt,
  }
}

export async function getAccountD1Storage(env: Bindings): Promise<AccountD1StorageResult> {
  const accountTag = env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim()
  if (!accountTag || !apiToken) {
    return { usage: null, status: 'not-configured' }
  }

  const cached = await readCachedAccountUsage(env)
  if (cached) return { usage: cached, status: 'available' }

  try {
    const usage = await queryAccountD1Storage(env)
    if (!usage) return { usage: null, status: 'not-configured' }
    await writeCachedAccountUsage(usage)
    return { usage, status: 'available' }
  } catch (error) {
    console.error('D1 account storage analytics failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    })
    return { usage: null, status: 'error' }
  }
}

export async function getDatabaseUsageStats(db: D1Database, env: Bindings): Promise<DatabaseUsageStats> {
  const [tableResult, accountResult] = await Promise.all([
    db.prepare(TABLE_USAGE_QUERY).all<TableUsageRow>(),
    getAccountD1Storage(env),
  ])
  const tables = tableResult.results.map((row) => ({
    name: row.table_name,
    rowCount: Math.max(0, Number(row.row_count) || 0),
  }))
  const databaseSizeBytes = Math.max(0, Number(tableResult.meta.size_after) || 0)
  const databaseLimit = databaseLimitBytes(env)

  return {
    databaseSizeBytes,
    databaseLimitBytes: databaseLimit,
    databasePercent: percent(databaseSizeBytes, databaseLimit),
    totalRows: tables.reduce((total, table) => total + table.rowCount, 0),
    tables,
    measuredAt: Date.now(),
    account: accountResult.usage,
    accountStatus: accountResult.status,
  }
}

export function accountStorageStatusMessage(status: AccountD1StorageStatus): string {
  if (status === 'not-configured') {
    return 'CLOUDFLARE_ACCOUNT_ID와 CLOUDFLARE_API_TOKEN을 설정하면 계정 전체 D1 용량을 조회할 수 있습니다.'
  }
  if (status === 'error') {
    return 'Cloudflare D1 Analytics 조회에 실패했습니다. API 토큰의 Account Analytics Read 권한과 계정 ID를 확인하세요.'
  }
  return ''
}
