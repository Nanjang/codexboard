import type { Child } from 'hono/jsx'
import type { CurrentUser, DeployInfo } from '../types'
import { CsrfInput, DeployFooter, Notice, UserBadge } from './components'

type ActiveNav =
  | 'dashboard'
  | 'free'
  | 'development'
  | 'news'
  | 'inquiry'
  | 'memos'
  | 'images'
  | 'tickets'
  | 'account'
  | 'admin'
  | null

type ContextAction =
  | { kind: 'link'; label: string; href: string; dialogId?: string }
  | { kind: 'button'; label: string; dialogId: string }

interface AppLayoutProps {
  appName: string
  deployInfo: DeployInfo
  documentTitle: string
  topbarTitle: string
  user: CurrentUser
  csrfToken: string
  activeNav: ActiveNav
  notice?: string | null
  backHref?: string
  contextAction?: ContextAction
  children: Child
}

export function AppLayout({
  appName,
  deployInfo,
  documentTitle,
  topbarTitle,
  user,
  csrfToken,
  activeNav,
  notice = null,
  backHref,
  contextAction,
  children,
}: AppLayoutProps) {
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#f97316" />
        <meta name="csrf-token" content={csrfToken} />
        <title>
          {documentTitle} · {appName}
        </title>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/favicon.png" sizes="64x64" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="stylesheet" href="/assets/app.css" />
        <link rel="stylesheet" href="/account/theme.css" />
        <script src="/assets/app.js" defer></script>
      </head>
      <body class="app-body">
        <header class="topbar">
          <div class="topbar-context">
            {backHref ? (
              <a class="icon-button topbar-back" href={backHref} aria-label="이전 화면">
                <span aria-hidden="true">←</span>
              </a>
            ) : null}
            <div class="topbar-title-wrap">
              <span class="topbar-app-name">{appName}</span>
              <h1 class="topbar-title">{topbarTitle}</h1>
            </div>
          </div>

          <div class="topbar-actions">
            {contextAction?.kind === 'link' ? (
              <a
                class="button button-compact"
                href={contextAction.href}
                {...(contextAction.dialogId ? { 'data-dialog-open': contextAction.dialogId } : {})}
              >
                {contextAction.label}
              </a>
            ) : null}
            {contextAction?.kind === 'button' ? (
              <button class="button button-compact" type="button" data-dialog-open={contextAction.dialogId}>
                {contextAction.label}
              </button>
            ) : null}

            <button
              type="button"
              class="icon-button menu-toggle"
              aria-label="전체 메뉴 열기"
              aria-expanded="false"
              aria-controls="app-menu"
              data-menu-toggle
            >
              <span class="menu-lines" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          </div>
        </header>

        <div class="menu-layer" hidden data-menu-layer>
          <button class="menu-backdrop" type="button" aria-label="메뉴 닫기" data-menu-close></button>
          <aside id="app-menu" class="menu-panel" aria-label="전체 메뉴" tabindex={-1}>
            <div class="menu-header">
              <UserBadge user={user} />
              <button type="button" class="icon-button" aria-label="메뉴 닫기" data-menu-close>
                ×
              </button>
            </div>
            <nav class="menu-nav" aria-label="서비스 메뉴">
              <a href="/" aria-current={activeNav === 'dashboard' ? 'page' : undefined}>
                내 대시보드
              </a>
              <a href="/boards/free" aria-current={activeNav === 'free' ? 'page' : undefined}>
                자유게시판
              </a>
              <a href="/boards/development" aria-current={activeNav === 'development' ? 'page' : undefined}>
                개발
              </a>
              <a href="/boards/news" aria-current={activeNav === 'news' ? 'page' : undefined}>
                뉴스
              </a>
              <a href="/boards/inquiry" aria-current={activeNav === 'inquiry' ? 'page' : undefined}>
                문의
              </a>
              <a href="/memos" aria-current={activeNav === 'memos' ? 'page' : undefined}>
                내 메모
              </a>
              {user.imageStorageEnabled === true ? (
                <a href="/images" aria-current={activeNav === 'images' ? 'page' : undefined}>
                  개인 이미지 저장
                </a>
              ) : null}
              <a href="/tickets" aria-current={activeNav === 'tickets' ? 'page' : undefined}>
                내 작업
              </a>
              <a href="/account" aria-current={activeNav === 'account' ? 'page' : undefined}>
                내 계정
              </a>
              {user.role === 'admin' ? (
                <a href="/admin" aria-current={activeNav === 'admin' ? 'page' : undefined}>
                  관리자 설정
                </a>
              ) : null}
            </nav>
            <div class="menu-footer">
              <span class="menu-email">{user.email}</span>
              <form action="/logout" method="post">
                <CsrfInput token={csrfToken} />
                <button class="button button-secondary button-full" type="submit">
                  로그아웃
                </button>
              </form>
            </div>
          </aside>
        </div>

        <main class="page-shell">
          <Notice message={notice} />
          {children}
        </main>
        <div class="toast-region" aria-live="polite" aria-atomic="true" data-toast-region></div>
        {user.themeOrphanNoticePending === true ? (
          <dialog class="ticket-dialog theme-orphan-dialog" data-auto-dialog aria-labelledby="theme-orphan-title">
            <div class="theme-orphan-content">
              <div class="theme-pixel-alert" aria-hidden="true">
                !
              </div>
              <h2 id="theme-orphan-title">공유 테마가 삭제되었습니다</h2>
              <p>원소유자가 사용 중이던 테마를 삭제하여 기본 테마로 자동 변경했습니다.</p>
              <button class="button button-full" type="button" data-dialog-close>
                확인
              </button>
            </div>
          </dialog>
        ) : null}
        <DeployFooter deployInfo={deployInfo} />
      </body>
    </html>
  )
}

interface PublicLayoutProps {
  appName: string
  deployInfo: DeployInfo
  documentTitle: string
  children: Child
  includeTurnstile?: boolean
}

export function PublicLayout({ appName, deployInfo, documentTitle, children, includeTurnstile = false }: PublicLayoutProps) {
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#f97316" />
        <title>
          {documentTitle} · {appName}
        </title>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/favicon.png" sizes="64x64" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="stylesheet" href="/assets/app.css" />
        {includeTurnstile ? (
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
        ) : null}
      </head>
      <body class="public-body">
        <div class="public-main">{children}</div>
        <DeployFooter deployInfo={deployInfo} />
      </body>
    </html>
  )
}
