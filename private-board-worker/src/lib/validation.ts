import type {
  BoardSlug,
  BookmarkIconColor,
  TicketChecklistItemInput,
  TicketTagColor,
  TicketTagTextColor,
} from '../types'
import { isBookmarkIconColor } from './bookmark-icon-palette'
import { normalizeRssUrl, RssFeedError } from './rss'

export class ValidationError extends Error {
  readonly status = 400
}

function normalizeNewlines(value: string): string {
  return value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').replaceAll('\u0000', '')
}

export function singleLine(value: FormDataEntryValue | null, fieldName: string, maxLength: number): string {
  if (typeof value !== 'string') throw new ValidationError(`${fieldName}을(를) 입력하세요.`)
  const normalized = normalizeNewlines(value).replaceAll('\n', ' ').trim()
  if (!normalized) throw new ValidationError(`${fieldName}을(를) 입력하세요.`)
  if (normalized.length > maxLength) {
    throw new ValidationError(`${fieldName}은(는) ${maxLength}자 이하여야 합니다.`)
  }
  return normalized
}

export function optionalSingleLine(
  value: FormDataEntryValue | null,
  fieldName: string,
  maxLength: number,
): string {
  if (value === null) return ''
  if (typeof value !== 'string') throw new ValidationError(`${fieldName} 형식이 올바르지 않습니다.`)
  const normalized = normalizeNewlines(value).replaceAll('\n', ' ').trim()
  if (normalized.length > maxLength) {
    throw new ValidationError(`${fieldName}은(는) ${maxLength}자 이하여야 합니다.`)
  }
  return normalized
}

export function multiline(
  value: FormDataEntryValue | null,
  fieldName: string,
  maxLength: number,
  required = true,
): string {
  if (typeof value !== 'string') {
    if (!required) return ''
    throw new ValidationError(`${fieldName}을(를) 입력하세요.`)
  }
  const normalized = normalizeNewlines(value).trim()
  if (required && !normalized) throw new ValidationError(`${fieldName}을(를) 입력하세요.`)
  if (normalized.length > maxLength) {
    throw new ValidationError(`${fieldName}은(는) ${maxLength}자 이하여야 합니다.`)
  }
  return normalized
}

export function nickname(value: FormDataEntryValue | null): string {
  const normalized = singleLine(value, '닉네임', 24).replace(/\s+/gu, ' ')
  if (normalized.length < 2) throw new ValidationError('닉네임은 2자 이상이어야 합니다.')
  if (!/^[\p{L}\p{N} _-]+$/u.test(normalized)) {
    throw new ValidationError('닉네임에는 문자, 숫자, 공백, 밑줄, 하이픈만 사용할 수 있습니다.')
  }
  return normalized
}

