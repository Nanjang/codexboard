import type { CurrentUser, DeployInfo } from '../types'
import { CsrfInput } from './components'
import { AppLayout } from './layout'

export function AdminPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  imageStorageEnabled,
  r2Configured,
  notice = null,
}: {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  imageStorageEnabled: boolean
  r2Configured: boolean
  notice?: string | null
}) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="관리자 설정"
      topbarTitle="관리자 설정"
      user={user}
      csrfToken={csrfToken}
      activeNav="admin"
      notice={notice}
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">관리자 전용</p>
          <h2>기능 설정</h2>
          <p>서비스 전체에 적용할 기능을 수동으로 활성화하거나 비활성화합니다.</p>
        </div>
      </section>

      <section class="admin-feature-grid" aria-label="기능 설정 목록">
        <article class="form-card admin-feature-card">
          <div class="admin-feature-heading">
            <div>
              <p class="eyebrow">Cloudflare R2</p>
              <h3>개인 이미지 저장</h3>
            </div>
            <strong class={imageStorageEnabled ? 'feature-status is-enabled' : 'feature-status'}>
              {imageStorageEnabled ? '활성' : '비활성'}
            </strong>
          </div>

          <p>
            활성화하면 모든 로그인 회원의 메뉴에 개인 이미지 저장 항목이 나타나고, 이미지 업로드 API를
            사용할 수 있습니다. 기본값은 비활성입니다.
          </p>

          <dl class="admin-feature-details">
            <div>
              <dt>R2 설정</dt>
              <dd>{r2Configured ? '준비됨' : '미설정 · 활성화 후 업로드 시 오류 toast 표시'}</dd>
            </div>
            <div>
              <dt>공개 URL</dt>
              <dd>기능을 꺼도 이전에 복사한 공개 캐시 URL은 계속 접근할 수 있습니다.</dd>
            </div>
          </dl>

          <form action="/admin/features/image-storage" method="post">
            <CsrfInput token={csrfToken} />
            <input type="hidden" name="enabled" value={imageStorageEnabled ? 'false' : 'true'} />
            <button class={imageStorageEnabled ? 'button button-danger' : 'button'} type="submit">
              {imageStorageEnabled ? '이미지 기능 비활성화' : '이미지 기능 활성화'}
            </button>
          </form>
        </article>
      </section>
    </AppLayout>
  )
}
