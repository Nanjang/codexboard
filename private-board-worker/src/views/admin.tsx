import type { CurrentUser, DeployInfo, ImageServiceSettings } from '../types'
import { CsrfInput } from './components'
import { AppLayout } from './layout'

export function AdminPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  imageStorageEnabled,
  r2Configured,
  imageServiceBound = false,
  imageService = { configured: false, enabled: false, updatedAt: null },
  notice = null,
}: {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  imageStorageEnabled: boolean
  r2Configured: boolean
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
              <h3>개발일지 이미지 서비스</h3>
            </div>
            <strong class={imageServiceReady ? 'feature-status is-enabled' : 'feature-status'}>
              {imageServiceStatus}
            </strong>
          </div>
          <p>
            Worker가 VPC Service를 통해 라즈베리파이에 연결합니다. 사용자는 게시판 Worker의 공개 이미지
            주소만 사용하고, 내부 주소와 업로드 토큰은 노출되지 않습니다.
          </p>
          <dl class="admin-feature-details">
            <div>
              <dt>VPC 바인딩</dt>
              <dd>{imageServiceBound ? '준비됨' : '미설정 · IMAGE_VAULT 바인딩 필요'}</dd>
            </div>
            <div>
              <dt>공개 경로</dt>
              <dd>
                <code>/devlog-images/i/&lt;hash&gt;.&lt;jpg|png|webp|gif|avif&gt;</code>
              </dd>
            </div>
          </dl>
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
                {imageService.enabled ? '이미지 서비스 비활성화' : '이미지 서비스 다시 활성화'}
              </button>
            </form>
          ) : null}
        </article>

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
