import type {
  CurrentUser,
  DeployInfo,
  DevlogImageCacheFileStatsRow,
  DevlogImageCacheRequestRow,
  DevlogImageCacheStatus,
  PaginatedResult,
} from '../types'
import { EmptyState } from './components'
import { formatDateTime } from './format'
import { AppLayout } from './layout'

interface CachePageBaseProps {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  notice?: string | null
}

interface CachePaginationProps {
  path: string
  label: string
  page: number
  totalItems: number
  totalPages: number
}

function imagePath(imageHash: string, extension: string): string {
  return `/i/${imageHash}.${extension}`
}

function CacheStatusBadge({ status }: { status: DevlogImageCacheStatus }) {
  return <strong class={`cache-status cache-status-${status.toLowerCase()}`}>{status}</strong>
}

function CachePagination({ path, label, page, totalItems, totalPages }: CachePaginationProps) {
  const displayTotalPages = Math.max(1, totalPages)

  return (
    <nav class="cache-pagination" aria-label={label}>
      <span class="cache-pagination-summary">
        총 {totalItems.toLocaleString('ko-KR')}건 · {page}/{displayTotalPages}페이지
      </span>
      <div class="cache-pagination-actions">
        {page > 1 ? (
          <a class="button button-secondary" href={`${path}?page=${page - 1}`} rel="prev">
            이전
          </a>
        ) : (
          <span class="button button-secondary is-disabled" aria-disabled="true">
            이전
          </span>
        )}
        {page < totalPages ? (
          <a class="button button-secondary" href={`${path}?page=${page + 1}`} rel="next">
            다음
          </a>
        ) : (
          <span class="button button-secondary is-disabled" aria-disabled="true">
            다음
          </span>
        )}
      </div>
    </nav>
  )
}

function CachePageTabs({ active }: { active: 'requests' | 'files' }) {
  return (
    <nav class="cache-page-tabs" aria-label="이미지 캐시 통계">
      <a
        href="/admin/image-cache/requests"
        aria-current={active === 'requests' ? 'page' : undefined}
      >
        최근 요청
      </a>
      <a href="/admin/image-cache/files" aria-current={active === 'files' ? 'page' : undefined}>
        파일별 통계
      </a>
    </nav>
  )
}

export function DevlogImageCacheRequestsPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  requests,
  notice = null,
}: CachePageBaseProps & {
  requests: PaginatedResult<DevlogImageCacheRequestRow>
}) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="통합 이미지 캐시 요청"
      topbarTitle="이미지 캐시 요청"
      user={user}
      csrfToken={csrfToken}
      activeNav="admin"
      notice={notice}
      backHref="/admin"
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">관리자 · 통합 이미지</p>
          <h2>최근 캐시 요청</h2>
          <p>
            <code>/i/</code> 통합 경로의 최근 요청 최대 1,000건과 Worker 캐시 결과를 확인합니다.
            Cloudflare 상태가 <code>HIT</code>인 요청만 HIT로, 그 외 상태는 MISS로 집계합니다.
          </p>
        </div>
      </section>

      <CachePageTabs active="requests" />

      {requests.items.length === 0 ? (
        <EmptyState
          title="기록된 이미지 요청이 없습니다"
          description="/i/ 이미지를 요청하면 캐시 결과가 여기에 표시됩니다."
        />
      ) : (
        <section class="cache-table-card" aria-label="최근 이미지 캐시 요청 목록">
          <div class="cache-table-wrap">
            <table class="cache-table">
              <thead>
                <tr>
                  <th scope="col">시각</th>
                  <th scope="col">요청</th>
                  <th scope="col">파일</th>
                  <th scope="col">캐시</th>
                  <th scope="col">응답</th>
                  <th scope="col">처리 시간</th>
                  <th scope="col">Colo</th>
                </tr>
              </thead>
              <tbody>
                {requests.items.map((request) => {
                  const path = imagePath(request.image_hash, request.extension)

                  return (
                    <tr key={request.id}>
                      <td>
                        <time datetime={new Date(request.created_at).toISOString()}>
                          {formatDateTime(request.created_at)}
                        </time>
                      </td>
                      <td>
                        <code>{request.method}</code>
                      </td>
                      <td class="cache-file-cell">
                        <a href={path} target="_blank" rel="noopener noreferrer" title={path}>
                          {request.image_hash}.{request.extension}
                        </a>
                      </td>
                      <td>
                        <CacheStatusBadge status={request.cache_status} />
                      </td>
                      <td>{request.response_status}</td>
                      <td>{request.duration_ms.toLocaleString('ko-KR')} ms</td>
                      <td>{request.colo ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CachePagination
        path="/admin/image-cache/requests"
        label="최근 캐시 요청 페이지"
        page={requests.page}
        totalItems={requests.totalItems}
        totalPages={requests.totalPages}
      />
    </AppLayout>
  )
}

export function DevlogImageCacheFilesPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  files,
  notice = null,
}: CachePageBaseProps & {
  files: PaginatedResult<DevlogImageCacheFileStatsRow>
}) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="통합 이미지 파일별 캐시 통계"
      topbarTitle="파일별 캐시 통계"
      user={user}
      csrfToken={csrfToken}
      activeNav="admin"
      notice={notice}
      backHref="/admin"
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">관리자 · 통합 이미지</p>
          <h2>파일별 캐시 통계</h2>
          <p>
            <code>/i/</code> 통합 경로의 파일별 HIT/MISS 누적 결과를 확인합니다.
            MISS에는 만료, 재검증, 우회처럼 fresh cache HIT가 아닌 상태가 포함됩니다.
          </p>
        </div>
      </section>

      <CachePageTabs active="files" />

      {files.items.length === 0 ? (
        <EmptyState
          title="집계된 이미지 파일이 없습니다"
          description="/i/ 이미지 요청이 기록되면 파일별 통계가 생성됩니다."
        />
      ) : (
        <section class="cache-table-card" aria-label="파일별 이미지 캐시 통계 목록">
          <div class="cache-table-wrap">
            <table class="cache-table">
              <thead>
                <tr>
                  <th scope="col">파일</th>
                  <th scope="col">전체 요청</th>
                  <th scope="col">HIT</th>
                  <th scope="col">MISS</th>
                  <th scope="col">히트율</th>
                  <th scope="col">최근 결과</th>
                  <th scope="col">최근 응답</th>
                  <th scope="col">최근 접근</th>
                </tr>
              </thead>
              <tbody>
                {files.items.map((file) => {
                  const path = imagePath(file.image_hash, file.extension)
                  const hitRate = file.request_count > 0 ? (file.hit_count / file.request_count) * 100 : 0

                  return (
                    <tr key={`${file.image_hash}.${file.extension}`}>
                      <td class="cache-file-cell">
                        <a href={path} target="_blank" rel="noopener noreferrer" title={path}>
                          {file.image_hash}.{file.extension}
                        </a>
                      </td>
                      <td>{file.request_count.toLocaleString('ko-KR')}</td>
                      <td>{file.hit_count.toLocaleString('ko-KR')}</td>
                      <td>{file.miss_count.toLocaleString('ko-KR')}</td>
                      <td>{hitRate.toFixed(1)}%</td>
                      <td>
                        <CacheStatusBadge status={file.last_cache_status} />
                      </td>
                      <td>{file.last_response_status}</td>
                      <td>
                        <time datetime={new Date(file.last_accessed_at).toISOString()}>
                          {formatDateTime(file.last_accessed_at)}
                        </time>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CachePagination
        path="/admin/image-cache/files"
        label="파일별 캐시 통계 페이지"
        page={files.page}
        totalItems={files.totalItems}
        totalPages={files.totalPages}
      />
    </AppLayout>
  )
}
