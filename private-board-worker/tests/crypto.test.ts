import { describe, expect, it } from 'vitest'
import { createPkceChallenge, deriveCsrfToken, safeEqual, sha256Hex } from '../src/lib/crypto'

describe('인증용 암호 유틸리티', () => {
  it('SHA-256과 PKCE 결과가 결정적이다', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await createPkceChallenge('verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/u)
  })

  it('세션별 CSRF 토큰을 분리한다', async () => {
    const secret = 'test-secret-that-is-long-enough-for-hmac'
    const first = await deriveCsrfToken('session-a', secret)
    const second = await deriveCsrfToken('session-b', secret)
    expect(first).not.toBe(second)
    expect(safeEqual(first, first)).toBe(true)
    expect(safeEqual(first, `${first}x`)).toBe(false)
  })
})
