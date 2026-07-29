import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, isPublicPath } from '../src/lib/security'

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
  })
})
