import type {
  AdminMemberActivityRow,
  AdminMemberRow,
  BoardRow,
  CommentRow,
  CurrentUser,
  DashboardWidgetRow,
  DevlogAuthor,
  DevlogAuthorRow,
  DevlogExportPostRow,
  DevlogPostListRow,
  ImageServiceSettings,
  ImageExtension,
  MemoLinkMode,
  MemoRow,
  MemoUrlPatternRow,
  MemoUrlSettings,
  PaginatedResult,
  PersonalBookmarkRow,
  PrivateImageRow,
  PostDetailRow,
  PostBodyFormat,
  PostListRow,
  PostVisibility,
  PostImageLinkRow,
  TicketLogAction,
  TicketLogRow,
  TicketLane,
  TicketChecklistItem,
  TicketChecklistItemInput,
  TicketRow,
  TicketTagColor,
  TicketTagRow,
  TicketTagTextColor,
  TrashedTicketRow,
} from '../types'
import { firstDevlogImageSource } from './devlog-preview'
import {
  moveToPreviousPageOrder,
  PERSONAL_BOOKMARKS_PER_PAGE,
  type PersonalBookmarkIconData,
} from './personal-bookmarks'

export const POSTS_PER_PAGE = 20
export const DASHBOARD_POSTS_LIMIT = 5
export const MAX_TICKETS_PER_USER = 200
export const MAX_TICKET_TAGS_PER_USER = 50
export const MAX_TICKET_CHECKLIST_ITEMS = 50
export const TICKET_LOG_PAGE_SIZES = [50, 100, 200, 500] as const
export const DEFAULT_TICKET_LOG_PAGE_SIZE = TICKET_LOG_PAGE_SIZES[0]
export const TICKET_TRASH_RETENTION_MS = 14 * 24 * 60 * 60 * 1000
export const MAX_MEMOS_PER_USER = 1000
export const MAX_MEMO_PATTERNS_PER_USER = 50
export const MAX_RSS_WIDGETS_PER_USER = 10
export const MAX_PRIVATE_IMAGES_PER_USER = 5000
export const DEVLOG_POSTS_PER_PAGE = 12
export const DEVLOG_EXPORT_POSTS_PER_PAGE = 50
export const ADMIN_MEMBERS_PER_PAGE = 50
export const ADMIN_MEMBER_ACTIVITIES_PER_PAGE = 50

export interface ImageServiceRecord {
  base_url: string
  token_ciphertext: string
  enabled: number
  updated_at: number
}

const IMAGE_SERVICE_SETTINGS_CACHE_TTL_MS = 5_000
const imageServiceSettingsCache = new WeakMap<object, {
  value: ImageServiceSettings
  expiresAt: number
}>()

export async function getImageServiceRecord(db: D1Database): Promise<ImageServiceRecord | null> {
  return db
    .prepare(
      `SELECT base_url, token_ciphertext, enabled, updated_at
       FROM image_service_settings
       WHERE singleton_id = 1
       LIMIT 1`,
    )
    .first<ImageServiceRecord>()
}

export async function getImageServiceSettings(db: D1Database): Promise<ImageServiceSettings> {
  const cached = imageServiceSettingsCache.get(db as object)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const record = await getImageServiceRecord(db)
  const value = {
    configured: record !== null,
    enabled: record?.enabled === 1,
    updatedAt: record?.updated_at ?? null,
  }
  imageServiceSettingsCache.set(db as object, {
    value,
    expiresAt: Date.now() + IMAGE_SERVICE_SETTINGS_CACHE_TTL_MS,
  })
  return value
}

export function clearImageServiceSettingsCache(db: D1Database): void {
  imageServiceSettingsCache.delete(db as object)
}

export async function saveImageServiceSettings(
  db: D1Database,
  tokenCiphertext: string,
  updatedBy: string,
): Promise<void> {
  const now = Date.now()
  await db
    .prepare(
      `INSERT INTO image_service_settings (
         singleton_id, base_url, token_ciphertext, enabled, updated_by, updated_at
       ) VALUES (1, ?1, ?2, 1, ?3, ?4)
       ON CONFLICT(singleton_id) DO UPDATE SET
         base_url = excluded.base_url,
         token_ciphertext = excluded.token_ciphertext,
         enabled = 1,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`,
    )
    .bind('vpc://image-vault', tokenCiphertext, updatedBy, now)
    .run()
  clearImageServiceSettingsCache(db)
}

export async function setImageServiceEnabled(
  db: D1Database,
  enabled: boolean,
  updatedBy: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE image_service_settings
       SET enabled = ?1, updated_by = ?2, updated_at = ?3
       WHERE singleton_id = 1`,
    )
    .bind(enabled ? 1 : 0, updatedBy, Date.now())
    .run()
  clearImageServiceSettingsCache(db)
  return result.meta.changes > 0
}

export async function listAdminMembers(
  db: D1Database,
  page: number,
): Promise<PaginatedResult<AdminMemberRow>> {
  const total = await db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>()
  const totalItems = total?.count ?? 0
  const totalPages = Math.ceil(totalItems / ADMIN_MEMBERS_PER_PAGE)
  const offset = (page - 1) * ADMIN_MEMBERS_PER_PAGE
  const result = await db
    .prepare(
      `
      WITH
        google_accounts AS (
          SELECT user_id, MIN(email) AS email
          FROM auth_accounts
          WHERE provider = 'google'
          GROUP BY user_id
        ),
        post_stats AS (
          SELECT author_id, COUNT(*) AS post_count, MAX(created_at) AS latest_post_at
          FROM posts
          GROUP BY author_id
        ),
        comment_stats AS (
          SELECT author_id, COUNT(*) AS comment_count, MAX(created_at) AS latest_comment_at
          FROM comments
          GROUP BY author_id
        ),
        session_stats AS (
          SELECT user_id, MAX(last_seen_at) AS last_seen_at
          FROM sessions
          GROUP BY user_id
        )
      SELECT
        u.id,
        u.nickname,
        ga.email,
        u.email_hidden,
        u.role,
        u.status,
        u.created_at,
        u.updated_at,
        COALESCE(ps.post_count, 0) AS post_count,
        COALESCE(cs.comment_count, 0) AS comment_count,
        ss.last_seen_at,
        CASE
          WHEN ps.latest_post_at IS NULL THEN cs.latest_comment_at
          WHEN cs.latest_comment_at IS NULL THEN ps.latest_post_at
          WHEN ps.latest_post_at >= cs.latest_comment_at THEN ps.latest_post_at
          ELSE cs.latest_comment_at
        END AS last_activity_at
      FROM users u
      LEFT JOIN google_accounts ga ON ga.user_id = u.id
      LEFT JOIN post_stats ps ON ps.author_id = u.id
      LEFT JOIN comment_stats cs ON cs.author_id = u.id
      LEFT JOIN session_stats ss ON ss.user_id = u.id
      ORDER BY u.created_at DESC, u.id ASC
      LIMIT ?1 OFFSET ?2
      `,
    )
    .bind(ADMIN_MEMBERS_PER_PAGE, offset)
    .all<AdminMemberRow>()

  return {
    items: result.results,
    page,
    pageSize: ADMIN_MEMBERS_PER_PAGE,
    totalItems,
    totalPages,
  }
}

export async function getAdminMember(db: D1Database, memberId: string): Promise<AdminMemberRow | null> {
  return db
    .prepare(
      `
      WITH
        google_accounts AS (
          SELECT user_id, MIN(email) AS email
          FROM auth_accounts
          WHERE provider = 'google'
          GROUP BY user_id
        ),
        post_stats AS (
          SELECT author_id, COUNT(*) AS post_count, MAX(created_at) AS latest_post_at
          FROM posts
          GROUP BY author_id
        ),
        comment_stats AS (
          SELECT author_id, COUNT(*) AS comment_count, MAX(created_at) AS latest_comment_at
          FROM comments
          GROUP BY author_id
        ),
        session_stats AS (
          SELECT user_id, MAX(last_seen_at) AS last_seen_at
          FROM sessions
          GROUP BY user_id
        )
      SELECT
        u.id,
        u.nickname,
        ga.email,
        u.email_hidden,
        u.role,
        u.status,
        u.created_at,
        u.updated_at,
        COALESCE(ps.post_count, 0) AS post_count,
        COALESCE(cs.comment_count, 0) AS comment_count,
        ss.last_seen_at,
        CASE
          WHEN ps.latest_post_at IS NULL THEN cs.latest_comment_at
          WHEN cs.latest_comment_at IS NULL THEN ps.latest_post_at
          WHEN ps.latest_post_at >= cs.latest_comment_at THEN ps.latest_post_at
          ELSE cs.latest_comment_at
        END AS last_activity_at
      FROM users u
      LEFT JOIN google_accounts ga ON ga.user_id = u.id
      LEFT JOIN post_stats ps ON ps.author_id = u.id
      LEFT JOIN comment_stats cs ON cs.author_id = u.id
      LEFT JOIN session_stats ss ON ss.user_id = u.id
      WHERE u.id = ?1
      LIMIT 1
      `,
    )
    .bind(memberId)
    .first<AdminMemberRow>()
}

export async function listAdminMemberActivities(
  db: D1Database,
  memberId: string,
  page: number,
): Promise<PaginatedResult<AdminMemberActivityRow>> {
  const total = await db
    .prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM posts WHERE author_id = ?1)
        + (SELECT COUNT(*) FROM comments WHERE author_id = ?1) AS count
      `,
    )
    .bind(memberId)
    .first<{ count: number }>()
  const totalItems = total?.count ?? 0
  const totalPages = Math.ceil(totalItems / ADMIN_MEMBER_ACTIVITIES_PER_PAGE)
  const offset = (page - 1) * ADMIN_MEMBER_ACTIVITIES_PER_PAGE
  const result = await db
    .prepare(
      `
      SELECT *
      FROM (
        SELECT
          'post' AS kind,
          p.id AS activity_id,
          p.id AS post_id,
          p.author_id AS post_author_id,
          b.slug AS board_slug,
          p.title AS post_title,
          p.body,
          p.status,
          p.visibility,
          p.created_at,
          p.updated_at
        FROM posts p
        JOIN boards b ON b.id = p.board_id
        WHERE p.author_id = ?1

        UNION ALL

        SELECT
          'comment' AS kind,
          c.id AS activity_id,
          c.post_id,
          p.author_id AS post_author_id,
          b.slug AS board_slug,
          p.title AS post_title,
          c.body,
          c.status,
          p.visibility,
          c.created_at,
          c.updated_at
        FROM comments c
        JOIN posts p ON p.id = c.post_id
        JOIN boards b ON b.id = p.board_id
        WHERE c.author_id = ?1
      )
      ORDER BY created_at DESC, kind ASC, activity_id DESC
      LIMIT ?2 OFFSET ?3
      `,
    )
    .bind(memberId, ADMIN_MEMBER_ACTIVITIES_PER_PAGE, offset)
    .all<AdminMemberActivityRow>()

  return {
    items: result.results,
    page,
    pageSize: ADMIN_MEMBER_ACTIVITIES_PER_PAGE,
    totalItems,
    totalPages,
  }
}

