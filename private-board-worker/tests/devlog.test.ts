import { describe, expect, it } from 'vitest'
import { devlogExcerpt, plainTextAsHtml, postVisibility } from '../src/lib/devlog'
import {
  devlogImagePublicUrl,
  ImageServiceVerificationError,
  imageServiceBindingConfigured,
  imageUploadContentType,
  verifyImageService,
} from '../src/lib/image-service'
import { decryptSecret, encryptSecret } from '../src/lib/secret-box'
import {
  devlogImageValidationError,
  MAX_DEVLOG_CLIPBOARD_IMAGE_BYTES,
  MAX_DEVLOG_IMAGE_BYTES,
  normalizedDevlogImageSource,
} from '../src/shared/images'
import type { Bindings } from '../src/types'

function imageEnv(fetcher?: Fetcher): Bindings {
  return { IMAGE_VAULT: fetcher } as Bindings
}

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
  it('같은 Worker origin의 해시 이미지 URL을 만든다', () => {
    const hash = 'a'.repeat(64)
    expect(devlogImagePublicUrl('https://board.example.com/api/devlog/images', hash)).toBe(
      `https://board.example.com/devlog-images/i/${hash}.webp`,
    )
    expect(() => devlogImagePublicUrl('https://board.example.com', 'invalid')).toThrow('해시')
  })

  it('VPC 바인딩을 통해 내부 상태 엔드포인트를 확인한다', async () => {
    let requestedUrl = ''
    const fetcher = {
      async fetch(input: RequestInfo | URL) {
        requestedUrl = new Request(input).url
        return Response.json({ status: 'ok' })
      },
    } as unknown as Fetcher

    expect(imageServiceBindingConfigured(imageEnv())).toBe(false)
    expect(imageServiceBindingConfigured(imageEnv(fetcher))).toBe(true)
    await expect(verifyImageService(imageEnv(fetcher))).resolves.toBeUndefined()
    expect(requestedUrl).toBe('http://localhost:8085/health')
    await expect(verifyImageService(imageEnv())).rejects.toThrow('VPC Service ID')
  })

  it('VPC 상태 확인 실패 과정을 토큰 없이 진단 정보로 남긴다', async () => {
    const fetcher = {
      async fetch() {
        throw new Error('ProxyError: connection_refused')
      },
    } as unknown as Fetcher

    let failure: unknown
    try {
      await verifyImageService(imageEnv(fetcher))
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(ImageServiceVerificationError)
    const diagnostics = (failure as ImageServiceVerificationError).diagnostics
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'VPC 바인딩 확인', value: expect.stringContaining('성공') }),
        expect.objectContaining({ label: 'VPC 요청 전송', value: expect.stringContaining('실패') }),
        expect.objectContaining({
          label: 'Cloudflare 런타임 오류',
          value: expect.stringContaining('connection_refused'),
        }),
      ]),
    )
    expect(JSON.stringify(diagnostics)).not.toContain('Authorization')
  })

  it('VPC가 반환한 오류 상태와 짧은 응답 내용을 진단한다', async () => {
    const fetcher = {
      async fetch() {
        return new Response('upstream unavailable', {
          status: 502,
          headers: { 'Content-Type': 'text/plain' },
        })
      },
    } as unknown as Fetcher

    let failure: unknown
    try {
      await verifyImageService(imageEnv(fetcher))
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(ImageServiceVerificationError)
    const diagnostics = (failure as ImageServiceVerificationError).diagnostics
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'HTTP 응답 확인', value: expect.stringContaining('502') }),
        expect.objectContaining({ label: '응답 본문', value: 'upstream unavailable' }),
      ]),
    )
  })

  it('허용된 이미지 MIME 형식만 통과시킨다', () => {
    expect(imageUploadContentType('image/webp; charset=binary')).toBe('image/webp')
    expect(() => imageUploadContentType('image/svg+xml')).toThrow('JPEG')
  })

  it('파일 선택과 클립보드의 서로 다른 크기 경계를 적용한다', () => {
    expect(
      devlogImageValidationError({ type: 'image/png', size: MAX_DEVLOG_IMAGE_BYTES }, 'file'),
    ).toBeNull()
    expect(
      devlogImageValidationError({ type: 'image/png', size: MAX_DEVLOG_IMAGE_BYTES + 1 }, 'file'),
    ).toContain('10MiB')
    expect(
      devlogImageValidationError(
        { type: 'image/png', size: MAX_DEVLOG_CLIPBOARD_IMAGE_BYTES - 1 },
        'clipboard',
      ),
    ).toBeNull()
    expect(
      devlogImageValidationError(
        { type: 'image/png', size: MAX_DEVLOG_CLIPBOARD_IMAGE_BYTES },
        'clipboard',
      ),
    ).toContain('2MiB 미만')
  })

  it('동일 Worker 이미지는 상대 경로로, 외부 HTTPS 이미지는 절대 주소로 정규화한다', () => {
    const hash = 'b'.repeat(64)
    expect(
      normalizedDevlogImageSource(
        `http://127.0.0.1:8787/devlog-images/i/${hash}.webp`,
        'http://127.0.0.1:8787/boards/development/new',
      ),
    ).toBe(`/devlog-images/i/${hash}.webp`)
    expect(
      normalizedDevlogImageSource(
        'https://images.example.com/object.webp',
        'https://board.example.com/boards/development/new',
      ),
    ).toBe('https://images.example.com/object.webp')
    expect(
      normalizedDevlogImageSource(
        'http://images.example.com/object.webp',
        'https://board.example.com/boards/development/new',
      ),
    ).toBeNull()
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
