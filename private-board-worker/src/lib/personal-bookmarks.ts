import { ValidationError } from './validation'

export const PERSONAL_BOOKMARKS_PER_PAGE = 100
export const PERSONAL_BOOKMARK_ICON_MAX_BYTES = 128 * 1024
export const PERSONAL_BOOKMARK_FORM_MAX_BYTES = PERSONAL_BOOKMARK_ICON_MAX_BYTES + 64 * 1024

const PERSONAL_BOOKMARK_ICON_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
])

export interface PersonalBookmarkIconData {
  contentType: string
  bytes: Uint8Array
}

export async function personalBookmarkIcon(
  value: FormDataEntryValue | null,
  required: boolean,
): Promise<PersonalBookmarkIconData | null> {
  if (!(value instanceof File) || value.size === 0) {
    if (required) throw new ValidationError('아이콘 이미지를 업로드해 주세요.')
    return null
  }

  const contentType = value.type.toLowerCase()
  if (!PERSONAL_BOOKMARK_ICON_TYPES.has(contentType)) {
    throw new ValidationError('아이콘은 PNG, JPG, WebP, GIF 또는 AVIF 이미지만 사용할 수 있습니다.')
  }
  if (value.size > PERSONAL_BOOKMARK_ICON_MAX_BYTES) {
    throw new ValidationError('아이콘 이미지는 최대 128KiB까지 업로드할 수 있습니다.')
  }

  const bytes = new Uint8Array(await value.arrayBuffer())
  if (bytes.byteLength === 0 || bytes.byteLength > PERSONAL_BOOKMARK_ICON_MAX_BYTES) {
    throw new ValidationError('아이콘 이미지 크기가 올바르지 않습니다.')
  }
  return { contentType, bytes }
}

export function storedPersonalBookmarkIcon(bytes: number[], contentType: string): Response {
  if (
    !PERSONAL_BOOKMARK_ICON_TYPES.has(contentType)
    || bytes.length === 0
    || bytes.length > PERSONAL_BOOKMARK_ICON_MAX_BYTES
  ) {
    return new Response(null, { status: 404 })
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Cache-Control': 'private, max-age=86400',
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export function moveToPreviousPageOrder(
  segmentIds: number[],
  bookmarkId: number,
): number[] {
  const movedIndex = segmentIds.indexOf(bookmarkId)
  if (segmentIds.length <= PERSONAL_BOOKMARKS_PER_PAGE || movedIndex < PERSONAL_BOOKMARKS_PER_PAGE) {
    throw new Error('이 항목은 현재 페이지에서 앞 페이지로 이동할 수 없습니다.')
  }

  const reordered = segmentIds.filter((id) => id !== bookmarkId)
  reordered.splice(PERSONAL_BOOKMARKS_PER_PAGE - 1, 0, bookmarkId)
  return reordered
}