export function positiveInteger(value: string, fieldName = 'ID'): number {
  if (!/^[1-9][0-9]*$/u.test(value)) throw new ValidationError(`${fieldName} 형식이 올바르지 않습니다.`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw new ValidationError(`${fieldName}가 너무 큽니다.`)
  return parsed
}

export function ticketLane(value: FormDataEntryValue | string | null): 'long-term' | 'todo' | 'doing' | 'done' | 'preserved' {
  if (value === 'long-term' || value === 'todo' || value === 'doing' || value === 'done' || value === 'preserved') return value
  throw new ValidationError('작업 상태가 올바르지 않습니다.')
}

export function ticketTagColor(value: FormDataEntryValue | string | null): TicketTagColor {
  if (
    value === 'coral'
    || value === 'orange'
    || value === 'green'
    || value === 'blue'
    || value === 'purple'
    || value === 'yellow'
    || value === 'gray-light'
    || value === 'gray'
    || value === 'gray-dark'
  ) {
    return value
  }
  throw new ValidationError('태그 색상이 올바르지 않습니다.')
}

export function ticketTagTextColor(value: FormDataEntryValue | string | null): TicketTagTextColor {
  if (value === 'white' || value === 'black') return value
  throw new ValidationError('태그 글자색이 올바르지 않습니다.')
}

export function optionalHexColor(
  value: FormDataEntryValue | string | null,
  fieldName: string,
): string | null {
  if (value === null || value === '') return null
  if (typeof value !== 'string') throw new ValidationError(`${fieldName} 형식이 올바르지 않습니다.`)
  const normalized = value.trim().replace(/^#/u, '')
  if (!/^[0-9a-f]{6}$/iu.test(normalized)) {
    throw new ValidationError(`${fieldName}는 6자리 헥스 코드로 입력해 주세요.`)
  }
  return `#${normalized.toUpperCase()}`
}

export function ticketTagIds(values: FormDataEntryValue[]): number[] {
  if (values.length > 10) throw new ValidationError('티켓에는 태그를 최대 10개까지 추가할 수 있습니다.')
  const ids = values.map((value) => {
    if (typeof value !== 'string') throw new ValidationError('태그 ID 형식이 올바르지 않습니다.')
    return positiveInteger(value, '태그 ID')
  })
  if (new Set(ids).size !== ids.length) throw new ValidationError('중복된 태그가 있습니다.')
  return ids
}

export function ticketChecklistEnabled(form: FormData): boolean {
  return form.has('checklist_enabled')
}

export function ticketChecklistItems(form: FormData): TicketChecklistItemInput[] {
  const keys = form.getAll('checklist_item_key')
  const titles = form.getAll('checklist_item_title')
  const completedKeys = new Set(
    form.getAll('checklist_item_completed').filter((value): value is string => typeof value === 'string'),
  )
  if (keys.length !== titles.length) throw new ValidationError('체크리스트 항목 형식이 올바르지 않습니다.')
  if (keys.length > 50) throw new ValidationError('체크리스트 항목은 최대 50개까지 추가할 수 있습니다.')

  const seenKeys = new Set<string>()
  const items: TicketChecklistItemInput[] = []
  keys.forEach((rawKey, index) => {
    if (typeof rawKey !== 'string') throw new ValidationError('체크리스트 항목 형식이 올바르지 않습니다.')
    const title = optionalSingleLine(titles[index] ?? null, '체크리스트 항목', 200)
    if (!title) return
    if (!/^(?:[1-9][0-9]*|new-[0-9]+)$/u.test(rawKey) || seenKeys.has(rawKey)) {
      throw new ValidationError('체크리스트 항목 형식이 올바르지 않습니다.')
    }
    seenKeys.add(rawKey)
    const id = rawKey.startsWith('new-') ? null : positiveInteger(rawKey, '체크리스트 항목 ID')
    items.push({
      id,
      title,
      completed: completedKeys.has(rawKey),
    })
  })
  return items
}

export function ticketCreationRequestId(value: FormDataEntryValue | null): string {
  if (
    typeof value !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
  ) {
    throw new ValidationError('티켓 생성 요청값이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 시도하세요.')
  }
  return value.toLowerCase()
}

export function boardSlug(value: string): BoardSlug {
  if (value === 'free' || value === 'development' || value === 'news' || value === 'inquiry') return value
  throw new ValidationError('존재하지 않는 게시판입니다.')
}

export function bookmarkUrl(value: FormDataEntryValue | null): string {
  const normalized = singleLine(value, 'URL', 2048)
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new ValidationError('올바른 URL을 입력하세요.')
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new ValidationError('북마크는 사용자 정보가 없는 http 또는 https URL만 지원합니다.')
  }
  return url.toString()
}

export function memoLinkUrl(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') throw new ValidationError('링크 URL을 입력하세요.')
  const normalized = value.trim()
  if (normalized.length < 1 || normalized.length > 500) {
    throw new ValidationError('링크 URL은 500자 이하로 입력하세요.')
  }

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new ValidationError('올바른 링크 URL을 입력하세요.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new ValidationError('링크 타입은 사용자 정보가 없는 http 또는 https URL만 지원합니다.')
  }
  return normalized
}

export function bookmarkIconMode(value: FormDataEntryValue | null): 'default' | 'url' {
  if (value === 'default' || value === 'url') return value
  throw new ValidationError('아이콘 사용 방식을 선택해 주세요.')
}

export function bookmarkIconColor(value: FormDataEntryValue | null): BookmarkIconColor {
  if (typeof value === 'string' && isBookmarkIconColor(value)) return value
  throw new ValidationError('기본 아이콘 색상을 선택해 주세요.')
}

export function manualBookmarkIconUrl(value: FormDataEntryValue | null): string {
  const normalized = singleLine(value, '아이콘 URL', 2048)
  try {
    return normalizeRssUrl(normalized)
  } catch {
    throw new ValidationError('아이콘 URL은 공개 HTTPS 이미지 주소여야 합니다.')
  }
}

export function rssUrl(value: FormDataEntryValue | null): string {
  const normalized = singleLine(value, 'RSS 주소', 2048)
  try {
    return normalizeRssUrl(normalized)
  } catch (error) {
    if (error instanceof RssFeedError) throw new ValidationError(error.message)
    throw error
  }
}

export function isNumericMemoValue(value: string): boolean {
  return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(value)
}

export function validateMemoUrlTemplate(prefix: string, suffix: string, label: string): void {
  if (!prefix && !suffix) return

  let url: URL
  try {
    url = new URL(`${prefix}${encodeURIComponent('sample')}${suffix}`)
  } catch {
    throw new ValidationError(`${label} URL 조합이 올바른 절대 URL이 아닙니다.`)
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new ValidationError(`${label} URL은 사용자 정보가 없는 http 또는 https 주소여야 합니다.`)
  }
}
