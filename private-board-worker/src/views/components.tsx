import type { CurrentUser, DeployInfo, UserRole } from '../types'

export function DeployFooter({ deployInfo }: { deployInfo: DeployInfo }) {
  return (
    <footer class="deploy-footer">
      <span class="visitor-footer" aria-label="방문자 통계">
        오늘 <strong data-visitor-today>—</strong>
        <span aria-hidden="true"> · </span>
        누적 <strong data-visitor-total>—</strong>
      </span>
      <span aria-hidden="true">·</span>
      <span>deploy {deployInfo.version}</span>
      <span aria-hidden="true">·</span>
      <time datetime={deployInfo.timestamp}>{deployInfo.displayTimestamp}</time>
      <span aria-hidden="true">·</span>
      <span class="database-usage" data-database-usage-tooltip title="사용량 확인 중">
        <progress data-database-usage-bar max="100" value="0" aria-hidden="true"></progress>
        <span data-database-usage aria-label="사용량 확인 중">—</span>
      </span>
    </footer>
  )
}

export function CsrfInput({ token }: { token: string }) {
  return <input type="hidden" name="_csrf" value={token} />
}

export function Notice({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div class="notice" role="status" data-dismissible>
      <span>{message}</span>
      <button type="button" class="notice-close" aria-label="알림 닫기" data-dismiss>
        ×
      </button>
    </div>
  )
}

export function ErrorNotice({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div class="notice notice-error" role="alert">
      {message}
    </div>
  )
}

interface AutoLinkTextPart {
  kind: 'text' | 'link'
  text: string
}

const plainTextUrlPattern = /https?:\/\/[^\s<>"']+/giu

function trimUrlPunctuation(value: string): { url: string; suffix: string } {
  let url = value
  let suffix = ''

  while (/[.,!?;:]$/u.test(url)) {
    suffix = `${url.slice(-1)}${suffix}`
    url = url.slice(0, -1)
  }

  const matchingPairs: Array<[string, string]> = [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ]
  for (const [opening, closing] of matchingPairs) {
    while (url.endsWith(closing)) {
      const openingCount = [...url].filter((character) => character === opening).length
      const closingCount = [...url].filter((character) => character === closing).length
      if (closingCount <= openingCount) break
      suffix = `${closing}${suffix}`
      url = url.slice(0, -1)
    }
  }

  return { url, suffix }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

export function AutoLinkText({ text }: { text: string }) {
  const parts: AutoLinkTextPart[] = []
  let cursor = 0

  for (const match of text.matchAll(plainTextUrlPattern)) {
    const rawUrl = match[0]
    const start = match.index ?? cursor
    const { url, suffix } = trimUrlPunctuation(rawUrl)
    if (!url || !isHttpUrl(url)) continue

    if (start > cursor) parts.push({ kind: 'text', text: text.slice(cursor, start) })
    parts.push({ kind: 'link', text: url })
    if (suffix) parts.push({ kind: 'text', text: suffix })
    cursor = start + rawUrl.length
  }

  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) })
  if (parts.length === 0) return <>{text}</>

  return (
    <>
      {parts.map((part, index) =>
        part.kind === 'link' ? (
          <a
            class="auto-link"
            href={part.text}
            target="_blank"
            rel="noopener noreferrer"
            key={`${part.kind}-${index}`}
          >
            {part.text}
          </a>
        ) : (
          <span key={`${part.kind}-${index}`}>{part.text}</span>
        ),
      )}
    </>
  )
}

export function UserBadge({ user }: { user: CurrentUser }) {
  return (
    <span class="user-badge">
      <span class="user-initial" aria-hidden="true">
        {user.nickname.slice(0, 1).toUpperCase()}
      </span>
      <span class="user-badge-text">
        <strong>{user.nickname}</strong>
        <small>{user.role === 'admin' ? '관리자' : '회원'}</small>
      </span>
    </span>
  )
}

export function PrivateEmail({
  user,
  className,
}: {
  user: CurrentUser
  className?: string
}) {
  const classes = [className, 'private-email', user.emailHidden ? 'is-hidden' : '']
    .filter(Boolean)
    .join(' ')

  if (user.emailHidden) {
    return (
      <span class={classes} aria-label="이메일 정보 가림" data-email-hidden="true">
        <span class="private-email-mask" aria-hidden="true"></span>
      </span>
    )
  }

  return <span class={classes}>{user.email}</span>
}

export function AuthorName({ nickname, role }: { nickname: string; role: UserRole }) {
  return (
    <>
      {nickname}
      {role === 'admin' ? (
        <span class="admin-author-star" aria-label="관리자" title="관리자">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m12 2.75 2.83 5.73 6.32.92-4.57 4.45 1.08 6.29L12 17.17l-5.66 2.97 1.08-6.29L2.85 9.4l6.32-.92L12 2.75Z" />
          </svg>
        </span>
      ) : null}
    </>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <section class="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </section>
  )
}
