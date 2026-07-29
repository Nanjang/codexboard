import type { Context } from 'hono'

export type UserRole = 'user' | 'admin'
export type UserStatus = 'active' | 'blocked'
export type RegistrationMode = 'open' | 'allowlist' | 'domain'
export type TicketLane = 'todo' | 'doing' | 'done'
export type BoardSlug = 'free' | 'development' | 'news' | 'inquiry'
export type PostBodyFormat = 'plain' | 'rich'
export type PostVisibility = 'public' | 'private'
export type DashboardWidgetType = 'free-board' | 'bookmark' | 'rss'
export type BookmarkIconColor = 'green' | 'blue' | 'purple' | 'orange' | 'rose'
export type PrivateImageStatus = 'pending' | 'ready'
export type ImageExtension = 'jpg' | 'png' | 'webp' | 'gif' | 'avif'
export type DevlogImageCacheStatus = 'HIT' | 'MISS'

export interface RateLimiterBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>
}

export interface Bindings {
  DB: D1Database
  ASSETS: Fetcher
  AUTH_RATE_LIMITER: RateLimiterBinding
  WRITE_RATE_LIMITER: RateLimiterBinding
  CF_VERSION_METADATA: WorkerVersionMetadata
  IMAGE_VAULT?: Fetcher

  BASE_URL: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  SESSION_SECRET: string

  APP_NAME?: string
  REGISTRATION_MODE?: string
  ALLOWED_EMAILS?: string
  ALLOWED_DOMAINS?: string
  ADMIN_EMAILS?: string
  SESSION_DAYS?: string
  TURNSTILE_SITE_KEY?: string
  TURNSTILE_SECRET_KEY?: string
  CONTACT_EMAIL?: string
}

export interface DeployInfo {
  version: string
  timestamp: string
  displayTimestamp: string
}

export interface CurrentUser {
  id: string
  nickname: string
  role: UserRole
  status: UserStatus
  email: string
  emailHidden: boolean
  imageStorageEnabled?: boolean
  themeOrphanNoticePending?: boolean
}

export interface AuthContext {
  user: CurrentUser
  sessionToken: string
  sessionTokenHash: string
  sessionExpiresAt: number
  csrfToken: string
}

export interface Variables {
  auth: AuthContext | null
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}

export type AppContext = Context<AppEnv>

export interface BoardRow {
  id: number
  slug: BoardSlug
  name: string
  description: string
  sort_order: number
}

export interface PostListRow {
  id: number
  board_id: number
  board_slug: BoardSlug
  board_name: string
  author_id: string
  author_nickname: string
  author_role: UserRole
  title: string
  comment_count: number
  view_count: number
  created_at: number
  updated_at: number
}

export interface PostDetailRow extends PostListRow {
  body: string
  body_format: PostBodyFormat
  visibility: PostVisibility
  preview_image_url: string | null
}

export interface DevlogPostListRow extends PostListRow {
  body: string
  body_format: PostBodyFormat
  visibility: PostVisibility
  preview_image_url: string | null
}

export interface DevlogExportPostRow {
  id: number
  title: string
  body: string
  body_format: PostBodyFormat
  created_at: number
}

export interface DevlogAuthorRow {
  id: string
  nickname: string
  role: UserRole
  public_post_count: number
  latest_post_at: number
}

export interface DevlogAuthor {
  id: string
  nickname: string
  role: UserRole
}

export interface ImageServiceSettings {
  configured: boolean
  enabled: boolean
  updatedAt: number | null
}

export interface AdminMemberRow {
  id: string
  nickname: string
  email: string | null
  email_hidden: number
  role: UserRole
  status: UserStatus
  created_at: number
  updated_at: number
  post_count: number
  comment_count: number
  last_seen_at: number | null
  last_activity_at: number | null
}

export interface AdminMemberActivityRow {
  kind: 'post' | 'comment'
  activity_id: number
  post_id: number
  post_author_id: string
  board_slug: BoardSlug
  post_title: string
  body: string
  status: 'published' | 'hidden'
  visibility: PostVisibility
  created_at: number
  updated_at: number
}

export interface VisitorPageViewRow {
  id: number
  visit_day: string
  visited_at: number
  ip_address: string
  referer: string
  user_agent: string
  path: string
  user_id: string | null
  response_status: number
}

export interface DevlogImageCacheRequestRow {
  id: number
  image_hash: string
  extension: string
  method: 'GET' | 'HEAD'
  cache_status: DevlogImageCacheStatus
  response_status: number
  duration_ms: number
  colo: string | null
  created_at: number
}

export interface DevlogImageCacheFileStatsRow {
  image_hash: string
  extension: string
  hit_count: number
  miss_count: number
  request_count: number
  last_cache_status: DevlogImageCacheStatus
  last_response_status: number
  last_accessed_at: number
}

export interface PaginatedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface DashboardWidgetRow {
  id: number
  user_id: string
  widget_type: DashboardWidgetType
  title: string | null
  url: string | null
  icon_url: string | null
  icon_color: BookmarkIconColor
  sort_order: number
  created_at: number
}

export interface RssItem {
  title: string
  url: string
  summary: string
  publishedAt: number | null
}

export interface RssFeed {
  title: string | null
  sourceUrl: string
  fetchedAt: number
  items: RssItem[]
}

export interface RssWidgetResult {
  feed: RssFeed | null
  error: string | null
}

export interface CommentRow {
  id: number
  post_id: number
  author_id: string
  author_nickname: string
  author_role: UserRole
  body: string
  created_at: number
  updated_at: number
}

export interface TicketRow {
  id: number
  owner_id: string
  title: string
  note: string
  lane: TicketLane
  sort_order: number
  created_at: number
  updated_at: number
  deleted_at: number | null
  purge_after: number | null
}

export interface TrashedTicketRow extends TicketRow {
  deleted_at: number
  purge_after: number
}

export interface MemoRow {
  id: number
  owner_id: string
  memo: string
  value: string
  link_mode: MemoLinkMode
  pattern_id: number | null
  pattern_name: string | null
  pattern_prefix: string | null
  pattern_suffix: string | null
  created_at: number
  updated_at: number
}

export type MemoLinkMode = 'none' | 'auto' | 'custom'

export interface MemoUrlSettings {
  numeric_prefix: string
  numeric_suffix: string
  text_prefix: string
  text_suffix: string
}

export interface MemoUrlPatternRow {
  id: number
  user_id: string
  name: string
  prefix: string
  suffix: string
  sort_order: number
  created_at: number
  updated_at: number
}

export interface PrivateImageRow {
  id: number
  owner_id: string
  object_key: string | null
  image_hash: string | null
  extension: ImageExtension | null
  original_name: string
  content_type: string
  size_bytes: number
  status: PrivateImageStatus
  copied_at: number | null
  created_at: number
  updated_at: number
}

export interface PostImageLinkRow {
  post_id: number
  private_image_id: number
  image_hash: string
  extension: ImageExtension
  owner_id: string
  created_at: number
}
