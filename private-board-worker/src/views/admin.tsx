import type { CurrentUser, DeployInfo, ImageServiceSettings } from '../types'
import {
  accountStorageStatusMessage,
  FREE_D1_DATABASE_COUNT_LIMIT,
  type DatabaseUsageStats,
} from '../lib/database-usage'
import { CsrfInput } from './components'
import { AppLayout } from './layout'

function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${Math.round(bytes)} B`
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`
}

function formatPercent(value: number): string {
  return `${Math.max(0, value).toFixed(2)}%`
}

const tableLabels: Record<string, string> = {
  users: '회원',
  auth_accounts: '로그인 계정',
  sessions: '세션',
  boards: '게시판',
  posts: '게시글',
  comments: '댓글',
  tickets: '작업 티켓',
  user_dashboards: '사용자 대시보드',
  dashboard_widgets: '대시보드 위젯',
  rss_feed_cache: 'RSS 캐시',
  user_memo_settings: '메모 설정',
  private_memos: '개인 메모',
  memo_url_patterns: '메모 URL 패턴',
  private_images: '이미지 메타데이터',
  custom_themes: '사용자 테마',
  user_shared_themes: '공유 테마',
  user_theme_preferences: '테마 선택',
  image_service_settings: '이미지 서비스 설정',
  devlog_image_cache_requests: '이미지 캐시 요청',
  devlog_image_cache_file_stats: '이미지 캐시 파일 통계',
  visitor_page_views: '방문 페이지 기록',
  visitor_daily_uniques: '일별 방문자',
  visitor_daily_counts: '일별 방문자 집계',
  visitor_total_stats: '전체 방문자 집계',
  post_image_links: '게시글 이미지 연결',
  personal_bookmarks: '개인 북마크',
}

function databaseUsageLine(databaseUsage: DatabaseUsageStats): string {
  return `${formatBytes(databaseUsage.databaseSizeBytes)} / ${formatBytes(databaseUsage.databaseLimitBytes)} (${formatPercent(databaseUsage.databasePercent)})`
}

