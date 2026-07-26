import { describe, expect, it } from 'vitest'
import {
  imageContentType,
  imageObjectKey,
  imagePublicUrl,
  r2ImageOrigins,
} from '../src/lib/r2'
import { localImageValidationError, MAX_IMAGE_BYTES } from '../src/shared/images'
import type { Bindings } from '../src/types'

function env(overrides: Partial<Bindings> = {}): Bindings {
  return {
    R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
    R2_PUBLIC_BASE_URL: 'https://images.example.com',
    ...overrides,
  } as Bindings
}

describe('R2 이미지 설정', () => {
  it('5MiB 제한과 허용 이미지 MIME 유형을 사용한다', () => {
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024)
    expect(imageContentType('image/jpeg')).toBe('image/jpeg')
    expect(imageContentType('image/avif')).toBe('image/avif')
    expect(imageContentType('image/svg+xml')).toBeNull()
    expect(imageContentType('text/html')).toBeNull()
    expect(localImageValidationError({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull()
    expect(localImageValidationError({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toContain('최대 5MiB')
    expect(localImageValidationError({ type: 'image/svg+xml', size: 100 })).toContain('JPEG')
  })

  it('겹치지 않는 무작위 객체 키와 공개 캐시 URL을 만든다', () => {
    const first = imageObjectKey('image/png')
    const second = imageObjectKey('image/png')

    expect(first).toMatch(/^private-images\/[0-9a-f-]+\.png$/u)
    expect(second).not.toBe(first)
    expect(imagePublicUrl(env(), first)).toBe(`https://images.example.com/${first}`)
  })

  it('CSP에 사용할 R2 API와 공개 캐시 출처를 검증한다', () => {
    expect(r2ImageOrigins(env())).toEqual({
      apiOrigin: 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
      publicOrigin: 'https://images.example.com',
    })
    expect(r2ImageOrigins(env({ R2_ACCOUNT_ID: '', R2_PUBLIC_BASE_URL: '' }))).toBeNull()
    expect(r2ImageOrigins(env({ R2_PUBLIC_BASE_URL: 'https://images.example.com/nested' }))).toBeNull()
    expect(imagePublicUrl(env({ R2_PUBLIC_BASE_URL: 'https://user@images.example.com' }), 'image.png')).toBeNull()
  })
})
