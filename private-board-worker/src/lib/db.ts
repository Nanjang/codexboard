import type {
  BoardRow,
  CommentRow,
  CurrentUser,
  DashboardWidgetRow,
  DevlogAuthor,
  DevlogAuthorRow,
  DevlogExportPostRow,
  DevlogPostListRow,
  ImageServiceSettings,
  MemoRow,
  MemoUrlPatternRow,
  MemoUrlSettings,
  PrivateImageRow,
  PostDetailRow,
  PostBodyFormat,
  PostListRow,
  PostVisibility,
  TicketLane,
  TicketRow,
  TrashedTicketRow,
} from '../types'
import { firstDevlogImageSource } from './devlog-preview'

export const POSTS_PER_PAGE = 20
export const DASHBOARD_POSTS_LIMIT = 5
export const MAX_TICKETS_PER_USER = 200
export const TICKET_TRASH_RETENTION_MS = 14 * 24 * 60 * 60 * 1000
export const MAX_MEMOS_PER_USER = 1000
export const MAX_MEMO_PATTERNS_PER_USER = 50
export const MAX_RSS_WIDGETS_PER_USER = 10
export const MAX_PRIVATE_IMAGES_PER_USER = 5000
export const DEVLOG_POSTS_PER_PAGE = 12
export const DEVLOG_EXPORT_POSTS_PER_PAGE = 100
const PRIVATE_IMAGES_FEATURE_KEY = 'private_images'

export interface ImageServiceRecord {
  base_url: string
  token_ciphertext: string
  enabled: number
  updated_at: number
}

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
  const record = await getImageServiceRecord(db)
  return {
    configured: record !== null,
    enabled: record?.enabled === 1,
    updatedAt: record?.updated_at ?? null,
  }
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
  return result.meta.changes > 0
}

export async function isImageStorageEnabled(db: D1Database): Promise<boolean> {
  const setting = await db
    .prepare('SELECT enabled FROM feature_settings WHERE feature_key = ?1 LIMIT 1')
    .bind(PRIVATE_IMAGES_FEATURE_KEY)
    .first<{ enabled: number }>()
  return setting?.enabled === 1
}