const EMPTY_MEMO_URL_SETTINGS: MemoUrlSettings = {
  numeric_prefix: '',
  numeric_suffix: '',
  text_prefix: '',
  text_suffix: '',
}

export async function listBoards(db: D1Database): Promise<BoardRow[]> {
  const result = await db
    .prepare('SELECT id, slug, name, description, sort_order FROM boards ORDER BY sort_order, id')
    .all<BoardRow>()
  return result.results
}

export async function getBoardBySlug(db: D1Database, slug: string): Promise<BoardRow | null> {
  return db
    .prepare('SELECT id, slug, name, description, sort_order FROM boards WHERE slug = ?1 LIMIT 1')
    .bind(slug)
    .first<BoardRow>()
}

export async function listPosts(
  db: D1Database,
  boardId: number,
  beforeId: number | null,
): Promise<{ posts: PostListRow[]; hasMore: boolean }> {
  const baseSql = `
    SELECT
      p.id,
      p.board_id,
      b.slug AS board_slug,
      b.name AS board_name,
      p.author_id,
      u.nickname AS author_nickname,
      u.role AS author_role,
      p.title,
      p.comment_count,
      p.view_count,
      p.created_at,
      p.updated_at
    FROM posts p
    JOIN boards b ON b.id = p.board_id
    JOIN users u ON u.id = p.author_id
    WHERE p.board_id = ?1
      AND p.status = 'published'
  `

  const statement = beforeId
    ? db
        .prepare(`${baseSql} AND p.id < ?2 ORDER BY p.id DESC LIMIT ?3`)
        .bind(boardId, beforeId, POSTS_PER_PAGE + 1)
    : db.prepare(`${baseSql} ORDER BY p.id DESC LIMIT ?2`).bind(boardId, POSTS_PER_PAGE + 1)

  const result = await statement.all<PostListRow>()
  return {
    posts: result.results.slice(0, POSTS_PER_PAGE),
    hasMore: result.results.length > POSTS_PER_PAGE,
  }
}

export async function listRecentPostsByBoardSlug(
  db: D1Database,
  boardSlug: string,
  limit = DASHBOARD_POSTS_LIMIT,
): Promise<PostListRow[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), DASHBOARD_POSTS_LIMIT)
  const result = await db
    .prepare(
      `
      SELECT
        p.id,
        p.board_id,
        b.slug AS board_slug,
        b.name AS board_name,
        p.author_id,
        u.nickname AS author_nickname,
        u.role AS author_role,
        p.title,
        p.comment_count,
        p.view_count,
        p.created_at,
        p.updated_at
      FROM posts p
      JOIN boards b ON b.id = p.board_id
      JOIN users u ON u.id = p.author_id
      WHERE b.slug = ?1
        AND p.status = 'published'
        AND (?1 != 'development' OR p.visibility = 'public')
      ORDER BY p.id DESC
      LIMIT ?2
      `,
    )
    .bind(boardSlug, safeLimit)
    .all<PostListRow>()
  return result.results
}

