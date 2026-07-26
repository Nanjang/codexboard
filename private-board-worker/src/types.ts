import type { Context } from 'hono'

export type UserRole = 'user' | 'admin'
export type UserStatus = 'active' | 'blocked'
export type RegistrationMode = 'open' | 'allowlist' | 'domain'
export type TicketLane = 'todo' | 'doing' | 'done'
export type BoardSlug = 'free' | 'development' | 'news' | 'inquiry'
export type DashboardWidgetType = 'free-board' | 'bookmark' | 'rss'
export type PrivateImageStatus = 'pending' | 'ready'

export interface RateLimiterBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>
}

export interface Bindings {
  DB: D1Database
  ASSETS: Fetcher
  AUTH_RATE_LIMITER: RateLimiterBinding
  WRITE_RATE_LIMITER: RateLimiterBinding
  CF_VERSION_METADATA: WorkerVersionMetadata

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
  R2_ACCOUNT_ID?: string
  R2_BUCKET_NAME?: string
  R2_PUBLIC_BASE_URL?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
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
  title: string
  comment_count: number
  view_count: number
  created_at: number
  updated_at: number
}

export interface PostDetailRow extends PostListRow {
  body: string
}

export interface DashboardWidgetRow {
  id: number
  user_id: string
  widget_type: DashboardWidgetType
  title: string | null
  url: string | null
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
}

export interface MemoRow {
  id: number
  owner_id: string
  memo: string
  value: string
  pattern_id: number | null
  pattern_name: string | null
  pattern_prefix: string | null
  pattern_suffix: string | null
  created_at: number
  updated_at: number
}

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
  object_key: string
  original_name: string
  content_type: string
  size_bytes: number
  status: PrivateImageStatus
  copied_at: number | null
  created_at: number
  updated_at: number
}
