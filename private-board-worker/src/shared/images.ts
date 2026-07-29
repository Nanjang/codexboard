export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_DEVLOG_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_DEVLOG_CLIPBOARD_IMAGE_BYTES = 2 * 1024 * 1024

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]
export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'png', 'webp', 'gif', 'avif'] as const
export type AllowedImageExtension = (typeof ALLOWED_IMAGE_EXTENSIONS)[number]

const IMAGE_EXTENSION_BY_CONTENT_TYPE: Record<AllowedImageType, AllowedImageExtension> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

const IMAGE_CONTENT_TYPE_BY_EXTENSION: Record<AllowedImageExtension, AllowedImageType> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
}

export const DEVLOG_IMAGE_FILENAME_PATTERN =
  /^([a-f0-9]{64})\.(jpg|png|webp|gif|avif)$/u
export const IMAGE_PUBLIC_PREFIX = '/i'

export function isAllowedImageType(value: unknown): value is AllowedImageType {
  return typeof value === 'string' && (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value)
}

export function isAllowedImageExtension(value: unknown): value is AllowedImageExtension {
  return (
    typeof value === 'string' &&
    (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(value)
  )
}

export function imageExtensionForContentType(value: unknown): AllowedImageExtension | null {
  return isAllowedImageType(value) ? IMAGE_EXTENSION_BY_CONTENT_TYPE[value] : null
}

export function imageContentTypeForExtension(value: unknown): AllowedImageType | null {
  return isAllowedImageExtension(value) ? IMAGE_CONTENT_TYPE_BY_EXTENSION[value] : null
}

export function isDevlogImagePath(path: string): boolean {
  const prefixes = [`${IMAGE_PUBLIC_PREFIX}/`, '/devlog-images/i/']
  return prefixes.some((prefix) => path.startsWith(prefix) && DEVLOG_IMAGE_FILENAME_PATTERN.test(path.slice(prefix.length)))
}

export function localImageValidationError(file: { size: number; type: string }): string | null {
  if (!isAllowedImageType(file.type)) {
    return 'JPEG, PNG, WebP, GIF, AVIF 이미지만 업로드할 수 있습니다.'
  }
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
    return '이미지는 최대 5MiB까지 업로드할 수 있습니다.'
  }
  return null
}

export function devlogImageValidationError(
  file: { size: number; type: string },
  source: 'file' | 'clipboard',
): string | null {
  if (!isAllowedImageType(file.type.toLowerCase())) {
    return 'JPEG, PNG, WebP, GIF, AVIF 이미지만 업로드할 수 있습니다.'
  }

  const validSize =
    source === 'clipboard'
      ? file.size >= 1 && file.size < MAX_DEVLOG_CLIPBOARD_IMAGE_BYTES
      : file.size >= 1 && file.size <= MAX_DEVLOG_IMAGE_BYTES
  if (validSize) return null

  return source === 'clipboard'
    ? '클립보드 이미지는 2MiB 미만인 경우에만 붙여넣을 수 있습니다.'
    : '이미지는 최대 10MiB까지 업로드할 수 있습니다.'
}

export function normalizedDevlogImageSource(value: string, pageUrl: string): string | null {
  let imageUrl: URL
  let page: URL
  try {
    imageUrl = new URL(value, pageUrl)
    page = new URL(pageUrl)
  } catch {
    return null
  }

  if (imageUrl.username || imageUrl.password || imageUrl.search || imageUrl.hash) return null
  if (
    imageUrl.origin === page.origin &&
    isDevlogImagePath(imageUrl.pathname)
  ) {
    return imageUrl.pathname
  }
  return imageUrl.protocol === 'https:' ? imageUrl.toString() : null
}
