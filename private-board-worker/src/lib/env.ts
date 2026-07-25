import type { Bindings, DeployInfo, RegistrationMode } from '../types'

const DEFAULT_APP_NAME = 'Private Board'
const DEFAULT_SESSION_DAYS = 14
const MAX_SESSION_DAYS = 90

function isTemplateValue(value: string | undefined): boolean {
  return /^(?:YOUR_|REPLACE_|GENERATE_|CHANGE_ME|<)/iu.test(value?.trim() ?? '')
}

function parseCsv(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function getBaseUrl(env: Bindings): URL {
  const value = env.BASE_URL.trim().replace(/\/$/u, '')
  const url = new URL(value)

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('BASE_URL은 http 또는 https URL이어야 합니다.')
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('BASE_URL에는 경로, 쿼리, 해시를 넣지 마세요.')
  }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('운영 BASE_URL은 HTTPS여야 합니다.')
  }

  return new URL(value)
}

export function getAppName(env: Bindings): string {
  const name = env.APP_NAME?.trim()
  return name && name.length <= 60 ? name : DEFAULT_APP_NAME
}

export function getDeployInfo(env: Bindings): DeployInfo {
  const timestamp = env.CF_VERSION_METADATA.timestamp
  const uploadedAt = new Date(timestamp)
  const displayTimestamp = Number.isNaN(uploadedAt.getTime())
    ? timestamp
    : `${new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(uploadedAt)} KST`

  return {
    version: env.CF_VERSION_METADATA.id.slice(0, 8),
    timestamp,
    displayTimestamp,
  }
}

export function getSessionDays(env: Bindings): number {
  const parsed = Number.parseInt(env.SESSION_DAYS ?? '', 10)
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION_DAYS
  return Math.min(Math.max(parsed, 1), MAX_SESSION_DAYS)
}

export function getRegistrationMode(env: Bindings): RegistrationMode {
  const mode = env.REGISTRATION_MODE?.trim().toLowerCase() ?? 'open'
  if (mode === 'open' || mode === 'allowlist' || mode === 'domain') return mode
  throw new Error('REGISTRATION_MODE은 open, allowlist, domain 중 하나여야 합니다.')
}

export function isAdminEmail(env: Bindings, email: string): boolean {
  return parseCsv(env.ADMIN_EMAILS).has(email.trim().toLowerCase())
}

export function isGoogleAccountAllowed(
  env: Bindings,
  email: string,
  hostedDomain: string | undefined,
): boolean {
  const normalizedEmail = email.trim().toLowerCase()
  if (isAdminEmail(env, normalizedEmail)) return true

  const mode = getRegistrationMode(env)
  if (mode === 'open') return true
  if (mode === 'allowlist') return parseCsv(env.ALLOWED_EMAILS).has(normalizedEmail)

  if (!hostedDomain) return false
  return parseCsv(env.ALLOWED_DOMAINS).has(hostedDomain.trim().toLowerCase())
}

export function secureCookies(env: Bindings): boolean {
  return getBaseUrl(env).protocol === 'https:'
}

export function turnstileEnabled(env: Bindings): boolean {
  return Boolean(env.TURNSTILE_SITE_KEY?.trim() && env.TURNSTILE_SECRET_KEY?.trim())
}

export function validateRuntimeConfig(env: Bindings): void {
  getBaseUrl(env)
  getRegistrationMode(env)

  if (!env.GOOGLE_CLIENT_ID?.trim() || isTemplateValue(env.GOOGLE_CLIENT_ID)) {
    throw new Error('GOOGLE_CLIENT_ID에 실제 Google OAuth 값을 입력하세요.')
  }
  if (!env.GOOGLE_CLIENT_SECRET?.trim() || isTemplateValue(env.GOOGLE_CLIENT_SECRET)) {
    throw new Error('GOOGLE_CLIENT_SECRET에 실제 Google OAuth 값을 입력하세요.')
  }
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || isTemplateValue(env.SESSION_SECRET)) {
    throw new Error('SESSION_SECRET은 최소 32자 이상의 무작위 값이어야 합니다.')
  }

  const hasSiteKey = Boolean(env.TURNSTILE_SITE_KEY?.trim())
  const hasSecretKey = Boolean(env.TURNSTILE_SECRET_KEY?.trim())
  if (hasSiteKey !== hasSecretKey) {
    throw new Error('Turnstile은 TURNSTILE_SITE_KEY와 TURNSTILE_SECRET_KEY를 함께 설정해야 합니다.')
  }

  const mode = getRegistrationMode(env)
  if (mode === 'allowlist' && parseCsv(env.ALLOWED_EMAILS).size === 0) {
    throw new Error('allowlist 모드에는 ALLOWED_EMAILS가 필요합니다.')
  }
  if (mode === 'domain' && parseCsv(env.ALLOWED_DOMAINS).size === 0) {
    throw new Error('domain 모드에는 ALLOWED_DOMAINS가 필요합니다.')
  }
}
