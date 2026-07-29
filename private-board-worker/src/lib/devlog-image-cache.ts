import type {
  DevlogImageCacheFileStatsRow,
  DevlogImageCacheRequestRow,
  DevlogImageCacheStatus,
  PaginatedResult,
} from '../types'
import type { AllowedImageExtension } from '../shared/images'

export const DEVLOG_IMAGE_CACHE_HEADER = 'X-Devlog-Image-Cache'
export const DEVLOG_IMAGE_CACHE_PAGE_SIZE = 25
export const DEVLOG_IMAGE_CACHE_REQUEST_LIMIT = 1000
const MAX_ADMIN_PAGE = 10_000

export interface DevlogImageCacheAccess {
  hash: string
  extension: AllowedImageExtension
  method: 'GET' | 'HEAD'
  cacheStatus: DevlogImageCacheStatus
  responseStatus: number
  durationMs: number
  colo: string | null
}

export function adminPageNumber(value: string | undefined): number {
  if (!value || !/^[1-9][0-9]*$/u.test(value)) return 1
  return Math.min(Number.parseInt(value, 10), MAX_ADMIN_PAGE)
}

export function matchesIfNoneMatch(value: string | undefined, etag: string | null): boolean {
  if (!value || !etag) return false
  const normalizedEtag = etag.replace(/^W\//iu, '')
  return value.split(',').some((candidate) => {
    const normalizedCandidate = candidate.trim()
    return normalizedCandidate === '*' || normalizedCandidate.replace(/^W\//iu, '') === normalizedEtag
  })
}

export async function recordDevlogImageCacheAccess(
  db: D1Database,
  access: DevlogImageCacheAccess,
): Promise<void> {
  const now = Date.now()
  const durationMs = Math.max(0, Math.round(access.durationMs))
  const hitIncrement = access.cacheStatus === 'HIT' ? 1 : 0
  const missIncrement = access.cacheStatus === 'MISS' ? 1 : 0

  await db.batch([
    db
      .prepare(
        `
        INSERT INTO devlog_image_cache_requests (
          image_hash,
          extension,
          method,
          cache_status,
          response_status,
          duration_ms,
          colo,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        `,
      )
      .bind(
        access.hash,
        access.extension,
        access.method,
        access.cacheStatus,
        access.responseStatus,
        durationMs,
        access.colo,
        now,
      ),
    db
      .prepare(
        `
        INSERT INTO devlog_image_cache_file_stats (
          image_hash,
          extension,
          hit_count,
          miss_count,
          request_count,
          last_cache_status,
          last_response_status,
          last_accessed_at
        )
        VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?7)
        ON CONFLICT(image_hash, extension) DO UPDATE SET
          hit_count = hit_count + excluded.hit_count,
          miss_count = miss_count + excluded.miss_count,
          request_count = request_count + 1,
          last_cache_status = CASE
            WHEN excluded.last_accessed_at >= last_accessed_at
              THEN excluded.last_cache_status
            ELSE last_cache_status
          END,
          last_response_status = CASE
            WHEN excluded.last_accessed_at >= last_accessed_at
              THEN excluded.last_response_status
            ELSE last_response_status
          END,
          last_accessed_at = MAX(last_accessed_at, excluded.last_accessed_at)
        `,
      )
      .bind(
        access.hash,
        access.extension,
        hitIncrement,
        missIncrement,
        access.cacheStatus,
        access.responseStatus,
        now,
      ),
    db.prepare(
      `
      DELETE FROM devlog_image_cache_requests
      WHERE id <= COALESCE(
        (
          SELECT id
          FROM devlog_image_cache_requests
          ORDER BY id DESC
          LIMIT 1 OFFSET ${DEVLOG_IMAGE_CACHE_REQUEST_LIMIT}
        ),
        0
      )
      `,
    ),
  ])
}

function pagination(totalItems: number, requestedPage: number): Omit<PaginatedResult<never>, 'items'> {
  const totalPages = Math.max(1, Math.ceil(totalItems / DEVLOG_IMAGE_CACHE_PAGE_SIZE))
  const page = Math.min(Math.max(requestedPage, 1), totalPages)
  return {
    page,
    pageSize: DEVLOG_IMAGE_CACHE_PAGE_SIZE,
    totalItems,
    totalPages,
  }
}

export async function listDevlogImageCacheRequests(
  db: D1Database,
  requestedPage: number,
): Promise<PaginatedResult<DevlogImageCacheRequestRow>> {
  const count = await db
    .prepare('SELECT COUNT(*) AS count FROM devlog_image_cache_requests')
    .first<{ count: number }>()
  const pageInfo = pagination(count?.count ?? 0, requestedPage)
  const result = await db
    .prepare(
      `
      SELECT
        id,
        image_hash,
        extension,
        method,
        cache_status,
        response_status,
        duration_ms,
        colo,
        created_at
      FROM devlog_image_cache_requests
      ORDER BY id DESC
      LIMIT ?1 OFFSET ?2
      `,
    )
    .bind(pageInfo.pageSize, (pageInfo.page - 1) * pageInfo.pageSize)
    .all<DevlogImageCacheRequestRow>()

  return { items: result.results, ...pageInfo }
}

export async function listDevlogImageCacheFileStats(
  db: D1Database,
  requestedPage: number,
): Promise<PaginatedResult<DevlogImageCacheFileStatsRow>> {
  const count = await db
    .prepare('SELECT COUNT(*) AS count FROM devlog_image_cache_file_stats')
    .first<{ count: number }>()
  const pageInfo = pagination(count?.count ?? 0, requestedPage)
  const result = await db
    .prepare(
      `
      SELECT
        image_hash,
        extension,
        hit_count,
        miss_count,
        request_count,
        last_cache_status,
        last_response_status,
        last_accessed_at
      FROM devlog_image_cache_file_stats
      ORDER BY last_accessed_at DESC, image_hash, extension
      LIMIT ?1 OFFSET ?2
      `,
    )
    .bind(pageInfo.pageSize, (pageInfo.page - 1) * pageInfo.pageSize)
    .all<DevlogImageCacheFileStatsRow>()

  return { items: result.results, ...pageInfo }
}