export async function listDevlogAuthors(db: D1Database): Promise<DevlogAuthorRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        u.id,
        u.nickname,
        u.role,
        COUNT(p.id) AS public_post_count,
        MAX(p.created_at) AS latest_post_at
      FROM users u
      JOIN posts p ON p.author_id = u.id
      JOIN boards b ON b.id = p.board_id
      WHERE b.slug = 'development'
        AND p.status = 'published'
        AND p.visibility = 'public'
        AND u.status = 'active'
      GROUP BY u.id, u.nickname, u.role
      ORDER BY latest_post_at DESC, u.nickname COLLATE NOCASE
      LIMIT 100
      `,
    )
    .all<DevlogAuthorRow>()
  return result.results
}

export async function getDevlogAuthor(db: D1Database, authorId: string): Promise<DevlogAuthor | null> {
  return db
    .prepare(
      `SELECT id, nickname, role
       FROM users
       WHERE id = ?1 AND status = 'active'
       LIMIT 1`,
    )
    .bind(authorId)
    .first<DevlogAuthor>()
}

export async function listDevlogPosts(
  db: D1Database,
  authorId: string,
  includePrivate: boolean,
  beforeId: number | null,
): Promise<{ posts: DevlogPostListRow[]; hasMore: boolean }> {
  const baseSql = `
    SELECT
      p.id,
      p.board_id,
      b.slug AS board_slug,
      b.name AS board_name,
      p.author_id,
      u.nickname AS author_nickname,
      u.role AS author_role,
      p.title,
      p.body,
      p.body_format,
      p.visibility,
      p.preview_image_url,
      p.comment_count,
      p.view_count,
      p.created_at,
      p.updated_at
    FROM posts p
    JOIN boards b ON b.id = p.board_id
    JOIN users u ON u.id = p.author_id
    WHERE b.slug = 'development'
      AND p.author_id = ?1
      AND p.status = 'published'
      AND (?2 = 1 OR p.visibility = 'public')
  `
  const statement = beforeId
    ? db
        .prepare(`${baseSql} AND p.id < ?3 ORDER BY p.id DESC LIMIT ?4`)
        .bind(authorId, includePrivate ? 1 : 0, beforeId, DEVLOG_POSTS_PER_PAGE + 1)
    : db
        .prepare(`${baseSql} ORDER BY p.id DESC LIMIT ?3`)
        .bind(authorId, includePrivate ? 1 : 0, DEVLOG_POSTS_PER_PAGE + 1)
  const result = await statement.all<DevlogPostListRow>()
  return {
    posts: result.results.slice(0, DEVLOG_POSTS_PER_PAGE),
    hasMore: result.results.length > DEVLOG_POSTS_PER_PAGE,
  }
}

export async function listDevlogExportPostsPage(
  db: D1Database,
  authorId: string,
  snapshotMaxId: number,
  afterId: number | null,
): Promise<{ posts: DevlogExportPostRow[]; hasMore: boolean }> {
  const baseSql = `
    SELECT
      p.id,
      p.title,
      p.body,
      p.body_format,
      p.created_at
    FROM posts p
    JOIN boards b ON b.id = p.board_id
    WHERE b.slug = 'development'
      AND p.author_id = ?1
      AND p.status = 'published'
      AND p.id <= ?2
  `
  const statement = afterId
    ? db
        .prepare(`${baseSql} AND p.id > ?3 ORDER BY p.id ASC LIMIT ?4`)
        .bind(authorId, snapshotMaxId, afterId, DEVLOG_EXPORT_POSTS_PER_PAGE + 1)
    : db
        .prepare(`${baseSql} ORDER BY p.id ASC LIMIT ?3`)
        .bind(authorId, snapshotMaxId, DEVLOG_EXPORT_POSTS_PER_PAGE + 1)
  const result = await statement.all<DevlogExportPostRow>()
  return {
    posts: result.results.slice(0, DEVLOG_EXPORT_POSTS_PER_PAGE),
    hasMore: result.results.length > DEVLOG_EXPORT_POSTS_PER_PAGE,
  }
}

export async function getDevlogExportSnapshot(
  db: D1Database,
  authorId: string,
): Promise<{ total: number; maxId: number }> {
  const row = await db
    .prepare(
      `
      SELECT
        COUNT(p.id) AS total,
        COALESCE(MAX(p.id), 0) AS max_id
      FROM posts p
      JOIN boards b ON b.id = p.board_id
      WHERE b.slug = 'development'
        AND p.author_id = ?1
        AND p.status = 'published'
      `,
    )
    .bind(authorId)
    .first<{ total: number; max_id: number }>()
  return {
    total: Number(row?.total ?? 0),
    maxId: Number(row?.max_id ?? 0),
  }
}

export async function ensureUserDashboard(db: D1Database, userId: string): Promise<void> {
  const now = Date.now()
  const dashboard = await db
    .prepare(
      `
      INSERT OR IGNORE INTO user_dashboards (user_id, created_at, updated_at)
      VALUES (?1, ?2, ?2)
      `,
    )
    .bind(userId, now)
    .run()

  if (dashboard.meta.changes > 0) {
    await db
      .prepare(
        `
        INSERT INTO dashboard_widgets (user_id, widget_type, title, url, sort_order, created_at)
        VALUES (?1, 'free-board', NULL, NULL, 1000, ?2)
        `,
      )
      .bind(userId, now)
      .run()
  }
}

export async function listDashboardWidgets(db: D1Database, userId: string): Promise<DashboardWidgetRow[]> {
  const result = await db
    .prepare(
      `
      SELECT id, user_id, widget_type, title, url, icon_url, icon_color, compact_mode, sort_order, created_at
      FROM dashboard_widgets
      WHERE user_id = ?1
      ORDER BY sort_order, widget_type
      `,
    )
    .bind(userId)
    .all<DashboardWidgetRow>()
  return result.results
}

async function nextDashboardWidgetOrder(db: D1Database, userId: string): Promise<number> {
  const order = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) + 1000 AS next_order FROM dashboard_widgets WHERE user_id = ?1')
    .bind(userId)
    .first<{ next_order: number }>()
  return order?.next_order ?? 1000
}

export async function addFreeBoardDashboardWidget(
  db: D1Database,
  userId: string,
): Promise<void> {
  await ensureUserDashboard(db, userId)
  const now = Date.now()
  const sortOrder = await nextDashboardWidgetOrder(db, userId)

  await db
    .prepare(
      `
      INSERT OR IGNORE INTO dashboard_widgets (user_id, widget_type, title, url, sort_order, created_at)
      VALUES (?1, 'free-board', NULL, NULL, ?2, ?3)
      `,
    )
    .bind(userId, sortOrder, now)
    .run()
}

export async function addBookmarkDashboardWidget(
  db: D1Database,
  userId: string,
  title: string,
  url: string,
  iconUrl: string | null,
  iconColor: DashboardWidgetRow['icon_color'],
  compactMode: boolean,
  creationRequestId: string,
): Promise<number> {
  await ensureUserDashboard(db, userId)
  const now = Date.now()
  const sortOrder = await nextDashboardWidgetOrder(db, userId)
  const result = await db
    .prepare(
      `
      INSERT INTO dashboard_widgets (
        user_id,
        widget_type,
        title,
        url,
        icon_url,
        icon_color,
        compact_mode,
        sort_order,
        created_at,
        create_request_id
      )
      VALUES (?1, 'bookmark', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      ON CONFLICT DO NOTHING
      `,
    )
    .bind(userId, title, url, iconUrl, iconColor, compactMode && iconUrl ? 1 : 0, sortOrder, now, creationRequestId)
    .run()

  if (result.meta.changes > 0 && result.meta.last_row_id) {
    return result.meta.last_row_id
  }

  const existing = await db
    .prepare(
      `
      SELECT id
      FROM dashboard_widgets
      WHERE user_id = ?1 AND create_request_id = ?2
      LIMIT 1
      `,
    )
    .bind(userId, creationRequestId)
    .first<{ id: number }>()
  if (existing) return existing.id

  throw new Error('북마크 위젯을 추가할 수 없습니다.')
}

export async function getBookmarkDashboardWidget(
  db: D1Database,
  userId: string,
  widgetId: number,
): Promise<DashboardWidgetRow | null> {
  return db
    .prepare(
      `
      SELECT id, user_id, widget_type, title, url, icon_url, icon_color, compact_mode, sort_order, created_at
      FROM dashboard_widgets
      WHERE id = ?1 AND user_id = ?2 AND widget_type = 'bookmark'
      LIMIT 1
      `,
    )
    .bind(widgetId, userId)
    .first<DashboardWidgetRow>()
}

export async function updateBookmarkDashboardWidget(
  db: D1Database,
  userId: string,
  widgetId: number,
  title: string,
  url: string,
  iconUrl: string | null,
  iconColor: DashboardWidgetRow['icon_color'],
  compactMode: boolean,
): Promise<boolean> {
  const result = await db
    .prepare(
      `
      UPDATE dashboard_widgets
      SET title = ?1,
          url = ?2,
          icon_url = ?3,
          icon_color = ?4,
          compact_mode = CASE WHEN ?5 = 1 AND ?3 IS NOT NULL THEN 1 ELSE 0 END,
          icon_content_type = NULL,
          icon_data = NULL,
          icon_updated_at = NULL
      WHERE id = ?6 AND user_id = ?7 AND widget_type = 'bookmark'
      `,
    )
    .bind(title, url, iconUrl, iconColor, compactMode ? 1 : 0, widgetId, userId)
    .run()
  return result.meta.changes > 0
}

export async function saveBookmarkDashboardIcon(
  db: D1Database,
  userId: string,
  widgetId: number,
  contentType: string,
  bytes: Uint8Array,
): Promise<boolean> {
  const result = await db
    .prepare(
      `
      UPDATE dashboard_widgets
      SET icon_content_type = ?1, icon_data = ?2, icon_updated_at = ?3
      WHERE id = ?4 AND user_id = ?5 AND widget_type = 'bookmark'
      `,
    )
    .bind(contentType, bytes, Date.now(), widgetId, userId)
    .run()
  return result.meta.changes > 0
}

export async function addRssDashboardWidget(
  db: D1Database,
  userId: string,
  title: string,
  url: string,
): Promise<number> {
  await ensureUserDashboard(db, userId)
  const now = Date.now()
  const sortOrder = await nextDashboardWidgetOrder(db, userId)
  const result = await db
    .prepare(
      `
      INSERT INTO dashboard_widgets (user_id, widget_type, title, url, sort_order, created_at)
      SELECT ?1, 'rss', ?2, ?3, ?4, ?5
      WHERE (
        SELECT COUNT(*)
        FROM dashboard_widgets
        WHERE user_id = ?1 AND widget_type = 'rss'
      ) < ?6
      `,
    )
    .bind(userId, title, url, sortOrder, now, MAX_RSS_WIDGETS_PER_USER)
    .run()

  if (result.meta.changes === 0) {
    throw new Error(`RSS 위젯은 최대 ${MAX_RSS_WIDGETS_PER_USER}개까지 추가할 수 있습니다.`)
  }
  const widgetId = result.meta.last_row_id
  if (!widgetId) throw new Error('RSS 위젯 ID를 확인할 수 없습니다.')
  return widgetId
}

export async function removeDashboardWidget(
  db: D1Database,
  userId: string,
  widgetId: number,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM dashboard_widgets WHERE user_id = ?1 AND id = ?2')
    .bind(userId, widgetId)
    .run()
  return result.meta.changes > 0
}

export async function reorderDashboardWidgets(
  db: D1Database,
  userId: string,
  widgetIds: number[],
): Promise<void> {
  if (new Set(widgetIds).size !== widgetIds.length) {
    throw new Error('중복된 위젯 ID가 있습니다.')
  }

  const existingResult = await db
    .prepare('SELECT id FROM dashboard_widgets WHERE user_id = ?1 ORDER BY id')
    .bind(userId)
    .all<{ id: number }>()
  const existing = existingResult.results.map((row) => row.id).sort((a, b) => a - b)
  const incoming = [...widgetIds].sort((a, b) => a - b)

  if (existing.length !== incoming.length || existing.some((id, index) => id !== incoming[index])) {
    throw new Error('위젯 목록이 최신 상태가 아닙니다. 페이지를 새로고침하세요.')
  }
  if (widgetIds.length === 0) return

  const statements = widgetIds.map((id, index) =>
    db
      .prepare(
        `
        UPDATE dashboard_widgets
        SET sort_order = ?1
        WHERE id = ?2 AND user_id = ?3
        `,
      )
      .bind((index + 1) * 1000, id, userId),
  )

  await db.batch(statements)
}

export async function listPersonalBookmarks(
  db: D1Database,
  userId: string,
  page: number,
): Promise<PaginatedResult<PersonalBookmarkRow>> {
  const total = await db
    .prepare('SELECT COUNT(*) AS count FROM personal_bookmarks WHERE user_id = ?1')
    .bind(userId)
    .first<{ count: number }>()
  const totalItems = Number(total?.count ?? 0)
  const totalPages = Math.ceil(totalItems / PERSONAL_BOOKMARKS_PER_PAGE)
  const offset = (page - 1) * PERSONAL_BOOKMARKS_PER_PAGE
  const result = await db
    .prepare(
      `
      SELECT id, user_id, content, url, icon_content_type, sort_order, created_at, updated_at
      FROM personal_bookmarks
      WHERE user_id = ?1
      ORDER BY sort_order, id
      LIMIT ?2 OFFSET ?3
      `,
    )
    .bind(userId, PERSONAL_BOOKMARKS_PER_PAGE, offset)
    .all<PersonalBookmarkRow>()

  return {
    items: result.results,
    page,
    pageSize: PERSONAL_BOOKMARKS_PER_PAGE,
    totalItems,
    totalPages,
  }
}

export async function addPersonalBookmark(
  db: D1Database,
  userId: string,
  content: string,
  url: string,
  icon: PersonalBookmarkIconData,
  requestId: string,
): Promise<number> {
  const now = Date.now()
  const order = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) + 1000 AS next_order FROM personal_bookmarks WHERE user_id = ?1')
    .bind(userId)
    .first<{ next_order: number }>()
  const result = await db
    .prepare(
      `
      INSERT INTO personal_bookmarks (
        user_id,
        content,
        url,
        icon_content_type,
        icon_data,
        sort_order,
        create_request_id,
        created_at,
        updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
      ON CONFLICT DO NOTHING
      `,
    )
    .bind(
      userId,
      content,
      url,
      icon.contentType,
      icon.bytes,
      order?.next_order ?? 1000,
      requestId,
      now,
    )
    .run()

  if (result.meta.changes > 0 && result.meta.last_row_id) return result.meta.last_row_id

  const existing = await db
    .prepare(
      `
      SELECT id
      FROM personal_bookmarks
      WHERE user_id = ?1 AND create_request_id = ?2
      LIMIT 1
      `,
    )
    .bind(userId, requestId)
    .first<{ id: number }>()
  if (existing) return existing.id
  throw new Error('개인 북마크를 추가할 수 없습니다.')
}

export async function personalBookmarkPageForId(
  db: D1Database,
  userId: string,
  bookmarkId: number,
): Promise<number | null> {
  const row = await db
    .prepare(
      `
      SELECT (
        SELECT COUNT(*)
        FROM personal_bookmarks p
        WHERE p.user_id = target.user_id
          AND (
            p.sort_order < target.sort_order
            OR (p.sort_order = target.sort_order AND p.id <= target.id)
          )
      ) AS position
      FROM personal_bookmarks target
      WHERE target.id = ?1 AND target.user_id = ?2
      LIMIT 1
      `,
    )
    .bind(bookmarkId, userId)
    .first<{ position: number }>()
  if (!row) return null
  return Math.ceil(Number(row.position) / PERSONAL_BOOKMARKS_PER_PAGE)
}

export async function updatePersonalBookmark(
  db: D1Database,
  userId: string,
  bookmarkId: number,
  content: string,
  url: string,
  icon: PersonalBookmarkIconData | null,
): Promise<boolean> {
  const statement = icon
    ? db
        .prepare(
          `
          UPDATE personal_bookmarks
          SET content = ?1,
              url = ?2,
              icon_content_type = ?3,
              icon_data = ?4,
              updated_at = ?5
          WHERE id = ?6 AND user_id = ?7
          `,
        )
        .bind(content, url, icon.contentType, icon.bytes, Date.now(), bookmarkId, userId)
    : db
        .prepare(
          `
          UPDATE personal_bookmarks
          SET content = ?1, url = ?2, updated_at = ?3
          WHERE id = ?4 AND user_id = ?5
          `,
        )
        .bind(content, url, Date.now(), bookmarkId, userId)
  const result = await statement.run()
  return result.meta.changes > 0
}

export async function deletePersonalBookmark(
  db: D1Database,
  userId: string,
  bookmarkId: number,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM personal_bookmarks WHERE id = ?1 AND user_id = ?2')
    .bind(bookmarkId, userId)
    .run()
  return result.meta.changes > 0
}

export async function reorderPersonalBookmarksPage(
  db: D1Database,
  userId: string,
  page: number,
  bookmarkIds: number[],
): Promise<void> {
  if (new Set(bookmarkIds).size !== bookmarkIds.length) {
    throw new Error('중복된 개인 북마크 ID가 있습니다.')
  }

  const offset = (page - 1) * PERSONAL_BOOKMARKS_PER_PAGE
  const existingResult = await db
    .prepare(
      `
      SELECT id
      FROM personal_bookmarks
      WHERE user_id = ?1
      ORDER BY sort_order, id
      LIMIT ?2 OFFSET ?3
      `,
    )
    .bind(userId, PERSONAL_BOOKMARKS_PER_PAGE, offset)
    .all<{ id: number }>()
  const existing = existingResult.results.map((row) => row.id).sort((a, b) => a - b)
  const incoming = [...bookmarkIds].sort((a, b) => a - b)
  if (existing.length !== incoming.length || existing.some((id, index) => id !== incoming[index])) {
    throw new Error('개인 북마크 목록이 최신 상태가 아닙니다. 페이지를 새로고침하세요.')
  }
  if (bookmarkIds.length === 0) return

  const now = Date.now()
  await db.batch(
    bookmarkIds.map((id, index) =>
      db
        .prepare(
          `
          UPDATE personal_bookmarks
          SET sort_order = ?1, updated_at = ?2
          WHERE id = ?3 AND user_id = ?4
          `,
        )
        .bind((offset + index + 1) * 1000, now, id, userId),
    ),
  )
}

export async function movePersonalBookmarkToPreviousPage(
  db: D1Database,
  userId: string,
  page: number,
  bookmarkId: number,
): Promise<number> {
  if (page <= 1) throw new Error('첫 페이지에서는 앞 페이지로 보낼 수 없습니다.')

  const offset = (page - 2) * PERSONAL_BOOKMARKS_PER_PAGE
  const result = await db
    .prepare(
      `
      SELECT id
      FROM personal_bookmarks
      WHERE user_id = ?1
      ORDER BY sort_order, id
      LIMIT ?2 OFFSET ?3
      `,
    )
    .bind(userId, PERSONAL_BOOKMARKS_PER_PAGE * 2, offset)
    .all<{ id: number }>()
  const reordered = moveToPreviousPageOrder(
    result.results.map((row) => row.id),
    bookmarkId,
  )
  const now = Date.now()
  await db.batch(
    reordered.map((id, index) =>
      db
        .prepare(
          `
          UPDATE personal_bookmarks
          SET sort_order = ?1, updated_at = ?2
          WHERE id = ?3 AND user_id = ?4
          `,
        )
        .bind((offset + index + 1) * 1000, now, id, userId),
    ),
  )
  return page - 1
}

export async function getPost(db: D1Database, postId: number): Promise<PostDetailRow | null> {
  return db
    .prepare(
      `
      SELECT
        p.id,
        p.board_id,
        b.slug AS board_slug,
        b.name AS board_name,
        p.author_id,
        u.nickname AS author_nickname,
        u.role AS author_role,
        p.title,
        p.body,
        p.body_format,
        p.visibility,
        p.preview_image_url,
        p.comment_count,
        p.view_count,
        p.created_at,
        p.updated_at
      FROM posts p
      JOIN boards b ON b.id = p.board_id
      JOIN users u ON u.id = p.author_id
      WHERE p.id = ?1
        AND p.status = 'published'
      LIMIT 1
      `,
    )
    .bind(postId)
    .first<PostDetailRow>()
}

export async function incrementPostViewCount(db: D1Database, postId: number): Promise<boolean> {
  const result = await db
    .prepare(
      `
      UPDATE posts
      SET view_count = view_count + 1
      WHERE id = ?1
        AND status = 'published'
      `,
    )
    .bind(postId)
    .run()

  return result.meta.changes > 0
}

export async function listComments(db: D1Database, postId: number): Promise<CommentRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        c.id,
        c.post_id,
        c.author_id,
        u.nickname AS author_nickname,
        u.role AS author_role,
        c.body,
        c.created_at,
        c.updated_at
      FROM comments c
      JOIN users u ON u.id = c.author_id
      WHERE c.post_id = ?1
        AND c.status = 'published'
      ORDER BY c.id ASC
      `,
    )
    .bind(postId)
    .all<CommentRow>()
  return result.results
}

