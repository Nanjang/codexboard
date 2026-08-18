export const PRIVATE_IMAGE_SEARCH_MAX_LENGTH = 120

export function normalizePrivateImageSearchQuery(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/gu, ' ').trim().slice(0, PRIVATE_IMAGE_SEARCH_MAX_LENGTH)
}

export function escapePrivateImageLikeQuery(value: string): string {
  return value.replace(/[\\%_]/gu, '\\$&')
}