function DatabaseUsageDetails({ databaseUsage }: { databaseUsage: DatabaseUsageStats | null }) {
  if (!databaseUsage) return <p class="form-hint">DB 사용량을 불러오지 못했습니다.</p>

  return (
    <>
      <dl class="admin-database-summary">
        <div>
          <dt>현재 DB 저장 크기</dt>
          <dd>{formatBytes(databaseUsage.databaseSizeBytes)}</dd>
        </div>
        <div>
          <dt>현재 DB 사용량</dt>
          <dd>{databaseUsageLine(databaseUsage)}</dd>
        </div>
        <div>
          <dt>전체 행 수</dt>
          <dd>{databaseUsage.totalRows.toLocaleString('ko-KR')}개</dd>
        </div>
        <div>
          <dt>테이블 수</dt>
          <dd>{databaseUsage.tables.length.toLocaleString('ko-KR')}개</dd>
        </div>
      </dl>
      <div class="admin-database-progress" aria-label="현재 DB 사용률">
        <progress
          max="100"
          value={Math.min(100, Math.max(0, databaseUsage.databasePercent))}
        ></progress>
        <span>{formatPercent(databaseUsage.databasePercent)}</span>
      </div>

      <div class="admin-account-usage">
        <div class="admin-account-usage-heading">
          <div>
            <p class="eyebrow">계정 전체</p>
            <h4>계정 D1 저장 용량</h4>
          </div>
          {databaseUsage.account ? <strong>{formatPercent(databaseUsage.account.percent)}</strong> : null}
        </div>
        {databaseUsage.account ? (
          <>
            <p>
              {formatBytes(databaseUsage.account.usedBytes)} 사용 / {formatBytes(databaseUsage.account.limitBytes)} 한도 ·{' '}
              {databaseUsage.account.databaseCount.toLocaleString('ko-KR')}/{FREE_D1_DATABASE_COUNT_LIMIT}개 데이터베이스
            </p>
            <progress
              max="100"
              value={Math.min(100, Math.max(0, databaseUsage.account.percent))}
            ></progress>
          </>
        ) : (
          <p class="form-hint">{accountStorageStatusMessage(databaseUsage.accountStatus)}</p>
        )}
      </div>

      <div class="cache-table-wrap admin-database-table-wrap">
        <table class="cache-table admin-database-table">
          <thead>
            <tr>
              <th scope="col">테이블</th>
              <th scope="col">행 수</th>
            </tr>
          </thead>
          <tbody>
            {databaseUsage.tables.map((table) => (
              <tr key={table.name}>
                <th scope="row">
                  {tableLabels[table.name] ?? table.name}
                  <small><code>{table.name}</code></small>
                </th>
                <td>{table.rowCount.toLocaleString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="form-hint">
        마지막 확인: {new Date(databaseUsage.measuredAt).toLocaleString('ko-KR')} · 계정 전체 수치는 Cloudflare
        D1 Analytics에서 최근 저장량을 데이터베이스별로 합산한 값입니다.
      </p>
    </>
  )
}

export function AdminDatabasePage({
  appName,
  deployInfo,
  user,
  csrfToken,
  databaseUsage = null,
}: {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  databaseUsage?: DatabaseUsageStats | null
}) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="DB 사용량 상세"
      topbarTitle="DB 사용량 상세"
      user={user}
      csrfToken={csrfToken}
      activeNav="admin"
      backHref="/admin"
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">D1 · Cloudflare Analytics</p>
          <h2>DB 사용량 상세</h2>
          <p>현재 DB와 계정 전체 D1 저장량, 테이블별 행 수를 확인합니다.</p>
        </div>
      </section>

      <section class="admin-database-usage" aria-labelledby="admin-database-detail-title">
        <article class="form-card admin-database-card">
          <div class="admin-feature-heading">
            <div>
              <p class="eyebrow">읽기 전용</p>
              <h3 id="admin-database-detail-title">저장 용량 상세</h3>
            </div>
            <nav class="admin-feature-links">
              <a class="button button-secondary button-compact" href="/admin/database/performance">조회 성능 측정</a>
              <a class="button button-secondary button-compact" href="/admin">관리자 설정</a>
            </nav>
          </div>
          <DatabaseUsageDetails databaseUsage={databaseUsage} />
        </article>
      </section>
    </AppLayout>
  )
}

export function AdminPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  imageServiceBound = false,
  imageService = { configured: false, enabled: false, updatedAt: null },
  databaseUsage = null,
  notice = null,
}: {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  imageServiceBound?: boolean
  imageService?: ImageServiceSettings
  databaseUsage?: DatabaseUsageStats | null
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

      <section class="admin-database-usage" aria-labelledby="admin-database-usage-title">
        <article class="form-card admin-database-card">
          <div class="admin-feature-heading">
            <div>
              <p class="eyebrow">D1 · Cloudflare Analytics</p>
              <h3 id="admin-database-usage-title">DB 사용량</h3>
            </div>
            <strong class="feature-status is-enabled">읽기 전용</strong>
          </div>
          <p>현재 연결된 D1 데이터베이스의 사용량을 간단히 표시합니다. 저장 크기는 테이블과 인덱스를 포함합니다.</p>
          {databaseUsage ? (
            <dl class="admin-database-summary admin-database-summary-compact">
              <div>
                <dt>현재 DB 사용량</dt>
                <dd>{databaseUsageLine(databaseUsage)}</dd>
              </div>
            </dl>
          ) : (
            <p class="form-hint">DB 사용량을 불러오지 못했습니다.</p>
          )}
          <nav class="admin-feature-links" aria-label="DB 사용량 상세">
            <a class="button button-secondary" href="/admin/database">
              자세히 보기
            </a>
          </nav>
        </article>
      </section>

      <section class="admin-feature-grid" aria-label="기능 설정 목록">
        <article class="form-card admin-feature-card">
          <div class="admin-feature-heading">
            <div>
              <p class="eyebrow">D1 · 관리자 전용</p>
              <h3>방문자 접속 기록</h3>
            </div>
            <strong class="feature-status is-enabled">기록 중</strong>
          </div>
          <p>HTML 페이지 이동마다 저장된 원본 IP, 전체 Referer와 User-Agent를 확인합니다.</p>
          <nav class="admin-feature-links" aria-label="방문자 접속 기록 조회">
            <a class="button button-secondary" href="/admin/visitors">
              접속 기록 보기
            </a>
          </nav>
        </article>

        <article class="form-card admin-feature-card">
          <div class="admin-feature-heading">
            <div>
              <p class="eyebrow">D1 · 조회 전용</p>
              <h3>회원 정보</h3>
            </div>
            <strong class="feature-status is-enabled">조회</strong>
          </div>
          <p>가입 계정의 이메일, 상태, 접속 기록과 글·댓글 활동을 DB 기준으로 확인합니다.</p>
          <nav class="admin-feature-links" aria-label="회원 정보 조회">
            <a class="button button-secondary" href="/admin/members">
              회원 정보 보기
            </a>
          </nav>
        </article>

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