export async function createPost(
  db: D1Database,
  boardId: number,
  authorId: string,
  title: string,
  body: string,
  bodyFormat: PostBodyFormat = 'plain',
  visibility: PostVisibility = 'private',
): Promise<number> {
  const now = Date.now()
  const previewImageUrl = bodyFormat === 'rich' ? firstDevlogImageSource(body) : null
  const result = await db
    .prepare(
      `
      INSERT INTO posts (
        board_id, author_id, title, body, body_format, visibility,
        preview_image_url, status, comment_count, created_at, updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'published', 0, ?8, ?8)
      `,
    )
    .bind(boardId, authorId, title, body, bodyFormat, visibility, previewImageUrl, now)
    .run()

  const postId = result.meta.last_row_id
  if (!postId) throw new Error('게시글 ID를 확인할 수 없습니다.')
  return postId
}

export async function updatePost(
  db: D1Database,
  postId: number,
  title: string,
  body: string,
  bodyFormat: PostBodyFormat = 'plain',
  visibility: PostVisibility = 'private',
  resetPreviewImage = false,
): Promise<boolean> {
  const firstImageUrl = bodyFormat === 'rich' ? firstDevlogImageSource(body) : null
  const result = await db
    .prepare(
      `
      UPDATE posts
      SET title = ?1,
          body = ?2,
          body_format = ?3,
          visibility = ?4,
          preview_image_url = CASE
            WHEN ?5 = 1
              AND preview_image_url IS NOT NULL
              AND ?6 IS NOT NULL
              AND preview_image_url <> ?6
              THEN ?6
            ELSE COALESCE(preview_image_url, ?6)
          END,
          updated_at = ?7
      WHERE id = ?8 AND status = 'published'
      `,
    )
    .bind(title, body, bodyFormat, visibility, resetPreviewImage ? 1 : 0, firstImageUrl, Date.now(), postId)
    .run()
  return result.meta.changes > 0
}

export async function deletePost(db: D1Database, postId: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM posts WHERE id = ?1').bind(postId).run()
  return result.meta.changes > 0
}

export async function createComment(
  db: D1Database,
  postId: number,
  authorId: string,
  body: string,
): Promise<void> {
  const now = Date.now()
  await db.batch([
    db
      .prepare(
        `
        INSERT INTO comments (post_id, author_id, body, status, created_at, updated_at)
        VALUES (?1, ?2, ?3, 'published', ?4, ?4)
        `,
      )
      .bind(postId, authorId, body, now),
    db
      .prepare(
        `
        UPDATE posts
        SET comment_count = comment_count + 1, updated_at = updated_at
        WHERE id = ?1 AND status = 'published'
        `,
      )
      .bind(postId),
  ])
}

