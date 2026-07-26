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

export function ticketLane(value: FormDataEntryValue | string | null): 'todo' | 'doing' | 'done' {
  if (value === 'todo' || value === 'doing' || value === 'done') return value
  throw new ValidationError('작업 상태가 올바르지 않습니다.')
}

export function boardSlug(value: string): 'free' | 'inquiry' {
  if (value === 'free' || value === 'inquiry') return value
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
