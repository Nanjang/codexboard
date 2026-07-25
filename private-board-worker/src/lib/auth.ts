import { createRemoteJWKSet, jwtVerify } from 'jose'
import { deleteCookie, getCookie, getSignedCookie, setCookie, setSignedCookie } from 'hono/cookie'
import type { AppContext, AuthContext, Bindings, CurrentUser, UserRole } from '../types'
import { createPkceChallenge, deriveCsrfToken, randomToken, safeEqual, sha256Hex } from './crypto'
import {
  getBaseUrl,
  getSessionDays,
  isAdminEmail,
  isGoogleAccountAllowed,
  secureCookies,
  turnstileEnabled,
} from './env'

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const SESSION_TOUCH_INTERVAL_MS = 12 * 60 * 60 * 1000

interface SessionRow {
  token_hash: string
  expires_at: number
  last_seen_at: number
  user_id: string
  nickname: string
  role: UserRole
  status: 'active' | 'blocked'
  email: string
}

interface GoogleTokenResponse {
  id_token?: string
  access_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

export interface GoogleIdentity {
  subject: string
  email: string
  hostedDomain?: string
}

export interface OAuthTransaction {
  state: string
  verifier: string
  nonce: string
}

function cookieName(env: Bindings, name: string): string {
  return secureCookies(env) ? `__Host-${name}` : `dev-${name}`
}

function cookieOptions(env: Bindings, maxAge: number) {
  return {
    path: '/',
    secure: secureCookies(env),
    httpOnly: true,
    sameSite: 'Lax' as const,
    maxAge,
  }
}

export function googleRedirectUri(env: Bindings): string {
  return new URL('/auth/google/callback', getBaseUrl(env)).toString()
}

export async function loadAuthContext(c: AppContext): Promise<AuthContext | null> {
  const sessionToken = getCookie(c, cookieName(c.env, 'session'))
  if (!sessionToken || sessionToken.length < 32 || sessionToken.length > 256) return null

  const sessionTokenHash = await sha256Hex(sessionToken)
  const now = Date.now()
  const row = await c.env.DB.prepare(
    `
    SELECT
      s.token_hash,
      s.expires_at,
      s.last_seen_at,
      u.id AS user_id,
      u.nickname,
      u.role,
      u.status,
      a.email
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN auth_accounts a ON a.user_id = u.id AND a.provider = 'google'
    WHERE s.token_hash = ?1
      AND s.expires_at > ?2
    LIMIT 1
    `,
  )
    .bind(sessionTokenHash, now)
    .first<SessionRow>()

  if (!row) return null

  if (now - row.last_seen_at >= SESSION_TOUCH_INTERVAL_MS) {
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE sessions SET last_seen_at = ?1 WHERE token_hash = ?2')
        .bind(now, sessionTokenHash)
        .run()
        .then(() => undefined),
    )
  }

  const user: CurrentUser = {
    id: row.user_id,
    nickname: row.nickname,
    role: row.role,
    status: row.status,
    email: row.email,
  }

  return {
    user,
    sessionToken,
    sessionTokenHash,
    sessionExpiresAt: row.expires_at,
    csrfToken: await deriveCsrfToken(sessionToken, c.env.SESSION_SECRET),
  }
}

export async function createSession(c: AppContext, userId: string): Promise<void> {
  const token = randomToken(32)
  const tokenHash = await sha256Hex(token)
  const now = Date.now()
  const expiresAt = now + getSessionDays(c.env) * 24 * 60 * 60 * 1000

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?1').bind(now),
    c.env.DB
      .prepare(
        `
        INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at)
        VALUES (?1, ?2, ?3, ?4, ?4)
        `,
      )
      .bind(tokenHash, userId, expiresAt, now),
  ])

  setCookie(c, cookieName(c.env, 'session'), token, cookieOptions(c.env, Math.floor((expiresAt - now) / 1000)))
}

export async function destroySession(c: AppContext, auth: AuthContext | null): Promise<void> {
  if (auth) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(auth.sessionTokenHash).run()
  }
  deleteCookie(c, cookieName(c.env, 'session'), {
    path: '/',
    secure: secureCookies(c.env),
  })
}

export async function createOAuthTransaction(c: AppContext): Promise<{ transaction: OAuthTransaction; url: string }> {
  const transaction: OAuthTransaction = {
    state: randomToken(24),
    verifier: randomToken(48),
    nonce: randomToken(24),
  }
  const options = cookieOptions(c.env, 10 * 60)

  await Promise.all([
    setSignedCookie(c, cookieName(c.env, 'oauth-state'), transaction.state, c.env.SESSION_SECRET, options),
    setSignedCookie(c, cookieName(c.env, 'oauth-verifier'), transaction.verifier, c.env.SESSION_SECRET, options),
    setSignedCookie(c, cookieName(c.env, 'oauth-nonce'), transaction.nonce, c.env.SESSION_SECRET, options),
  ])

  const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT)
  authorizationUrl.search = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(c.env),
    response_type: 'code',
    scope: 'openid email',
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: await createPkceChallenge(transaction.verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()

  return { transaction, url: authorizationUrl.toString() }
}

export async function readOAuthTransaction(c: AppContext): Promise<OAuthTransaction | null> {
  const [state, verifier, nonce] = await Promise.all([
    getSignedCookie(c, c.env.SESSION_SECRET, cookieName(c.env, 'oauth-state')),
    getSignedCookie(c, c.env.SESSION_SECRET, cookieName(c.env, 'oauth-verifier')),
    getSignedCookie(c, c.env.SESSION_SECRET, cookieName(c.env, 'oauth-nonce')),
  ])

  if (typeof state !== 'string' || typeof verifier !== 'string' || typeof nonce !== 'string') return null
  return { state, verifier, nonce }
}