export async function getComment(db: D1Database, commentId: number): Promise<CommentRow | null> {
  return db
    .prepare(
      `
      SELECT
        c.id,
        c.post_id,
        c.author_id,
        u.nickname AS author_nickname,
        u.role AS author_role,
        c.body,
        c.created_at,
        c.updated_at
      FROM comments c
      JOIN users u ON u.id = c.author_id
      WHERE c.id = ?1 AND c.status = 'published'
      LIMIT 1
      `,
    )
    .bind(commentId)
    .first<CommentRow>()
}

export async function updateComment(db: D1Database, commentId: number, body: string): Promise<boolean> {
  const result = await db
    .prepare(
      `
      UPDATE comments
      SET body = ?1, updated_at = ?2
      WHERE id = ?3 AND status = 'published'
      `,
    )
    .bind(body, Date.now(), commentId)
    .run()
  return result.meta.changes > 0
}

export async function deleteComment(db: D1Database, commentId: number, postId: number): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM comments WHERE id = ?1 AND post_id = ?2')
    .bind(commentId, postId)
    .run()

  if (result.meta.changes > 0) {
    await db
      .prepare('UPDATE posts SET comment_count = MAX(comment_count - 1, 0) WHERE id = ?1')
      .bind(postId)
      .run()
  }
  return result.meta.changes > 0
}

export function canManageResource(user: CurrentUser, authorId: string): boolean {
  return user.role === 'admin' || user.id === authorId
}

export async function listTickets(db: D1Database, ownerId: string): Promise<TicketRow[]> {
  await purgeExpiredTickets(db, ownerId)
  const result = await db
    .prepare(
      `
      SELECT id, owner_id, title, note, lane, sort_order, checklist_enabled, created_at, updated_at, deleted_at, purge_after
      FROM tickets
      WHERE owner_id = ?1 AND deleted_at IS NULL
      ORDER BY
        CASE lane WHEN 'todo' THEN 1 WHEN 'doing' THEN 2 WHEN 'done' THEN 3 END,
        sort_order,
        id
      LIMIT ?2
      `,
    )
    .bind(ownerId, MAX_TICKETS_PER_USER + 1)
    .all<TicketRow>()

  if (result.results.length > MAX_TICKETS_PER_USER) {
    throw new Error(`작업 티켓은 사용자당 최대 ${MAX_TICKETS_PER_USER}개까지 지원합니다.`)
  }
  return attachTicketDetails(db, result.results)
}

export async function listTicketTags(db: D1Database, ownerId: string): Promise<TicketTagRow[]> {
  const result = await db
    .prepare(
      `
      SELECT id, owner_id, name, color, background_hex, text_color, text_hex, created_at, updated_at
      FROM ticket_tags
      WHERE owner_id = ?1
      ORDER BY name COLLATE NOCASE, id
      LIMIT ?2
      `,
    )
    .bind(ownerId, MAX_TICKET_TAGS_PER_USER + 1)
    .all<TicketTagRow>()
  if (result.results.length > MAX_TICKET_TAGS_PER_USER) {
    throw new Error(`태그는 사용자당 최대 ${MAX_TICKET_TAGS_PER_USER}개까지 지원합니다.`)
  }
  return result.results
}

export async function createTicketTag(
  db: D1Database,
  ownerId: string,
  name: string,
  color: TicketTagColor,
  backgroundHex: string | null,
  textColor: TicketTagTextColor,
  textHex: string | null,
): Promise<number> {
  const now = Date.now()
  const result = await db
    .prepare(
      `
      INSERT INTO ticket_tags (owner_id, name, color, background_hex, text_color, text_hex, created_at, updated_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7
      WHERE (SELECT COUNT(*) FROM ticket_tags WHERE owner_id = ?1) < ?8
        AND NOT EXISTS (
          SELECT 1 FROM ticket_tags WHERE owner_id = ?1 AND name = ?2 COLLATE NOCASE
        )
      `,
    )
    .bind(ownerId, name, color, backgroundHex, textColor, textHex, now, MAX_TICKET_TAGS_PER_USER)
    .run()
  if (result.meta.changes > 0 && result.meta.last_row_id) return result.meta.last_row_id

  const duplicate = await db
    .prepare('SELECT id FROM ticket_tags WHERE owner_id = ?1 AND name = ?2 COLLATE NOCASE LIMIT 1')
    .bind(ownerId, name)
    .first<{ id: number }>()
  if (duplicate) throw new Error('같은 이름의 태그가 이미 있습니다.')
  throw new Error(`태그는 사용자당 최대 ${MAX_TICKET_TAGS_PER_USER}개까지 만들 수 있습니다.`)
}

export async function deleteTicketTag(db: D1Database, ownerId: string, tagId: number): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM ticket_tags WHERE id = ?1 AND owner_id = ?2')
    .bind(tagId, ownerId)
    .run()
  return result.meta.changes > 0
}

