import type { BookmarkIconColor } from '../types'

export const DEFAULT_BOOKMARK_ICON_COLOR: BookmarkIconColor = 'green'

export const BOOKMARK_ICON_OPTIONS: ReadonlyArray<{
  value: BookmarkIconColor
  label: string
  background: string
  foreground: string
}> = [
  { value: 'green', label: '초록', background: '#e7f3ea', foreground: '#157347' },
  { value: 'blue', label: '파랑', background: '#e7f0ff', foreground: '#2457a6' },
  { value: 'purple', label: '보라', background: '#f0e9ff', foreground: '#6f42c1' },
  { value: 'orange', label: '주황', background: '#fff0df', foreground: '#b85c00' },
  { value: 'rose', label: '분홍', background: '#ffe8ee', foreground: '#b4235a' },
]

export function isBookmarkIconColor(value: unknown): value is BookmarkIconColor {
  return BOOKMARK_ICON_OPTIONS.some((option) => option.value === value)
}

export function normalizeBookmarkIconColor(value: unknown): BookmarkIconColor {
  return isBookmarkIconColor(value) ? value : DEFAULT_BOOKMARK_ICON_COLOR
}

export function bookmarkIconPalette(color: BookmarkIconColor): {
  background: string
  foreground: string
} {
  const option =
    BOOKMARK_ICON_OPTIONS.find((candidate) => candidate.value === color) ??
    BOOKMARK_ICON_OPTIONS[0]!
  return { background: option.background, foreground: option.foreground }
}
