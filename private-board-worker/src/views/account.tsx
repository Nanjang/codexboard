import type { CurrentUser, DeployInfo } from '../types'
import { CsrfInput } from './components'
import { AppLayout } from './layout'

export function AccountPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  notice = null,
  error,
}: {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  notice?: string | null
  error?: string | null
}) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="내 계정"
      topbarTitle="내 계정"
      user={user}
      csrfToken={csrfToken}
      activeNav="account"
      notice={notice}
    >
      <section class="account-grid">
        <article class="form-card">
          <p class="eyebrow">공개 프로필</p>
          <h2>닉네임</h2>
          <p>게시글과 댓글에는 Google 이름 대신 이 닉네임이 표시됩니다.</p>
          {error ? <div class="notice notice-error">{error}</div> : null}
          <form action="/account/nickname" method="post" class="stack-form compact-form">
            <CsrfInput token={csrfToken} />
            <label>
              <span>닉네임</span>
              <input type="text" name="nickname" value={user.nickname} minlength={2} maxlength={24} required />
            </label>
            <div class="form-actions form-actions-end">
              <button class="button" type="submit">
                변경
              </button>
            </div>
          </form>
        </article>

        <article class="account-info-card">
          <p class="eyebrow">로그인 정보</p>
          <h2>Google 계정</h2>
          <dl>
            <div>
              <dt>이메일</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>권한</dt>
              <dd>{user.role === 'admin' ? '관리자' : '일반 회원'}</dd>
            </div>
          </dl>
          <p class="form-hint">Google 비밀번호와 프로필 이미지는 이 서비스에 저장하지 않습니다.</p>
        </article>
      </section>
    </AppLayout>
  )
}