async function attachTicketTags<T extends TicketRow>(db: D1Database, tickets: T[]): Promise<T[]> {
  if (tickets.length === 0) return tickets
  const placeholders = tickets.map(() => '?').join(', ')
  const result = await db
    .prepare(
      `
      SELECT links.ticket_id, tags.id, tags.owner_id, tags.name, tags.color, tags.background_hex, tags.text_color, tags.text_hex, tags.created_at, tags.updated_at
      FROM ticket_tag_links AS links
      INNER JOIN ticket_tags AS tags ON tags.id = links.tag_id
      WHERE links.ticket_id IN (${placeholders})
      ORDER BY tags.name COLLATE NOCASE, tags.id
      `,
    )
    .bind(...tickets.map((ticket) => ticket.id))
    .all<TicketTagRow & { ticket_id: number }>()
  const byTicket = new Map<number, TicketTagRow[]>()
  for (const row of result.results) {
    const tags = byTicket.get(row.ticket_id) ?? []
    tags.push({
      id: row.id,
      owner_id: row.owner_id,
      name: row.name,
      color: row.color,
      background_hex: row.background_hex,
      text_color: row.text_color,
      text_hex: row.text_hex,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
    byTicket.set(row.ticket_id, tags)
  }
  return tickets.map((ticket) => ({ ...ticket, tags: byTicket.get(ticket.id) ?? [] }))
}

async function attachTicketChecklists<T extends TicketRow>(db: D1Database, tickets: T[]): Promise<T[]> {
  if (tickets.length === 0) return tickets
  const placeholders = tickets.map(() => '?').join(', ')
  const result = await db
    .prepare(
      `
      SELECT id, ticket_id, title, completed, sort_order, created_at, updated_at
      FROM ticket_checklist_items
      WHERE ticket_id IN (${placeholders})
      ORDER BY ticket_id, sort_order, id
      `,
    )
    .bind(...tickets.map((ticket) => ticket.id))
    .all<TicketChecklistItem>()
  const byTicket = new Map<number, TicketChecklistItem[]>()
  for (const item of result.results) {
    const items = byTicket.get(item.ticket_id) ?? []
    items.push(item)
    byTicket.set(item.ticket_id, items)
  }
  return tickets.map((ticket) => ({ ...ticket, checklist_items: byTicket.get(ticket.id) ?? [] }))
}

async function attachTicketDetails<T extends TicketRow>(db: D1Database, tickets: T[]): Promise<T[]> {
  return attachTicketChecklists(db, await attachTicketTags(db, tickets))
}

async function assertOwnedTicketTags(db: D1Database, ownerId: string, tagIds: number[]): Promise<void> {
  if (tagIds.length > 10) throw new Error('티켓에는 태그를 최대 10개까지 추가할 수 있습니다.')
  if (new Set(tagIds).size !== tagIds.length) throw new Error('중복된 태그가 있습니다.')
  if (tagIds.length > 0) {
    const owned = await db
      .prepare(
        `SELECT id FROM ticket_tags WHERE owner_id = ?1 AND id IN (${tagIds.map((_, index) => `?${index + 2}`).join(', ')})`,
      )
      .bind(ownerId, ...tagIds)
      .all<{ id: number }>()
    if (owned.results.length !== tagIds.length) throw new Error('선택한 태그를 찾을 수 없습니다.')
  }
}

async function replaceTicketTags(db: D1Database, ownerId: string, ticketId: number, tagIds: number[]): Promise<void> {
  await assertOwnedTicketTags(db, ownerId, tagIds)
  await db.prepare('DELETE FROM ticket_tag_links WHERE ticket_id = ?1').bind(ticketId).run()
  if (tagIds.length === 0) return
  await db.batch(
    tagIds.map((tagId) =>
      db.prepare('INSERT INTO ticket_tag_links (ticket_id, tag_id) VALUES (?1, ?2)').bind(ticketId, tagId),
    ),
  )
}

async function nextTicketOrder(db: D1Database, ownerId: string, lane: TicketLane): Promise<number> {
  const row = await db
    .prepare(
      `
      SELECT COALESCE(MAX(sort_order), 0) AS max_order
      FROM tickets
      WHERE owner_id = ?1 AND lane = ?2 AND deleted_at IS NULL
      `,
    )
    .bind(ownerId, lane)
    .first<{ max_order: number }>()
  return (row?.max_order ?? 0) + 1000
}

export async function recordTicketLog(
  db: D1Database,
  ownerId: string,
  ticketId: number,
  ticketTitle: string,
  action: TicketLogAction,
  createdAt = Date.now(),
): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO ticket_logs (owner_id, ticket_id, ticket_title, action, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5)
      `,
    )
    .bind(ownerId, ticketId, ticketTitle, action, createdAt)
    .run()
}

export async function createTicket(
  db: D1Database,
  ownerId: string,
  title: string,
  note: string,
  lane: TicketLane,
  creationRequestId: string,
  tagIds: number[] = [],
  checklistEnabled = false,
  checklistItems: TicketChecklistItemInput[] = [],
): Promise<{ ticketId: number; created: boolean }> {
  await assertOwnedTicketTags(db, ownerId, tagIds)
  const now = Date.now()
  const result = await db
    .prepare(
      `
      INSERT INTO tickets (
        owner_id,
        title,
        note,
        lane,
        sort_order,
        create_request_id,
        created_at,
        updated_at
      )
      SELECT
        ?1,
        ?2,
        ?3,
        ?4,
        (
          SELECT COALESCE(MAX(sort_order), 0) + 1000
          FROM tickets
          WHERE owner_id = ?1 AND lane = ?4 AND deleted_at IS NULL
        ),
        ?5,
        ?6,
        ?6
      WHERE (
        SELECT COUNT(*)
        FROM tickets
        WHERE owner_id = ?1 AND deleted_at IS NULL
      ) < ?7
      ON CONFLICT DO NOTHING
      `,
    )
    .bind(ownerId, title, note, lane, creationRequestId, now, MAX_TICKETS_PER_USER)
    .run()

  if (result.meta.changes > 0 && result.meta.last_row_id) {
    await replaceTicketTags(db, ownerId, result.meta.last_row_id, tagIds)
    await replaceTicketChecklist(db, ownerId, result.meta.last_row_id, checklistEnabled, checklistItems)
    await recordTicketLog(db, ownerId, result.meta.last_row_id, title, 'created', now)
    return { ticketId: result.meta.last_row_id, created: true }
  }

  const existing = await db
    .prepare(
      `
      SELECT id
      FROM tickets
      WHERE owner_id = ?1 AND create_request_id = ?2
      LIMIT 1
      `,
    )
    .bind(ownerId, creationRequestId)
    .first<{ id: number }>()
  if (existing) return { ticketId: existing.id, created: false }

  throw new Error(`작업 티켓은 사용자당 최대 ${MAX_TICKETS_PER_USER}개까지 만들 수 있습니다.`)
}

export async function getTicket(db: D1Database, ownerId: string, ticketId: number): Promise<TicketRow | null> {
  const ticket = await db
    .prepare(
      `
      SELECT id, owner_id, title, note, lane, sort_order, checklist_enabled, created_at, updated_at, deleted_at, purge_after
      FROM tickets
      WHERE id = ?1 AND owner_id = ?2 AND deleted_at IS NULL
      LIMIT 1
      `,
    )
    .bind(ticketId, ownerId)
    .first<TicketRow>()
  if (!ticket) return null
  return (await attachTicketDetails(db, [ticket]))[0] ?? null
}

async function replaceTicketChecklist(
  db: D1Database,
  ownerId: string,
  ticketId: number,
  enabled: boolean,
  items: TicketChecklistItemInput[],
): Promise<void> {
  if (items.length > MAX_TICKET_CHECKLIST_ITEMS) {
    throw new Error(`체크리스트 항목은 최대 ${MAX_TICKET_CHECKLIST_ITEMS}개까지 추가할 수 있습니다.`)
  }
  const existingIds = items.filter((item): item is TicketChecklistItemInput & { id: number } => item.id !== null)
  if (existingIds.length > 0) {
    const ownedItems = await db
      .prepare(
        `SELECT id FROM ticket_checklist_items WHERE ticket_id = ?1 AND id IN (${existingIds.map((_, index) => `?${index + 2}`).join(', ')})`,
      )
      .bind(ticketId, ...existingIds.map((item) => item.id))
      .all<{ id: number }>()
    if (ownedItems.results.length !== existingIds.length) {
      throw new Error('선택한 체크리스트 항목을 찾을 수 없습니다.')
    }
  }

  const now = Date.now()
  await db.prepare('UPDATE tickets SET checklist_enabled = ?1, updated_at = ?2 WHERE id = ?3 AND owner_id = ?4')
    .bind(enabled ? 1 : 0, now, ticketId, ownerId)
    .run()
  await db.prepare('DELETE FROM ticket_checklist_items WHERE ticket_id = ?1').bind(ticketId).run()
  if (items.length === 0) return
  await db.batch(
    items.map((item, index) =>
      db
        .prepare(
          `
          INSERT INTO ticket_checklist_items (ticket_id, title, completed, sort_order, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?5)
          `,
        )
        .bind(ticketId, item.title, item.completed ? 1 : 0, (index + 1) * 1000, now),
    ),
  )
}

export async function updateTicket(
  db: D1Database,
  ownerId: string,
  ticketId: number,
  title: string,
  note: string,
  lane: TicketLane,
  tagIds: number[] = [],
  checklistEnabled = false,
  checklistItems: TicketChecklistItemInput[] = [],
): Promise<boolean> {
  await assertOwnedTicketTags(db, ownerId, tagIds)
  const current = await getTicket(db, ownerId, ticketId)
  if (!current) return false

  const sortOrder = current.lane === lane ? current.sort_order : await nextTicketOrder(db, ownerId, lane)
  const result = await db
    .prepare(
      `
      UPDATE tickets
      SET title = ?1, note = ?2, lane = ?3, sort_order = ?4, checklist_enabled = ?5, updated_at = ?6
      WHERE id = ?7 AND owner_id = ?8 AND deleted_at IS NULL
      `,
    )
    .bind(title, note, lane, sortOrder, checklistEnabled ? 1 : 0, Date.now(), ticketId, ownerId)
    .run()
  if (result.meta.changes === 0) return false
  await replaceTicketTags(db, ownerId, ticketId, tagIds)
  await replaceTicketChecklist(db, ownerId, ticketId, checklistEnabled, checklistItems)
  await recordTicketLog(db, ownerId, ticketId, title, 'updated')
  return true
}

export async function moveTicket(
  db: D1Database,
  ownerId: string,
  ticketId: number,
  lane: TicketLane,
): Promise<boolean> {
  const ticket = await getTicket(db, ownerId, ticketId)
  if (!ticket) return false
  if (ticket.lane === lane) return true

  const sortOrder = await nextTicketOrder(db, ownerId, lane)
  const result = await db
    .prepare(
      `
      UPDATE tickets
      SET lane = ?1, sort_order = ?2, updated_at = ?3
      WHERE id = ?4 AND owner_id = ?5 AND deleted_at IS NULL
      `,
    )
    .bind(lane, sortOrder, Date.now(), ticketId, ownerId)
    .run()
  if (result.meta.changes === 0) return false
  await recordTicketLog(db, ownerId, ticketId, ticket.title, 'moved')
  return true
}

export async function deleteTicket(db: D1Database, ownerId: string, ticketId: number): Promise<boolean> {
  const ticket = await getTicket(db, ownerId, ticketId)
  if (!ticket) return false
  const deletedAt = Date.now()
  const result = await db
    .prepare(
      `
      UPDATE tickets
      SET deleted_at = ?3, purge_after = ?4, updated_at = ?3
      WHERE id = ?1 AND owner_id = ?2 AND deleted_at IS NULL
      `,
    )
    .bind(ticketId, ownerId, deletedAt, deletedAt + TICKET_TRASH_RETENTION_MS)
    .run()
  if (result.meta.changes === 0) return false
  await recordTicketLog(db, ownerId, ticketId, ticket.title, 'deleted', deletedAt)
  return true
}

export async function purgeExpiredTickets(
  db: D1Database,
  ownerId: string,
  now = Date.now(),
): Promise<number> {
  const expired = await db
    .prepare(
      `
      SELECT id, title
      FROM tickets
      WHERE owner_id = ?1 AND deleted_at IS NOT NULL AND purge_after <= ?2
      `,
    )
    .bind(ownerId, now)
    .all<{ id: number; title: string }>()
  const result = await db
    .prepare('DELETE FROM tickets WHERE owner_id = ?1 AND deleted_at IS NOT NULL AND purge_after <= ?2')
    .bind(ownerId, now)
    .run()
  if (result.meta.changes > 0) {
    await db.batch(
      expired.results.map((ticket) =>
        db
          .prepare(
            `
            INSERT INTO ticket_logs (owner_id, ticket_id, ticket_title, action, created_at)
            VALUES (?1, ?2, ?3, 'purged', ?4)
            `,
          )
          .bind(ownerId, ticket.id, ticket.title, now),
      ),
    )
  }
  return result.meta.changes
}

export async function listTrashedTickets(db: D1Database, ownerId: string): Promise<TrashedTicketRow[]> {
  await purgeExpiredTickets(db, ownerId)
  const result = await db
    .prepare(
      `
      SELECT id, owner_id, title, note, lane, sort_order, checklist_enabled, created_at, updated_at, deleted_at, purge_after
      FROM tickets
      WHERE owner_id = ?1 AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC, id DESC
      `,
    )
    .bind(ownerId)
    .all<TrashedTicketRow>()
  return attachTicketDetails(db, result.results)
}

export async function listAllTicketsForExport(db: D1Database, ownerId: string): Promise<TicketRow[]> {
  const active = await listTickets(db, ownerId)
  const trashed = await listTrashedTickets(db, ownerId)
  return [...active, ...trashed].sort((a, b) => a.id - b.id)
}

export async function restoreTicket(db: D1Database, ownerId: string, ticketId: number): Promise<boolean> {
  const now = Date.now()
  await purgeExpiredTickets(db, ownerId, now)
  const trashedTicket = await db
    .prepare('SELECT id, title FROM tickets WHERE id = ?1 AND owner_id = ?2 AND deleted_at IS NOT NULL LIMIT 1')
    .bind(ticketId, ownerId)
    .first<{ id: number; title: string }>()
  const result = await db
    .prepare(
      `
      UPDATE tickets
      SET
        deleted_at = NULL,
        purge_after = NULL,
        sort_order = (
          SELECT COALESCE(MAX(active.sort_order), 0) + 1000
          FROM tickets AS active
          WHERE active.owner_id = ?2
            AND active.lane = tickets.lane
            AND active.deleted_at IS NULL
        ),
        updated_at = ?3
      WHERE id = ?1
        AND owner_id = ?2
        AND deleted_at IS NOT NULL
        AND (
          SELECT COUNT(*)
          FROM tickets AS active
          WHERE active.owner_id = ?2 AND active.deleted_at IS NULL
        ) < ?4
      `,
    )
    .bind(ticketId, ownerId, now, MAX_TICKETS_PER_USER)
    .run()

  if (result.meta.changes > 0) {
    await recordTicketLog(db, ownerId, ticketId, trashedTicket?.title ?? '', 'restored', now)
    return true
  }

  const trashed = await db
    .prepare('SELECT id FROM tickets WHERE id = ?1 AND owner_id = ?2 AND deleted_at IS NOT NULL LIMIT 1')
    .bind(ticketId, ownerId)
    .first<{ id: number }>()
  if (trashed) {
    throw new Error(`활성 작업 티켓은 사용자당 최대 ${MAX_TICKETS_PER_USER}개까지 둘 수 있습니다.`)
  }
  return false
}

export async function permanentlyDeleteTicket(
  db: D1Database,
  ownerId: string,
  ticketId: number,
): Promise<boolean> {
  const ticket = await db
    .prepare('SELECT id, title FROM tickets WHERE id = ?1 AND owner_id = ?2 AND deleted_at IS NOT NULL LIMIT 1')
    .bind(ticketId, ownerId)
    .first<{ id: number; title: string }>()
  if (!ticket) return false
  const result = await db
    .prepare('DELETE FROM tickets WHERE id = ?1 AND owner_id = ?2 AND deleted_at IS NOT NULL')
    .bind(ticketId, ownerId)
    .run()
  if (result.meta.changes === 0) return false
  await recordTicketLog(db, ownerId, ticketId, ticket.title, 'purged')
  return true
}

export async function reorderTickets(
  db: D1Database,
  ownerId: string,
  lanes: Record<TicketLane, number[]>,
): Promise<void> {
  const incoming = [...lanes.todo, ...lanes.doing, ...lanes.done]
  if (incoming.length > MAX_TICKETS_PER_USER) throw new Error('티켓 수가 허용 범위를 초과했습니다.')
  if (new Set(incoming).size !== incoming.length) throw new Error('중복된 티켓 ID가 있습니다.')

  const existingResult = await db
    .prepare('SELECT id, title, lane FROM tickets WHERE owner_id = ?1 AND deleted_at IS NULL ORDER BY id')
    .bind(ownerId)
    .all<{ id: number; title: string; lane: TicketLane }>()
  const existing = existingResult.results.map((row) => row.id).sort((a, b) => a - b)
  const sortedIncoming = [...incoming].sort((a, b) => a - b)

  if (existing.length !== sortedIncoming.length || existing.some((id, index) => id !== sortedIncoming[index])) {
    throw new Error('티켓 목록이 최신 상태가 아닙니다. 페이지를 새로고침하세요.')
  }
  if (incoming.length === 0) return

  const now = Date.now()
  const currentById = new Map(existingResult.results.map((row) => [row.id, row]))
  const statements: D1PreparedStatement[] = []
  for (const [lane, ids] of Object.entries(lanes) as [TicketLane, number[]][]) {
    ids.forEach((id, index) => {
      statements.push(
        db
          .prepare(
            `
            UPDATE tickets
            SET lane = ?1, sort_order = ?2, updated_at = ?3
            WHERE id = ?4 AND owner_id = ?5 AND deleted_at IS NULL
            `,
          )
          .bind(lane, (index + 1) * 1000, now, id, ownerId),
      )
      const current = currentById.get(id)
      if (current && current.lane !== lane) {
        statements.push(
          db
            .prepare(
              `
              INSERT INTO ticket_logs (owner_id, ticket_id, ticket_title, action, created_at)
              VALUES (?1, ?2, ?3, 'moved', ?4)
              `,
            )
            .bind(ownerId, id, current.title, now),
        )
      }
    })
  }

  await db.batch(statements)
}

export async function listTicketLogs(
  db: D1Database,
  ownerId: string,
  requestedPage: number,
  pageSize: number,
): Promise<PaginatedResult<TicketLogRow>> {
  const count = await db
    .prepare('SELECT COUNT(*) AS total_items FROM ticket_logs WHERE owner_id = ?1')
    .bind(ownerId)
    .first<{ total_items: number }>()
  const totalItems = count?.total_items ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const page = Math.min(Math.max(requestedPage, 1), totalPages)
  const result = await db
    .prepare(
      `
      SELECT id, owner_id, ticket_id, ticket_title, action, created_at
      FROM ticket_logs
      WHERE owner_id = ?1
      ORDER BY created_at DESC, id DESC
      LIMIT ?2 OFFSET ?3
      `,
    )
    .bind(ownerId, pageSize, (page - 1) * pageSize)
    .all<TicketLogRow>()
  return { items: result.results, page, pageSize, totalItems, totalPages }
}

export async function listAllTicketLogsForExport(db: D1Database, ownerId: string): Promise<TicketLogRow[]> {
  const result = await db
    .prepare(
      `
      SELECT id, owner_id, ticket_id, ticket_title, action, created_at
      FROM ticket_logs
      WHERE owner_id = ?1
      ORDER BY created_at DESC, id DESC
      `,
    )
    .bind(ownerId)
    .all<TicketLogRow>()
  return result.results
}

export async function listMemos(db: D1Database, ownerId: string): Promise<MemoRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        m.id,
        m.owner_id,
        m.memo,
        m.value,
        m.link_mode,
        m.pattern_id,
        p.name AS pattern_name,
        p.prefix AS pattern_prefix,
        p.suffix AS pattern_suffix,
        m.created_at,
        m.updated_at
      FROM private_memos m
      LEFT JOIN memo_url_patterns p
        ON p.id = m.pattern_id
        AND p.user_id = m.owner_id
      WHERE m.owner_id = ?1
      ORDER BY m.id DESC
      LIMIT ?2
      `,
    )
    .bind(ownerId, MAX_MEMOS_PER_USER + 1)
    .all<MemoRow>()

  if (result.results.length > MAX_MEMOS_PER_USER) {
    throw new Error(`메모는 사용자당 최대 ${MAX_MEMOS_PER_USER}개까지 지원합니다.`)
  }
  return result.results
}

