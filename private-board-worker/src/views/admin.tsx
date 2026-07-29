import type { CurrentUser, DeployInfo, ImageServiceSettings } from '../types'
import { CsrfInput } from './components'
import { AppLayout } from './layout'

export function AdminPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  imageServiceBound = false,
  imageService = { configured: false, enabled: false, updatedAt: null },
  notice = null,
}: {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  imageServiceBound?: boolean
  imageService?: ImageServiceSettings
  notice?: string | null
}) {
  const imageServiceReady = imageServiceBound && imageService.enabled
  const imageServiceStatus = imageServiceReady
    ? '활성'
    : !imageServiceBound
      ? 'VPC 미연결'
      : imageService.configured
        ? '비활성'
        : '미등록'

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
              <p class="eyebrow">Workers VPC · Raspberry Pi REST</p>
              <h3>통합 이미지 서비스</h3>
            </div>
            <strong class={imageServiceReady ? 'feature-status is-enabled' : 'feature-status'}>
              {imageServiceStatus}
            </strong>
          </div>
          <p>
            Worker가 VPC Service를 통해 라즈베리파이에 연결합니다. 활성화하면 개발일지와 자유게시판의
            본문 이미지, 개인 이미지 저장 메뉴가 함께 열립니다. 사용자는 게시판 Worker의 공개 이미지
            주소만 사용하며 내부 주소와 업로드 토큰은 노출되지 않습니다.
          </p>
          <dl class="admin-feature-details">
            <div>
              <dt>VPC 바인딩</dt>
              <dd>{imageServiceBound ? '준비됨' : '미설정 · IMAGE_VAULT 바인딩 필요'}</dd>
            </div>
            <div>
              <dt>공개 경로</dt>
              <dd>
                <code>/i/&lt;hash&gt;.&lt;jpg|png|webp|gif|avif&gt;</code>
              </dd>
            </div>
          </dl>
          <nav class="admin-feature-links" aria-label="통합 이미지 캐시 통계">
            <a class="button button-secondary" href="/admin/image-cache/requests">
              최근 캐시 요청
            </a>
            <a class="button button-secondary" href="/admin/image-cache/files">
              파일별 캐시 통계
            </a>
          </nav>
          <form action="/admin/image-service" method="post" class="stack-form">
            <CsrfInput token={csrfToken} />
            <label>
              <span>업로드 토큰</span>
              <input
                type="password"
                name="token"
                minlength={32}
                placeholder={imageService.configured ? '변경할 때만 입력' : '32자 이상'}
                required={!imageService.configured}
                autocomplete="new-password"
              />
            </label>
            <p class="form-hint">
              저장 시 VPC를 통해 <code>/health</code> 연결을 확인하며 즉시 활성화합니다. 토큰은 암호화해
              D1에 저장합니다.
            </p>
            <button class="button" type="submit" disabled={!imageServiceBound}>
              {imageService.configured ? '연결 확인 후 저장' : '서비스 등록 및 활성화'}
            </button>
          </form>
          {imageService.configured ? (
            <form action="/admin/image-service/toggle" method="post">
              <CsrfInput token={csrfToken} />
              <input type="hidden" name="enabled" value={imageService.enabled ? 'false' : 'true'} />
              <button class={imageService.enabled ? 'button button-danger' : 'button button-secondary'} type="submit">
                {imageService.enabled ? '통합 이미지 서비스 비활성화' : '통합 이미지 서비스 다시 활성화'}
              </button>
            </form>
          ) : null}
        </article>
      </section>
    </AppLayout>
  )
}