export function clearOAuthTransaction(c: AppContext): void {
  for (const name of ['oauth-state', 'oauth-verifier', 'oauth-nonce']) {
    deleteCookie(c, cookieName(c.env, name), {
      path: '/',
      secure: secureCookies(c.env),
    })
  }
}

export async function exchangeGoogleCode(
  env: Bindings,
  code: string,
  verifier: string,
): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(env),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })

  const payload = (await response.json()) as GoogleTokenResponse
  if (!response.ok || !payload.id_token) {
    const detail = payload.error_description ?? payload.error ?? `HTTP ${response.status}`
    throw new Error(`Google 토큰 교환 실패: ${detail}`)
  }
  return payload
}

export async function verifyGoogleIdToken(
  env: Bindings,
  idToken: string,
  expectedNonce: string,
): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: env.GOOGLE_CLIENT_ID,
    clockTolerance: 5,
    maxTokenAge: '10m',
  })

  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Google 사용자 식별값이 없습니다.')
  if (typeof payload.email !== 'string' || !payload.email) throw new Error('Google 이메일 정보가 없습니다.')
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw new Error('확인되지 않은 Google 이메일입니다.')
  }
  if (typeof payload.nonce !== 'string' || !safeEqual(payload.nonce, expectedNonce)) {
    throw new Error('Google 로그인 nonce 검증에 실패했습니다.')
  }

  return {
    subject: payload.sub,
    email: payload.email.toLowerCase(),
    ...(typeof payload.hd === 'string' ? { hostedDomain: payload.hd.toLowerCase() } : {}),
  }
}

function deterministicNickname(subject: string): Promise<string> {
  return sha256Hex(`nickname:${subject}`).then((hash) => `회원-${hash.slice(0, 8)}`)
}

export async function findOrCreateGoogleUser(env: Bindings, identity: GoogleIdentity): Promise<CurrentUser> {
  if (!isGoogleAccountAllowed(env, identity.email, identity.hostedDomain)) {
    throw new Error('이 Google 계정은 서비스 이용 허용 목록에 포함되어 있지 않습니다.')
  }

  const existing = await env.DB.prepare(
    `
    SELECT u.id, u.nickname, u.role, u.status, a.email
    FROM auth_accounts a
    JOIN users u ON u.id = a.user_id
    WHERE a.provider = 'google' AND a.provider_subject = ?1
    LIMIT 1
    `,
  )
    .bind(identity.subject)
    .first<{
      id: string
      nickname: string
      role: UserRole
      status: 'active' | 'blocked'
      email: string
    }>()

  const desiredRole: UserRole = isAdminEmail(env, identity.email) ? 'admin' : 'user'
  const now = Date.now()

  if (existing) {
    await env.DB.batch([
      env.DB
        .prepare('UPDATE auth_accounts SET email = ?1, email_verified = 1 WHERE provider = \'google\' AND provider_subject = ?2')
        .bind(identity.email, identity.subject),
      ...(desiredRole === 'admin' && existing.role !== 'admin'
        ? [env.DB.prepare('UPDATE users SET role = \'admin\', updated_at = ?1 WHERE id = ?2').bind(now, existing.id)]
        : []),
    ])

    return {
      id: existing.id,
      nickname: existing.nickname,
      role: desiredRole === 'admin' ? 'admin' : existing.role,
      status: existing.status,
      email: identity.email,
    }
  }

  const userId = crypto.randomUUID()
  const nickname = await deterministicNickname(identity.subject)

  try {
    await env.DB.batch([
      env.DB
        .prepare(
          `
          INSERT INTO users (id, nickname, role, status, created_at, updated_at)
          VALUES (?1, ?2, ?3, 'active', ?4, ?4)
          `,
        )
        .bind(userId, nickname, desiredRole, now),
      env.DB
        .prepare(
          `
          INSERT INTO auth_accounts
            (provider, provider_subject, user_id, email, email_verified, created_at)
          VALUES ('google', ?1, ?2, ?3, 1, ?4)
          `,
        )
        .bind(identity.subject, userId, identity.email, now),
    ])
  } catch (error) {
    const raced = await env.DB.prepare(
      `
      SELECT u.id, u.nickname, u.role, u.status, a.email
      FROM auth_accounts a
      JOIN users u ON u.id = a.user_id
      WHERE a.provider = 'google' AND a.provider_subject = ?1
      LIMIT 1
      `,
    )
      .bind(identity.subject)
      .first<{
        id: string
        nickname: string
        role: UserRole
        status: 'active' | 'blocked'
        email: string
      }>()
    if (raced) {
      return {
        id: raced.id,
        nickname: raced.nickname,
        role: raced.role,
        status: raced.status,
        email: identity.email,
      }
    }
    throw error
  }

  return { id: userId, nickname, role: desiredRole, status: 'active', email: identity.email }
}

export async function verifyTurnstile(c: AppContext, token: string | null): Promise<boolean> {
  if (!turnstileEnabled(c.env)) return true
  if (!token) return false

  const remoteIp = c.req.header('CF-Connecting-IP')
  const form = new FormData()
  form.set('secret', c.env.TURNSTILE_SECRET_KEY ?? '')
  form.set('response', token)
  form.set('idempotency_key', crypto.randomUUID())
  if (remoteIp) form.set('remoteip', remoteIp)

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  })
  if (!response.ok) return false

  const result = (await response.json()) as {
    success?: boolean
    action?: string
    hostname?: string
  }
  const expectedHostname = getBaseUrl(c.env).hostname
  return result.success === true && result.action === 'login' && result.hostname === expectedHostname
}