export async function createMemo(
  db: D1Database,
  ownerId: string,
  memo: string,
  value: string,
  linkMode: MemoLinkMode,
  patternId: number | null,
): Promise<number | null> {
  const count = await db
    .prepare('SELECT COUNT(*) AS count FROM private_memos WHERE owner_id = ?1')
    .bind(ownerId)
    .first<{ count: number }>()
  if ((count?.count ?? 0) >= MAX_MEMOS_PER_USER) {
    throw new Error(`메모는 사용자당 최대 ${MAX_MEMOS_PER_USER}개까지 만들 수 있습니다.`)
  }

  const now = Date.now()
  const result =
    linkMode !== 'custom'
      ? await db
          .prepare(
            `
            INSERT INTO private_memos (
              owner_id,
              memo,
              value,
              link_mode,
              pattern_id,
              created_at,
              updated_at
            )
            VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?5)
            `,
          )
          .bind(ownerId, memo, value, linkMode, now)
          .run()
      : await db
          .prepare(
            `
            INSERT INTO private_memos (
              owner_id,
              memo,
              value,
              link_mode,
              pattern_id,
              created_at,
              updated_at
            )
            SELECT ?1, ?2, ?3, 'custom', id, ?5, ?5
            FROM memo_url_patterns
            WHERE id = ?4 AND user_id = ?1
            `,
          )
          .bind(ownerId, memo, value, patternId, now)
          .run()

  const memoId = result.meta.last_row_id
  return memoId || null
}

export async function deleteMemo(db: D1Database, ownerId: string, memoId: number): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM private_memos WHERE id = ?1 AND owner_id = ?2')
    .bind(memoId, ownerId)
    .run()
  return result.meta.changes > 0
}

