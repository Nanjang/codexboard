import type { PostBodyFormat } from '../types'

interface DevlogMarkdownSource {
  id: number
  title: string
  body: string
  body_format: PostBodyFormat
  created_at: number
}

interface ListState {
  type: 'ul' | 'ol'
  index: number
}

function decodeHtmlEntities(value: string): string {
  return value.replaceAll(
    /&(?:#(?<decimal>[0-9]+)|#x(?<hex>[0-9a-f]+)|(?<named>amp|lt|gt|quot|#39|nbsp));/giu,
    (entity, _decimal, _hex, _named, groups?: Record<string, string>) => {
      if (groups?.decimal) return String.fromCodePoint(Number.parseInt(groups.decimal, 10))
      if (groups?.hex) return String.fromCodePoint(Number.parseInt(groups.hex, 16))
      switch (groups?.named?.toLowerCase()) {
        case 'amp':
          return '&'
        case 'lt':
          return '<'
        case 'gt':
          return '>'
        case 'quot':
          return '"'
        case '#39':
          return "'"
        case 'nbsp':
          return ' '
        default:
          return entity
      }
    },
  )
}

function escapeMarkdownText(value: string): string {
  return value.replaceAll(/([\\`*_[\]<>])/gu, '\\$1')
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(
    `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'iu',
  ).exec(tag)
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '') || null
}

function imageFileName(src: string, index: number): string {
  try {
    const url = new URL(src, 'https://devlog-export.invalid')
    const rawName = decodeURIComponent(url.pathname.split('/').at(-1) ?? '')
    const safeName = rawName
      .normalize('NFKC')
      .replaceAll(/[^a-z0-9._-]+/giu, '-')
      .replaceAll(/^-+|-+$/gu, '')
    if (safeName && /\.(?:avif|gif|jpe?g|png|webp)$/iu.test(safeName)) return safeName
  } catch {
    // Fall through to a deterministic export-only name.
  }
  return `image-${index}.webp`
}

function codeFence(value: string): string {
  const longestRun = Math.max(0, ...Array.from(value.matchAll(/`+/gu), (match) => match[0].length))
  return '`'.repeat(Math.max(3, longestRun + 1))
}

export function richDevlogHtmlToMarkdown(html: string): string {
  let markdown = ''
  let preformatted: string | null = null
  let imageIndex = 0
  const lists: ListState[] = []
  const links: string[] = []

  const append = (value: string): void => {
    markdown += value
  }
  const block = (): void => {
    markdown = `${markdown.trimEnd()}\n\n`
  }
  const appendText = (value: string): void => {
    const text = escapeMarkdownText(decodeHtmlEntities(value)).replaceAll(/\s+/gu, ' ')
    if (!text) return
    append(/\s$/u.test(markdown) && /^\s/u.test(text) ? text.trimStart() : text)
  }

  for (const token of html.match(/<[^>]*>|[^<]+/gu) ?? []) {
    if (!token.startsWith('<')) {
      if (preformatted !== null) preformatted += decodeHtmlEntities(token)
      else appendText(token)
      continue
    }

    const tagMatch = /^<\s*(\/?)\s*([a-z0-9]+)/iu.exec(token)
    if (!tagMatch) continue
    const closing = tagMatch[1] === '/'
    const tag = tagMatch[2]?.toLowerCase()
    if (!tag) continue

    if (preformatted !== null) {
      if (closing && tag === 'pre') {
        const content = preformatted.replaceAll(/\r\n?/gu, '\n').replaceAll(/\n+$/gu, '')
        const fence = codeFence(content)
        append(`${fence}\n${content}\n${fence}`)
        block()
        preformatted = null
      } else if (!closing && tag === 'br') {
        preformatted += '\n'
      }
      continue
    }

    if (!closing) {
      switch (tag) {
        case 'p':
        case 'figure':
        case 'blockquote':
          block()
          if (tag === 'blockquote') append('> ')
          break
        case 'h2':
          block()
          append('## ')
          break
        case 'h3':
          block()
          append('### ')
          break
        case 'strong':
        case 'b':
          append('**')
          break
        case 'em':
        case 'i':
          append('*')
          break
        case 's':
          append('~~')
          break
        case 'code':
          append('`')
          break
        case 'pre':
          block()
          preformatted = ''
          break
        case 'br':
          append('  \n')
          break
        case 'hr':
          block()
          append('---')
          block()
          break
        case 'a':
          links.push(attribute(token, 'href') ?? '')
          append('[')
          break
        case 'ul':
        case 'ol':
          if (lists.length === 0) block()
          lists.push({ type: tag, index: 0 })
          break
        case 'li': {
          markdown = `${markdown.trimEnd()}\n`
          const current = lists.at(-1)
          if (current) current.index += 1
          const prefix = current?.type === 'ol' ? `${current.index}. ` : '- '
          append(`${'  '.repeat(Math.max(0, lists.length - 1))}${prefix}`)
          break
        }
        case 'img': {
          imageIndex += 1
          const src = attribute(token, 'src') ?? ''
          const alt = escapeMarkdownText(attribute(token, 'alt') ?? '')
          append(`![${alt}](images/${imageFileName(src, imageIndex)})`)
          break
        }
        case 'figcaption':
          append('\n\n*')
          break
      }
      continue
    }

    switch (tag) {
      case 'p':
      case 'h2':
      case 'h3':
      case 'blockquote':
      case 'figure':
        block()
        break
      case 'strong':
      case 'b':
        append('**')
        break
      case 'em':
      case 'i':
        append('*')
        break
      case 's':
        append('~~')
        break
      case 'code':
        append('`')
        break
      case 'a': {
        const href = links.pop() ?? ''
        append(href ? `](${href})` : ']')
        break
      }
      case 'ul':
      case 'ol':
        lists.pop()
        if (lists.length === 0) block()
        break
      case 'li':
        markdown = `${markdown.trimEnd()}\n`
        break
      case 'figcaption':
        append('*')
        break
    }
  }

  if (preformatted !== null) {
    const fence = codeFence(preformatted)
    append(`${fence}\n${preformatted}\n${fence}`)
  }

  return markdown
    .replaceAll(/[ \t]+\n/gu, '\n')
    .replaceAll(/\n{3,}/gu, '\n\n')
    .trim()
}

export function devlogMarkdownDocument(post: DevlogMarkdownSource): string {
  const title = escapeMarkdownText(post.title)
  const body =
    post.body_format === 'rich'
      ? richDevlogHtmlToMarkdown(post.body)
      : post.body
          .replaceAll(/\r\n?/gu, '\n')
          .split('\n')
          .map(escapeMarkdownText)
          .join('\n')
          .trim()
  return `# ${title}\n${body ? `\n${body}\n` : ''}`
}

export function devlogMarkdownFilename(post: Pick<DevlogMarkdownSource, 'id' | 'created_at'>): string {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(post.created_at)
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    dateParts.find((entry) => entry.type === type)?.value ?? '00'
  return `${part('year')}-${part('month')}-${part('day')}-devlog-${post.id}.md`
}
