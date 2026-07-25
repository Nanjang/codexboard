import type { Context } from 'hono'

export type UserRole = 'user' | 'admin'
export type UserStatus = 'active' | 'blocked'
export type RegistrationMode = 'open' | 'allowlist' | 'domain'
export type TicketLane = 'todo' | 'doing' | 'done'

export interface RateLimiterBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>
}

export interface Bindings {
  DB: D1Database
  ASSETS: Fetcher
  AUTH_RATE_LIMITER: RateLimiterBinding
  WRITE_RATE_LIMITER: RateLimiterBinding

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
  slug: string
  name: string
  description: string
  sort_order: number
}

export interface PostListRow {
  id: number
  board_id: number
  board_slug: string
  board_name: string
  author_id: string
  author_nickname: string
  title: string
  comment_count: number
  created_at: number
  updated_at: number
}

export interface PostDetailRow extends PostListRow {
  body: string
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
