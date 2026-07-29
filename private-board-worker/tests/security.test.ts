import { describe, expect, it } from 'vitest'
import type { AppContext } from '../src/types'
import { assertSameOrigin, contentSecurityPolicy, isPublicPath, SameOriginError } from '../src/lib/security'

function originContext(
  url: string,
  headers: Record<string, string> = {},
  method = 'POST',
): AppContext {
  return {
    env: { BASE_URL: 'https://board.oc7.workers.dev' },
    req: {
      method,
      url,
      header: (name: string) => headers[name],
    },
  } as unknown as AppContext
}

describe('동일 출처 검사 진단', () => {
  it('요청 URL Origin 불일치 정보를 구조화한다', () => {
    const run = () => assertSameOrigin(originContext('https://old-board.example.com/dashboard/bookmarks/3/update'))

    expect(run).toThrow(SameOriginError)
    try {
      run()
    } catch (error) {
      expect(error).toBeInstanceOf(SameOriginError)
      expect((error as SameOriginError).details).toMatchObject({
        stage: 'request-url',
        expectedOrigin: 'https://board.oc7.workers.dev',
        requestOrigin: 'https://old-board.example.com',
        method: 'POST',
        path: '/dashboard/bookmarks/3/update',
      })
    }
  })

  it('Origin 헤더가 있으면 Referer 대신 Origin 헤더를 검사한다', () => {
    expect(() =>
      assertSameOrigin(
        originContext('https://board.oc7.workers.dev/dashboard/bookmarks/3/update', {
          Origin: 'https://board.oc7.workers.dev',
          Referer: 'not-a-url',
        }),
      ),
    ).not.toThrow()
  })
})

describe('Content Security Policy', () => {
  it('Google OAuth 리디렉션만 외부 form-action으로 허용한다', () => {
    const policy = contentSecurityPolicy(false)

    expect(policy).toContain("form-action 'self' https://accounts.google.com")
    expect(policy).not.toContain('https://oauth2.googleapis.com')
  })

  it('Turnstile을 켜도 Google OAuth form-action 허용을 유지한다', () => {
    const policy = contentSecurityPolicy(true)

    expect(policy).toContain("script-src 'self' https://challenges.cloudflare.com")
    expect(policy).toContain('frame-src https://challenges.cloudflare.com')
    expect(policy).toContain("form-action 'self' https://accounts.google.com")
  })

  it('HTTPS 본문 이미지와 R2 직접 업로드 연결을 허용한다', () => {
    const policy = contentSecurityPolicy(false, {
      apiOrigin: 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
      publicOrigin: 'https://images.example.com',
    })

    expect(policy).toContain("img-src 'self' https:")
    expect(policy).toContain(
      "connect-src 'self' https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    )
  })
})

describe('공개 경로', () => {
  it('손님 홈과 공개 개발일지만 공개한다', () => {
    const imageHash = 'a'.repeat(64)
    expect(isPublicPath('/')).toBe(true)
    expect(isPublicPath('/boards/free')).toBe(false)
    expect(isPublicPath('/boards/development')).toBe(true)
    expect(isPublicPath('/boards/development/new')).toBe(false)
    expect(isPublicPath('/boards/news')).toBe(false)
    expect(isPublicPath('/posts/1')).toBe(false)
    expect(isPublicPath('/devlogs')).toBe(true)
    expect(isPublicPath('/devlogs/u/user-1')).toBe(true)
    expect(isPublicPath('/devlogs/u/user-1/posts/42')).toBe(true)
    expect(isPublicPath('/devlogs/u/user-1/posts/0')).toBe(false)
    expect(isPublicPath('/devlogs/u/user-1/edit')).toBe(false)
    expect(isPublicPath(`/devlog-images/i/${imageHash}.webp`)).toBe(true)
    expect(isPublicPath('/devlog-images/i/not-a-hash.webp')).toBe(false)
  })
})
