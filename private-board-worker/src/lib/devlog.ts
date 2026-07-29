import { ValidationError } from './validation'

const MAX_RICH_BODY_LENGTH = 20_000
const MAX_RAW_BODY_LENGTH = 50_000
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'h2',
  'h3',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'figure',
  'img',
  'figcaption',
  'code',
  'pre',
  'hr',
])
const DROP_WITH_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
  'form',
  'input',
  'button',
  'textarea',
  'select',
])
const FIGURE_CLASSES = new Set(['devlog-image', 'is-wide', 'is-left', 'is-right'])

function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function safeImageUrl(value: string | null): string | null {
  if (value && /^\/devlog-images\/i\/[a-f0-9]{64}\.webp$/u.test(value)) return value
  return safeHttpsUrl(value)
}

interface RewriterElementAttributes {
  readonly attributes: Iterable<unknown>
  removeAttribute(name: string): unknown
}

export function removeAttributes(element: RewriterElementAttributes): Map<string, string> {
  const attributes = new Map<string, string>()
  const attributeEntries = Array.from(element.attributes)
  for (const attribute of attributeEntries) {
    if (!Array.isArray(attribute)) continue
    const name = attribute[0]
    const value = attribute[1]
    if (typeof name !== 'string' || typeof value !== 'string') continue
    attributes.set(name.toLowerCase(), value)
    element.removeAttribute(name)
  }
  return attributes
}

export async function sanitizeDevlogHtml(rawValue: FormDataEntryValue | null): Promise<string> {
  if (typeof rawValue !== 'string') throw new ValidationError('본문을 입력해 주세요.')
  const raw = rawValue.replaceAll('\u0000', '').trim()
  if (!raw) throw new ValidationError('본문을 입력해 주세요.')
  if (raw.length > MAX_RAW_BODY_LENGTH) throw new ValidationError('본문이 너무 깁니다.')

  const rewriter = new HTMLRewriter()
    .on('*', {
      element(element) {
        const tag = element.tagName.toLowerCase()
        if (DROP_WITH_CONTENT_TAGS.has(tag)) {
          element.remove()
          return
        }
        if (!ALLOWED_TAGS.has(tag)) {
          element.removeAndKeepContent()
          return
        }

        const attributes = removeAttributes(element)
        if (tag === 'a') {
          const href = safeHttpsUrl(attributes.get('href') ?? null)
          if (!href) {
            element.removeAndKeepContent()
            return
          }
          element.setAttribute('href', href)
          element.setAttribute('target', '_blank')
          element.setAttribute('rel', 'noopener noreferrer')
        } else if (tag === 'img') {
          const src = safeImageUrl(attributes.get('src') ?? null)
          if (!src) {
            element.remove()
            return
          }
          const alt = (attributes.get('alt') ?? '').replaceAll(/\s+/gu, ' ').trim().slice(0, 300)
          element.setAttribute('src', src)
          element.setAttribute('alt', alt)
          element.setAttribute('loading', 'lazy')
          element.setAttribute('decoding', 'async')
        } else if (tag === 'figure') {
          const classes = (attributes.get('class') ?? '')
            .split(/\s+/u)
            .filter((className) => FIGURE_CLASSES.has(className))
          element.setAttribute('class', Array.from(new Set(['devlog-image', ...classes])).join(' '))
        }
      },
    })
    .onDocument({
      comments(comment) {
        comment.remove()
      },
    })

  const sanitized = (
    await rewriter
      .transform(new Response(raw, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
      .text()
  ).trim()
  if (sanitized.length > MAX_RICH_BODY_LENGTH) {
    throw new ValidationError(`본문은 HTML 포함 ${MAX_RICH_BODY_LENGTH}자 이하여야 합니다.`)
  }

  const text = sanitized
    .replaceAll(/<[^>]*>/gu, ' ')
    .replaceAll(/&(?:nbsp|amp|lt|gt|quot|#39);/gu, ' ')
    .replaceAll(/\s+/gu, ' ')
    .trim()
  if (!text && !/<img\b/iu.test(sanitized)) throw new ValidationError('본문을 입력해 주세요.')
  return sanitized
}

export function postVisibility(value: FormDataEntryValue | null): 'public' | 'private' {
  if (value === 'public' || value === 'private') return value
  throw new ValidationError('공개 범위를 선택해 주세요.')
}

export function devlogExcerpt(body: string, bodyFormat: 'plain' | 'rich', maxLength = 180): string {
  const text =
    bodyFormat === 'rich'
      ? body
          .replaceAll(/<[^>]*>/gu, ' ')
          .replaceAll(/&nbsp;/gu, ' ')
          .replaceAll(/&amp;/gu, '&')
          .replaceAll(/&lt;/gu, '<')
          .replaceAll(/&gt;/gu, '>')
      : body
  const normalized = text.replaceAll(/\s+/gu, ' ').trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trimEnd()}…` : normalized
}

export function plainTextAsHtml(value: string): string {
  const escaped = value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
  return escaped
    .split(/\n{2,}/u)
    .map((paragraph) => `<p>${paragraph.replaceAll('\n', '<br>')}</p>`)
    .join('')
}
