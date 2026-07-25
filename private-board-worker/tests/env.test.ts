import { describe, expect, it } from 'vitest'
import {
  getBaseUrl,
  getDeployInfo,
  getRegistrationMode,
  isGoogleAccountAllowed,
  validateRuntimeConfig,
} from '../src/lib/env'
import type { Bindings } from '../src/types'

function env(overrides: Partial<Bindings> = {}): Bindings {
  return {
    BASE_URL: 'https://board.example.com',
    GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'placeholder-client-secret',
    SESSION_SECRET: 'a-test-session-secret-with-more-than-32-characters',
    REGISTRATION_MODE: 'open',
    ...overrides,
  } as Bindings
}

describe('런타임 설정', () => {
  it('운영 환경에서 HTTPS 기본 URL만 허용한다', () => {
    expect(getBaseUrl(env()).origin).toBe('https://board.example.com')
    expect(() => getBaseUrl(env({ BASE_URL: 'http://board.example.com' }))).toThrow('HTTPS')
    expect(() => getBaseUrl(env({ BASE_URL: 'https://board.example.com/path' }))).toThrow('경로')
  })

  it('Cloudflare 배포 메타데이터를 푸터 표시 형식으로 변환한다', () => {
    const deployInfo = getDeployInfo(
      env({
        CF_VERSION_METADATA: {
          id: '0d2e4a11-2115-41e9-a043-86eab8d2913f',
          tag: '',
          timestamp: '2026-07-25T08:28:29.000Z',
        },
      }),
    )

    expect(deployInfo.version).toBe('0d2e4a11')
    expect(deployInfo.timestamp).toBe('2026-07-25T08:28:29.000Z')
    expect(deployInfo.displayTimestamp).toContain('KST')
  })

  it('가입 모드를 검증한다', () => {
    expect(getRegistrationMode(env({ REGISTRATION_MODE: 'allowlist' }))).toBe('allowlist')
    expect(() => getRegistrationMode(env({ REGISTRATION_MODE: 'unknown' }))).toThrow()
  })

  it('이메일 및 Workspace 도메인 허용 정책을 적용한다', () => {
    expect(
      isGoogleAccountAllowed(
        env({ REGISTRATION_MODE: 'allowlist', ALLOWED_EMAILS: 'member@example.com' }),
        'member@example.com',
        undefined,
      ),
    ).toBe(true)
    expect(
      isGoogleAccountAllowed(
        env({ REGISTRATION_MODE: 'allowlist', ALLOWED_EMAILS: 'member@example.com' }),
        'other@example.com',
        undefined,
      ),
    ).toBe(false)
    expect(
      isGoogleAccountAllowed(
        env({ REGISTRATION_MODE: 'domain', ALLOWED_DOMAINS: 'example.org' }),
        'member@example.org',
        'example.org',
      ),
    ).toBe(true)
  })

  it('Turnstile 키 쌍과 세션 비밀값을 점검한다', () => {
    expect(() => validateRuntimeConfig(env())).not.toThrow()
    expect(() => validateRuntimeConfig(env({ SESSION_SECRET: 'too-short' }))).toThrow('최소 32자')
    expect(() =>
      validateRuntimeConfig(env({ SESSION_SECRET: 'REPLACE_ME_WITH_A_RANDOM_VALUE_THAT_IS_LONG' })),
    ).toThrow('무작위')
    expect(() => validateRuntimeConfig(env({ GOOGLE_CLIENT_SECRET: 'YOUR_GOOGLE_OAUTH_CLIENT_SECRET' }))).toThrow(
      '실제 Google OAuth',
    )
    expect(() => validateRuntimeConfig(env({ TURNSTILE_SITE_KEY: 'site-only' }))).toThrow('함께 설정')
  })
})
