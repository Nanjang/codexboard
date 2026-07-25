import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy } from '../src/lib/security'

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
})
