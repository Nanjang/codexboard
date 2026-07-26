export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

export function isAllowedImageType(value: unknown): value is AllowedImageType {
  return typeof value === 'string' && (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value)
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
