import type { CurrentUser, DeployInfo, UserRole } from '../types'

export function DeployFooter({ deployInfo }: { deployInfo: DeployInfo }) {
  return (
    <footer class="deploy-footer" aria-hidden="true">
      <span>deploy {deployInfo.version}</span>
      <span aria-hidden="true">·</span>
      <time datetime={deployInfo.timestamp}>{deployInfo.displayTimestamp}</time>
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
