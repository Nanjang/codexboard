import type { Child } from 'hono/jsx'
import type { CurrentUser, DeployInfo } from '../types'
import { CsrfInput, DeployFooter, Notice, UserBadge } from './components'

type ActiveNav = 'free' | 'inquiry' | 'tickets' | 'account' | null

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
        <meta name="csrf-token" content={csrfToken} />
        <title>
          {documentTitle} · {appName}
        </title>
        <link rel="stylesheet" href="/assets/app.css" />
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
              <a href="/boards/free" aria-current={activeNav === 'free' ? 'page' : undefined}>
                자유게시판
              </a>
              <a href="/boards/inquiry" aria-current={activeNav === 'inquiry' ? 'page' : undefined}>
                문의
              </a>
              <a href="/tickets" aria-current={activeNav === 'tickets' ? 'page' : undefined}>
                내 작업
              </a>
              <a href="/account" aria-current={activeNav === 'account' ? 'page' : undefined}>
                내 계정
              </a>
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
        <title>
          {documentTitle} · {appName}
        </title>
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
