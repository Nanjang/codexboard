import { isDevlogImagePath } from '../shared/images'
import { ValidationError } from './validation'

export const DEVLOG_PREVIEW_IMAGE_RESET_VALUE = 'reset-current'

const MAX_PREVIEW_IMAGE_URL_LENGTH = 2048
const FIRST_IMAGE_SOURCE_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/iu

function decodeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function safePreviewImageSource(value: string): string | null {
  const decoded = decodeHtmlAttribute(value).trim()
  if (!decoded || decoded.length > MAX_PREVIEW_IMAGE_URL_LENGTH) return null
  if (isDevlogImagePath(decoded)) return decoded

  try {
    const url = new URL(decoded)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

export function firstDevlogImageSource(html: string): string | null {
  const match = FIRST_IMAGE_SOURCE_PATTERN.exec(html)
  const source = match?.[1] ?? match?.[2]
  return source === undefined ? null : safePreviewImageSource(source)
}

export function devlogPreviewImageResetRequested(value: FormDataEntryValue | null): boolean {
  if (value === null) return false
  if (value === DEVLOG_PREVIEW_IMAGE_RESET_VALUE) return true
  throw new ValidationError('미리보기 이미지 재설정 요청이 올바르지 않습니다.')
}

export function validateDevlogPreviewImageReset(
  value: FormDataEntryValue | null,
  fixedPreviewImageUrl: string | null,
  sanitizedBody: string,
): boolean {
  if (!devlogPreviewImageResetRequested(value)) return false

  const currentFirstImageUrl = firstDevlogImageSource(sanitizedBody)
  if (!fixedPreviewImageUrl) {
    throw new ValidationError('고정된 미리보기 이미지가 없어 재설정할 수 없습니다.')
  }
  if (!currentFirstImageUrl) {
    throw new ValidationError('본문에 미리보기로 사용할 이미지가 없습니다.')
  }
  if (fixedPreviewImageUrl === currentFirstImageUrl) {
    throw new ValidationError('현재 첫 이미지가 이미 미리보기 이미지로 지정되어 있습니다.')
  }
  return true
}
