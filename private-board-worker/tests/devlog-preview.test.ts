import { describe, expect, it } from 'vitest'
import {
  DEVLOG_PREVIEW_IMAGE_RESET_VALUE,
  devlogPreviewImageResetRequested,
  firstDevlogImageSource,
  validateDevlogPreviewImageReset,
} from '../src/lib/devlog-preview'

const firstImage = `/devlog-images/i/${'a'.repeat(64)}.gif`
const secondImage = `/devlog-images/i/${'b'.repeat(64)}.png`

describe('development log preview images', () => {
  it('returns the first safe image source in document order', () => {
    expect(
      firstDevlogImageSource(
        `<p>before</p><img alt="one" src="${firstImage}"><img src="${secondImage}">`,
      ),
    ).toBe(firstImage)
  })

  it('supports sanitized HTTPS image sources and decodes attributes', () => {
    expect(
      firstDevlogImageSource(
        '<figure><img src="https://images.example.com/one.png?width=2&amp;height=1"></figure>',
      ),
    ).toBe('https://images.example.com/one.png?width=2&height=1')
  })

  it('rejects unsafe or unsupported image sources', () => {
    expect(firstDevlogImageSource('<img src="javascript:alert(1)">')).toBeNull()
    expect(firstDevlogImageSource(`/devlog-images/i/${'c'.repeat(64)}.bmp`)).toBeNull()
    expect(firstDevlogImageSource('<p>no image</p>')).toBeNull()
  })

  it('accepts only the explicit reset submit value', () => {
    expect(devlogPreviewImageResetRequested(null)).toBe(false)
    expect(devlogPreviewImageResetRequested(DEVLOG_PREVIEW_IMAGE_RESET_VALUE)).toBe(true)
    expect(() => devlogPreviewImageResetRequested('true')).toThrow(
      '미리보기 이미지 재설정 요청이 올바르지 않습니다.',
    )
  })

  it('allows reset only when a different fixed and first image both exist', () => {
    const body = `<p>changed order</p><img src="${secondImage}">`
    expect(
      validateDevlogPreviewImageReset(
        DEVLOG_PREVIEW_IMAGE_RESET_VALUE,
        firstImage,
        body,
      ),
    ).toBe(true)
    expect(() =>
      validateDevlogPreviewImageReset(DEVLOG_PREVIEW_IMAGE_RESET_VALUE, null, body),
    ).toThrow('고정된 미리보기 이미지가 없어 재설정할 수 없습니다.')
    expect(() =>
      validateDevlogPreviewImageReset(
        DEVLOG_PREVIEW_IMAGE_RESET_VALUE,
        firstImage,
        '<p>no image</p>',
      ),
    ).toThrow('본문에 미리보기로 사용할 이미지가 없습니다.')
    expect(() =>
      validateDevlogPreviewImageReset(
        DEVLOG_PREVIEW_IMAGE_RESET_VALUE,
        firstImage,
        `<img src="${firstImage}">`,
      ),
    ).toThrow('현재 첫 이미지가 이미 미리보기 이미지로 지정되어 있습니다.')
  })
})
