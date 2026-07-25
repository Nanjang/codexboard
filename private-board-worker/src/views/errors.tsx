import type { CurrentUser, DeployInfo } from '../types'
import { AppLayout, PublicLayout } from './layout'

export function PublicErrorPage({
  appName,
  deployInfo,
  title,
  message,
  status,
}: {
  appName: string
  deployInfo: DeployInfo
  title: string
  message: string
  status: number
}) {
  return (
    <PublicLayout appName={appName} deployInfo={deployInfo} documentTitle={title}>
      <main class="error-shell">
        <section class="error-card">
          <span class="error-code">{status}</span>
          <h1>{title}</h1>
          <p>{message}</p>
          <a class="button" href="/login">
            로그인 화면
          </a>
        </section>
      </main>
    </PublicLayout>
  )
}

export function AppErrorPage({
  appName,
  deployInfo,
  title,
  message,
  status,
  user,
  csrfToken,
}: {
  appName: string
  deployInfo: DeployInfo
  title: string
  message: string
  status: number
  user: CurrentUser
  csrfToken: string
}) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle={title}
      topbarTitle={title}
      user={user}
      csrfToken={csrfToken}
      activeNav={null}
    >
      <section class="error-card app-error-card">
        <span class="error-code">{status}</span>
        <h2>{title}</h2>
        <p>{message}</p>
        <a class="button" href="/boards/free">
          자유게시판으로 이동
        </a>
      </section>
    </AppLayout>
  )
}

export function BlockedPage({
  appName,
  deployInfo,
  user,
  csrfToken,
}: {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
}) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="접근 제한"
      topbarTitle="접근 제한"
      user={user}
      csrfToken={csrfToken}
      activeNav={null}
    >
      <section class="error-card app-error-card">
        <span class="error-code">403</span>
        <h2>계정 이용이 제한되었습니다</h2>
        <p>서비스 운영자에게 문의하세요. 현재 계정으로 게시판과 개인 작업 데이터에 접근할 수 없습니다.</p>
      </section>
    </AppLayout>
  )
}
