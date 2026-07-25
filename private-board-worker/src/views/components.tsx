import type { CurrentUser, DeployInfo } from '../types'

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

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <section class="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </section>
  )
}