export async function setImageStorageEnabled(
  db: D1Database,
  enabled: boolean,
  updatedBy: string,
): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO feature_settings (feature_key, enabled, updated_by, updated_at)
      VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(feature_key) DO UPDATE SET
        enabled = excluded.enabled,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
      `,
    )
    .bind(PRIVATE_IMAGES_FEATURE_KEY, enabled ? 1 : 0, updatedBy, Date.now())
    .run()
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
  afterId: number | null,
): Promise<DevlogExportPostRow[]> {
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
  `
  const statement = afterId
    ? db
        .prepare(`${baseSql} AND p.id > ?2 ORDER BY p.id ASC LIMIT ?3`)
        .bind(authorId, afterId, DEVLOG_EXPORT_POSTS_PER_PAGE)
    : db
        .prepare(`${baseSql} ORDER BY p.id ASC LIMIT ?2`)
        .bind(authorId, DEVLOG_EXPORT_POSTS_PER_PAGE)
  const result = await statement.all<DevlogExportPostRow>()
  return result.results
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
      SELECT id, user_id, widget_type, title, url, icon_url, icon_color, sort_order, created_at
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
        sort_order,
        created_at,
        create_request_id
      )
      VALUES (?1, 'bookmark', ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      ON CONFLICT DO NOTHING
      `,
    )
    .bind(userId, title, url, iconUrl, iconColor, sortOrder, now, creationRequestId)
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
      SELECT id, user_id, widget_type, title, url, icon_url, icon_color, sort_order, created_at
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
): Promise<boolean> {
  const result = await db
    .prepare(
      `
      UPDATE dashboard_widgets
      SET title = ?1,
          url = ?2,
          icon_url = ?3,
          icon_color = ?4,
          icon_content_type = NULL,
          icon_data = NULL,
          icon_updated_at = NULL
      WHERE id = ?5 AND user_id = ?6 AND widget_type = 'bookmark'
      `,
    )
    .bind(title, url, iconUrl, iconColor, widgetId, userId)
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
      SELECT id, owner_id, title, note, lane, sort_order, created_at, updated_at, deleted_at, purge_after
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
  return result.results
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

export async function createTicket(
  db: D1Database,
  ownerId: string,
  title: string,
  note: string,
  lane: TicketLane,
  creationRequestId: string,
): Promise<{ ticketId: number; created: boolean }> {
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
  return db
    .prepare(
      `
      SELECT id, owner_id, title, note, lane, sort_order, created_at, updated_at, deleted_at, purge_after
      FROM tickets
      WHERE id = ?1 AND owner_id = ?2 AND deleted_at IS NULL
      LIMIT 1
      `,
    )
    .bind(ticketId, ownerId)
    .first<TicketRow>()
}

export async function updateTicket(
  db: D1Database,
  ownerId: string,
  ticketId: number,
  title: string,
  note: string,
  lane: TicketLane,
): Promise<boolean> {
  const current = await getTicket(db, ownerId, ticketId)
  if (!current) return false

  const sortOrder = current.lane === lane ? current.sort_order : await nextTicketOrder(db, ownerId, lane)
  const result = await db
    .prepare(
      `
      UPDATE tickets
      SET title = ?1, note = ?2, lane = ?3, sort_order = ?4, updated_at = ?5
      WHERE id = ?6 AND owner_id = ?7 AND deleted_at IS NULL
      `,
    )
    .bind(title, note, lane, sortOrder, Date.now(), ticketId, ownerId)
    .run()
  return result.meta.changes > 0
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
  return result.meta.changes > 0
}

export async function deleteTicket(db: D1Database, ownerId: string, ticketId: number): Promise<boolean> {
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
  return result.meta.changes > 0
}

export async function purgeExpiredTickets(
  db: D1Database,
  ownerId: string,
  now = Date.now(),
): Promise<number> {
  const result = await db
    .prepare('DELETE FROM tickets WHERE owner_id = ?1 AND deleted_at IS NOT NULL AND purge_after <= ?2')
    .bind(ownerId, now)
    .run()
  return result.meta.changes
}

export async function listTrashedTickets(db: D1Database, ownerId: string): Promise<TrashedTicketRow[]> {
  await purgeExpiredTickets(db, ownerId)
  const result = await db
    .prepare(
      `
      SELECT id, owner_id, title, note, lane, sort_order, created_at, updated_at, deleted_at, purge_after
      FROM tickets
      WHERE owner_id = ?1 AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC, id DESC
      `,
    )
    .bind(ownerId)
    .all<TrashedTicketRow>()
  return result.results
}

export async function restoreTicket(db: D1Database, ownerId: string, ticketId: number): Promise<boolean> {
  const now = Date.now()
  await purgeExpiredTickets(db, ownerId, now)
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

  if (result.meta.changes > 0) return true

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
  const result = await db
    .prepare('DELETE FROM tickets WHERE id = ?1 AND owner_id = ?2 AND deleted_at IS NOT NULL')
    .bind(ticketId, ownerId)
    .run()
  return result.meta.changes > 0
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
    .prepare('SELECT id FROM tickets WHERE owner_id = ?1 AND deleted_at IS NULL ORDER BY id')
    .bind(ownerId)
    .all<{ id: number }>()
  const existing = existingResult.results.map((row) => row.id).sort((a, b) => a - b)
  const sortedIncoming = [...incoming].sort((a, b) => a - b)

  if (existing.length !== sortedIncoming.length || existing.some((id, index) => id !== sortedIncoming[index])) {
    throw new Error('티켓 목록이 최신 상태가 아닙니다. 페이지를 새로고침하세요.')
  }
  if (incoming.length === 0) return

  const now = Date.now()
  const statements = (Object.entries(lanes) as [TicketLane, number[]][]).flatMap(([lane, ids]) =>
    ids.map((id, index) =>
      db
        .prepare(
          `
          UPDATE tickets
          SET lane = ?1, sort_order = ?2, updated_at = ?3
          WHERE id = ?4 AND owner_id = ?5 AND deleted_at IS NULL
          `,
        )
        .bind(lane, (index + 1) * 1000, now, id, ownerId),
    ),
  )

  await db.batch(statements)
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
    patternId === null
      ? await db
          .prepare(
            `
            INSERT INTO private_memos (owner_id, memo, value, pattern_id, created_at, updated_at)
            VALUES (?1, ?2, ?3, NULL, ?4, ?4)
            `,
          )
          .bind(ownerId, memo, value, now)
          .run()
      : await db
          .prepare(
            `
            INSERT INTO private_memos (owner_id, memo, value, pattern_id, created_at, updated_at)
            SELECT ?1, ?2, ?3, id, ?5, ?5
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

export async function createPendingPrivateImage(
  db: D1Database,
  ownerId: string,
  objectKey: string,
  originalName: string,
  contentType: string,
  sizeBytes: number,
): Promise<number> {
  const staleBefore = Date.now() - 24 * 60 * 60 * 1000
  await db
    .prepare("DELETE FROM private_images WHERE owner_id = ?1 AND status = 'pending' AND created_at < ?2")
    .bind(ownerId, staleBefore)
    .run()

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
        original_name,
        content_type,
        size_bytes,
        status,
        copied_at,
        created_at,
        updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, 'pending', NULL, ?6, ?6)
      `,
    )
    .bind(ownerId, objectKey, originalName, contentType, sizeBytes, now)
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

export async function markPrivateImageReady(db: D1Database, ownerId: string, imageId: number): Promise<boolean> {
  const result = await db
    .prepare(
      `
      UPDATE private_images
      SET status = 'ready', updated_at = ?1
      WHERE id = ?2 AND owner_id = ?3 AND status = 'pending'
      `,
    )
    .bind(Date.now(), imageId, ownerId)
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

export async function deletePendingPrivateImage(db: D1Database, ownerId: string, imageId: number): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM private_images WHERE id = ?1 AND owner_id = ?2 AND status = 'pending'")
    .bind(imageId, ownerId)
    .run()
  return result.meta.changes > 0
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
      .prepare('UPDATE private_memos SET pattern_id = NULL, updated_at = ?1 WHERE owner_id = ?2 AND pattern_id = ?3')
      .bind(Date.now(), userId, patternId),
    db.prepare('DELETE FROM memo_url_patterns WHERE id = ?1 AND user_id = ?2').bind(patternId, userId),
  ])
  return true
}
