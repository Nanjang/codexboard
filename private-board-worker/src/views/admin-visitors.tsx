import type {
  CurrentUser,
  DeployInfo,
  PaginatedResult,
  VisitorPageViewRow,
} from '../types'
import { EmptyState } from './components'
import { formatDateTime } from './format'
import { AppLayout } from './layout'

export function AdminVisitorLogsPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  logs,
}: {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  logs: PaginatedResult<VisitorPageViewRow>
}) {
  const displayTotalPages = Math.max(1, logs.totalPages)

  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="방문자 접속 기록"
      topbarTitle="방문자 접속 기록"
      user={user}
      csrfToken={csrfToken}
      activeNav="admin"
      backHref="/admin"
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">관리자 · 원본 접속 정보</p>
          <h2>방문자 접속 기록</h2>
          <p>실제 HTML 페이지 이동마다 저장된 IP, 전체 Referer, User-Agent와 응답 상태입니다.</p>
        </div>
      </section>

      {logs.items.length === 0 ? (
        <EmptyState title="저장된 접속 기록이 없습니다" description="HTML 페이지 방문이 발생하면 여기에 표시됩니다." />
      ) : (
        <section class="cache-table-card" aria-label="방문자 접속 기록 목록">
          <div class="cache-table-wrap">
            <table class="cache-table visitor-log-table">
              <thead>
                <tr>
                  <th scope="col">시각</th>
                  <th scope="col">IP</th>
                  <th scope="col">회원</th>
                  <th scope="col">페이지</th>
                  <th scope="col">응답</th>
                  <th scope="col">Referer 전체</th>
                  <th scope="col">User-Agent</th>
                </tr>
              </thead>
              <tbody>
                {logs.items.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <time datetime={new Date(log.visited_at).toISOString()}>
                        {formatDateTime(log.visited_at)}
                      </time>
                    </td>
                    <td>
                      <code>{log.ip_address}</code>
                    </td>
                    <td>{log.user_id ?? '비회원'}</td>
                    <td class="visitor-log-wide" title={log.path}>
                      <code>{log.path}</code>
                    </td>
                    <td>{log.response_status}</td>
                    <td class="visitor-log-wide" title={log.referer || '직접 방문'}>
                      <code>{log.referer || '직접 방문'}</code>
                    </td>
                    <td class="visitor-log-wide" title={log.user_agent}>
                      <code>{log.user_agent || '없음'}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <nav class="cache-pagination" aria-label="방문자 접속 기록 페이지">
        <span class="cache-pagination-summary">
          총 {logs.totalItems.toLocaleString('ko-KR')}건 · {logs.page}/{displayTotalPages}페이지
        </span>
        <div class="cache-pagination-actions">
          {logs.page > 1 ? (
            <a class="button button-secondary" href={`/admin/visitors?page=${logs.page - 1}`} rel="prev">
              이전
            </a>
          ) : (
            <span class="button button-secondary is-disabled" aria-disabled="true">
              이전
            </span>
          )}
          {logs.page < logs.totalPages ? (
            <a class="button button-secondary" href={`/admin/visitors?page=${logs.page + 1}`} rel="next">
              다음
            </a>
          ) : (
            <span class="button button-secondary is-disabled" aria-disabled="true">
              다음
            </span>
          )}
        </div>
      </nav>
    </AppLayout>
  )
}
