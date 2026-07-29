import { describe, expect, it } from 'vitest'
import { devlogExcerpt, plainTextAsHtml, postVisibility } from '../src/lib/devlog'
import { imageUploadContentType, normalizeImageServiceBaseUrl } from '../src/lib/image-service'
import { decryptSecret, encryptSecret } from '../src/lib/secret-box'

describe('개발일지 본문', () => {
  it('리치 본문에서 태그를 제외한 요약을 만든다', () => {
    expect(devlogExcerpt('<h2>구성</h2><p>업로드 &amp; 공개 제공</p>', 'rich')).toBe(
      '구성 업로드 & 공개 제공',
    )
  })

  it('기존 일반 텍스트를 안전한 문단 HTML로 바꾼다', () => {
    expect(plainTextAsHtml('<script>alert(1)</script>\n두 번째 줄')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;<br>두 번째 줄</p>',
    )
  })

  it('공개와 비공개 값만 허용한다', () => {
    expect(postVisibility('public')).toBe('public')
    expect(postVisibility('private')).toBe('private')
    expect(() => postVisibility('friends')).toThrow('공개 범위')
  })
})

describe('개발일지 이미지 서비스', () => {
  it('표준 HTTPS 도메인만 등록한다', () => {
    expect(normalizeImageServiceBaseUrl('https://images.example.com/')).toBe('https://images.example.com')
    expect(() => normalizeImageServiceBaseUrl('http://images.example.com')).toThrow('HTTPS')
    expect(() => normalizeImageServiceBaseUrl('https://127.0.0.1')).toThrow('HTTPS')
    expect(() => normalizeImageServiceBaseUrl('https://localhost')).toThrow('HTTPS')
  })

  it('허용된 이미지 MIME 형식만 통과시킨다', () => {
    expect(imageUploadContentType('image/webp; charset=binary')).toBe('image/webp')
    expect(() => imageUploadContentType('image/svg+xml')).toThrow('JPEG')
  })

  it('업로드 토큰을 평문 없이 암호화하고 복호화한다', async () => {
    const token = 'test-upload-token-that-is-long-enough'
    const secret = 'test-session-secret-that-is-also-long-enough'
    const ciphertext = await encryptSecret(token, secret)

    expect(ciphertext).toMatch(/^v1\./u)
    expect(ciphertext).not.toContain(token)
    await expect(decryptSecret(ciphertext, secret)).resolves.toBe(token)
    await expect(decryptSecret(ciphertext, `${secret}-wrong`)).rejects.toThrow('복호화')
  })
})
