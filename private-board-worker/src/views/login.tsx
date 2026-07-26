import type { DeployInfo } from '../types'
import { ErrorNotice } from './components'
import { PublicLayout } from './layout'

interface LoginPageProps {
  appName: string
  deployInfo: DeployInfo
  error?: string | null
  turnstileSiteKey?: string
}

export function LoginPage({ appName, deployInfo, error = null, turnstileSiteKey }: LoginPageProps) {
  return (
    <PublicLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="로그인"
      includeTurnstile={Boolean(turnstileSiteKey)}
    >
      <main class="login-shell">
        <section class="login-card" aria-labelledby="login-title">
          <div class="login-mark" aria-hidden="true">
            PB
          </div>
          <p class="eyebrow">회원 전용 서비스</p>
          <h1 id="login-title">{appName}</h1>
          <p class="login-description">
            Google 인증 후 자유게시판, 개발, 뉴스, 문의 게시판과 개인 작업 보드를 사용할 수 있습니다. 손님
            홈에서는 공용 게시판의 최근 글을 미리 볼 수 있습니다.
          </p>
          <ErrorNotice message={error} />

          <form action="/auth/google/start" method="post" class="login-form">
            {turnstileSiteKey ? (
              <div
                class="cf-turnstile"
                data-sitekey={turnstileSiteKey}
                data-action="login"
                data-theme="light"
              ></div>
            ) : null}
            <button type="submit" class="button button-google button-full">
              Google 계정으로 로그인
            </button>
          </form>

          <p class="login-legal">
            로그인하면 <a href="/terms">이용약관</a>과 <a href="/privacy">개인정보처리방침</a>에 동의한 것으로
            봅니다.
          </p>
        </section>
      </main>
    </PublicLayout>
  )
}