export async function listPrivateImages(db: D1Database, ownerId: string): Promise<PrivateImageRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        id,
        owner_id,
        object_key,
        image_hash,
        extension,
        original_name,
        content_type,
        size_bytes,
        status,
        copied_at,
        created_at,
        updated_at
      FROM private_images
      WHERE owner_id = ?1 AND status = 'ready'
      ORDER BY id DESC
      LIMIT ?2
      `,
    )
    .bind(ownerId, MAX_PRIVATE_IMAGES_PER_USER + 1)
    .all<PrivateImageRow>()

  if (result.results.length > MAX_PRIVATE_IMAGES_PER_USER) {
    throw new Error(`개인 이미지는 최대 ${MAX_PRIVATE_IMAGES_PER_USER}개까지 지원합니다.`)
  }
  return result.results
}

export async function createReadyPrivateImage(
  db: D1Database,
  ownerId: string,
  imageHash: string,
  extension: ImageExtension,
  originalName: string,
  contentType: string,
  sizeBytes: number,
): Promise<number> {
  const count = await db
    .prepare("SELECT COUNT(*) AS count FROM private_images WHERE owner_id = ?1 AND status = 'ready'")
    .bind(ownerId)
    .first<{ count: number }>()
  if ((count?.count ?? 0) >= MAX_PRIVATE_IMAGES_PER_USER) {
    throw new Error(`개인 이미지는 최대 ${MAX_PRIVATE_IMAGES_PER_USER}개까지 저장할 수 있습니다.`)
  }

  const now = Date.now()
  const result = await db
    .prepare(
      `
      INSERT INTO private_images (
        owner_id,
        object_key,
        image_hash,
        extension,
        original_name,
        content_type,
        size_bytes,
        status,
        copied_at,
        created_at,
        updated_at
      )
      VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6, 'ready', NULL, ?7, ?7)
      `,
    )
    .bind(ownerId, imageHash, extension, originalName, contentType, sizeBytes, now)
    .run()

  const imageId = result.meta.last_row_id
  if (!imageId) throw new Error('이미지 ID를 확인할 수 없습니다.')
  return imageId
}

export async function getPrivateImage(
  db: D1Database,
  ownerId: string,
  imageId: number,
): Promise<PrivateImageRow | null> {
  return db
    .prepare(
      `
      SELECT
        id,
        owner_id,
        object_key,
        image_hash,
        extension,
        original_name,
        content_type,
        size_bytes,
        status,
        copied_at,
        created_at,
        updated_at
      FROM private_images
      WHERE id = ?1 AND owner_id = ?2
      LIMIT 1
      `,
    )
    .bind(imageId, ownerId)
    .first<PrivateImageRow>()
}

export async function findPrivateImageByPublicId(
  db: D1Database,
  imageHash: string,
  extension: ImageExtension,
): Promise<PrivateImageRow | null> {
  return db
    .prepare(
      `
      SELECT
        id,
        owner_id,
        object_key,
        image_hash,
        extension,
        original_name,
        content_type,
        size_bytes,
        status,
        copied_at,
        created_at,
        updated_at
      FROM private_images
      WHERE image_hash = ?1 AND extension = ?2 AND status = 'ready'
      ORDER BY id ASC
      LIMIT 1
      `,
    )
    .bind(imageHash, extension)
    .first<PrivateImageRow>()
}

export async function replacePostImageLinks(
  db: D1Database,
  postId: number,
  ownerId: string,
  privateImageIds: number[],
): Promise<number> {
  const imageIds = Array.from(
    new Set(privateImageIds.filter((imageId) => Number.isSafeInteger(imageId) && imageId > 0)),
  )

  if (imageIds.length > 0) {
    const placeholders = imageIds.map((_, index) => `?${index + 2}`).join(', ')
    const owned = await db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM private_images
         WHERE owner_id = ?1
           AND status = 'ready'
           AND image_hash IS NOT NULL
           AND extension IS NOT NULL
           AND id IN (${placeholders})`,
      )
      .bind(ownerId, ...imageIds)
      .first<{ count: number }>()
    if ((owned?.count ?? 0) !== imageIds.length) {
      throw new Error('게시글에 연결할 수 없는 이미지가 포함되어 있습니다.')
    }
  }

  const now = Date.now()
  await db.batch([
    db.prepare('DELETE FROM post_image_links WHERE post_id = ?1').bind(postId),
    ...imageIds.map((imageId) =>
      db
        .prepare(
          `INSERT INTO post_image_links (post_id, private_image_id, created_at)
           SELECT ?1, id, ?4
           FROM private_images
           WHERE id = ?2 AND owner_id = ?3 AND status = 'ready'`,
        )
        .bind(postId, imageId, ownerId, now),
    ),
  ])
  return imageIds.length
}

export async function listPostImageLinks(
  db: D1Database,
  postId: number,
): Promise<PostImageLinkRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        l.post_id,
        l.private_image_id,
        i.image_hash,
        i.extension,
        i.owner_id,
        l.created_at
      FROM post_image_links l
      JOIN private_images i ON i.id = l.private_image_id
      WHERE l.post_id = ?1
        AND i.status = 'ready'
        AND i.image_hash IS NOT NULL
        AND i.extension IS NOT NULL
      ORDER BY l.created_at ASC, l.private_image_id ASC
      `,
    )
    .bind(postId)
    .all<PostImageLinkRow>()
  return result.results
}

export async function deletePrivateImageRecord(
  db: D1Database,
  ownerId: string,
  imageId: number,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM private_images WHERE id = ?1 AND owner_id = ?2')
    .bind(imageId, ownerId)
    .run()
  return result.meta.changes > 0
}

export async function markPrivateImageCopied(db: D1Database, ownerId: string, imageId: number): Promise<number | null> {
  const now = Date.now()
  await db
    .prepare(
      `
      UPDATE private_images
      SET copied_at = COALESCE(copied_at, ?1), updated_at = ?1
      WHERE id = ?2 AND owner_id = ?3 AND status = 'ready'
      `,
    )
    .bind(now, imageId, ownerId)
    .run()
  const image = await getPrivateImage(db, ownerId, imageId)
  return image?.status === 'ready' ? image.copied_at : null
}

export async function getMemoUrlSettings(db: D1Database, userId: string): Promise<MemoUrlSettings> {
  const settings = await db
    .prepare(
      `
      SELECT numeric_prefix, numeric_suffix, text_prefix, text_suffix
      FROM user_memo_settings
      WHERE user_id = ?1
      LIMIT 1
      `,
    )
    .bind(userId)
    .first<MemoUrlSettings>()
  return settings ?? { ...EMPTY_MEMO_URL_SETTINGS }
}

export async function upsertMemoUrlSettings(
  db: D1Database,
  userId: string,
  settings: MemoUrlSettings,
): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO user_memo_settings (
        user_id,
        numeric_prefix,
        numeric_suffix,
        text_prefix,
        text_suffix,
        updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT(user_id) DO UPDATE SET
        numeric_prefix = excluded.numeric_prefix,
        numeric_suffix = excluded.numeric_suffix,
        text_prefix = excluded.text_prefix,
        text_suffix = excluded.text_suffix,
        updated_at = excluded.updated_at
      `,
    )
    .bind(
      userId,
      settings.numeric_prefix,
      settings.numeric_suffix,
      settings.text_prefix,
      settings.text_suffix,
      Date.now(),
    )
    .run()
}

export async function listMemoUrlPatterns(db: D1Database, userId: string): Promise<MemoUrlPatternRow[]> {
  const result = await db
    .prepare(
      `
      SELECT id, user_id, name, prefix, suffix, sort_order, created_at, updated_at
      FROM memo_url_patterns
      WHERE user_id = ?1
      ORDER BY sort_order, id
      LIMIT ?2
      `,
    )
    .bind(userId, MAX_MEMO_PATTERNS_PER_USER + 1)
    .all<MemoUrlPatternRow>()

  if (result.results.length > MAX_MEMO_PATTERNS_PER_USER) {
    throw new Error(`메모 패턴은 사용자당 최대 ${MAX_MEMO_PATTERNS_PER_USER}개까지 지원합니다.`)
  }
  return result.results
}

export async function getMemoUrlPattern(
  db: D1Database,
  userId: string,
  patternId: number,
): Promise<MemoUrlPatternRow | null> {
  return db
    .prepare(
      `
      SELECT id, user_id, name, prefix, suffix, sort_order, created_at, updated_at
      FROM memo_url_patterns
      WHERE id = ?1 AND user_id = ?2
      LIMIT 1
      `,
    )
    .bind(patternId, userId)
    .first<MemoUrlPatternRow>()
}

export async function createMemoUrlPattern(
  db: D1Database,
  userId: string,
  name: string,
  prefix: string,
  suffix: string,
): Promise<number> {
  const count = await db
    .prepare('SELECT COUNT(*) AS count FROM memo_url_patterns WHERE user_id = ?1')
    .bind(userId)
    .first<{ count: number }>()
  if ((count?.count ?? 0) >= MAX_MEMO_PATTERNS_PER_USER) {
    throw new Error(`메모 패턴은 사용자당 최대 ${MAX_MEMO_PATTERNS_PER_USER}개까지 만들 수 있습니다.`)
  }

  const order = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) + 1000 AS next_order FROM memo_url_patterns WHERE user_id = ?1')
    .bind(userId)
    .first<{ next_order: number }>()
  const now = Date.now()
  const result = await db
    .prepare(
      `
      INSERT INTO memo_url_patterns (user_id, name, prefix, suffix, sort_order, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
      `,
    )
    .bind(userId, name, prefix, suffix, order?.next_order ?? 1000, now)
    .run()

  const patternId = result.meta.last_row_id
  if (!patternId) throw new Error('메모 패턴 ID를 확인할 수 없습니다.')
  return patternId
}

export async function updateMemoUrlPattern(
  db: D1Database,
  userId: string,
  patternId: number,
  name: string,
  prefix: string,
  suffix: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `
      UPDATE memo_url_patterns
      SET name = ?1, prefix = ?2, suffix = ?3, updated_at = ?4
      WHERE id = ?5 AND user_id = ?6
      `,
    )
    .bind(name, prefix, suffix, Date.now(), patternId, userId)
    .run()
  return result.meta.changes > 0
}

export async function deleteMemoUrlPattern(
  db: D1Database,
  userId: string,
  patternId: number,
): Promise<boolean> {
  const pattern = await getMemoUrlPattern(db, userId, patternId)
  if (!pattern) return false

  await db.batch([
    db
      .prepare(
        `
        UPDATE private_memos
        SET link_mode = 'auto', pattern_id = NULL, updated_at = ?1
        WHERE owner_id = ?2 AND pattern_id = ?3
        `,
      )
      .bind(Date.now(), userId, patternId),
    db.prepare('DELETE FROM memo_url_patterns WHERE id = ?1 AND user_id = ?2').bind(patternId, userId),
  ])
  return true
}
