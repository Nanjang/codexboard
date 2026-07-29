import type {
  CurrentUser,
  DeployInfo,
  PaginatedResult,
  VisitorPageViewRow,
} from '../types'
import type { VisitorChartRange, VisitorTimeSeries } from '../lib/visitor-stats'
import { EmptyState } from './components'
import { formatDateTime } from './format'
import { AppLayout } from './layout'

const visitorChartRanges: { value: VisitorChartRange; label: string }[] = [
  { value: 'hour', label: '시간' },
  { value: 'day', label: '일간' },
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
]

function chartLabelStride(range: VisitorChartRange): number {
  if (range === 'hour') return 10
  if (range === 'day') return 3
  if (range === 'week') return 24
  return 5
}

function VisitorSeriesChart({ chart }: { chart: VisitorTimeSeries }) {
  const barStep = chart.range === 'week' ? 10 : chart.range === 'day' ? 24 : 18
  const chartWidth = Math.max(560, chart.buckets.length * barStep)
  const baseline = 126
  const plotHeight = 104
  const barWidth = Math.max(4, barStep - 5)
  const labelStride = chartLabelStride(chart.range)

  return (
    <section class="visitor-series-card" aria-labelledby="visitor-series-title">
      <div class="visitor-series-heading">
        <div>
          <p class="eyebrow">접속 통계</p>
          <h3 id="visitor-series-title">유니크 방문자</h3>
          <p>
            {chart.periodLabel} · 한 칸 {chart.bucketLabel} · 최대 {chart.peakCount.toLocaleString('ko-KR')}명
          </p>
        </div>
        <nav class="visitor-series-tabs" aria-label="유니크 방문자 통계 기간">
          {visitorChartRanges.map((range) => (
            <a
              href={`/admin/visitors?range=${range.value}`}
              class={range.value === chart.range ? 'is-active' : ''}
              aria-current={range.value === chart.range ? 'page' : undefined}
              key={range.value}
            >
              {range.label}
            </a>
          ))}
        </nav>
      </div>

      <figure class="visitor-series-figure">
        <div class="visitor-series-scroll">
          <svg
            class="visitor-series-chart"
            viewBox={`0 0 ${chartWidth} 160`}
            width={chartWidth}
            height="160"
            role="img"
            aria-labelledby="visitor-series-svg-title visitor-series-svg-description"
          >
            <title id="visitor-series-svg-title">유니크 방문자 시계열 막대그래프</title>
            <desc id="visitor-series-svg-description">
              {chart.periodLabel}, 한 칸은 {chart.bucketLabel}이며 구간별 중복 IP는 한 명으로 계산합니다.
            </desc>
            <line class="visitor-series-axis" x1="0" y1={baseline} x2={chartWidth} y2={baseline} />
            {chart.buckets.map((bucket, index) => {
              const height =
                bucket.count === 0 || chart.peakCount === 0
                  ? 2
                  : Math.max(4, (bucket.count / chart.peakCount) * plotHeight)
              const x = index * barStep + (barStep - barWidth) / 2
              const showLabel = index % labelStride === 0 || index === chart.buckets.length - 1
              return (
                <g key={bucket.startAt}>
                  <rect
                    class={`visitor-series-bar${bucket.count === 0 ? ' is-empty' : ''}`}
                    x={x}
                    y={baseline - height}
                    width={barWidth}
                    height={height}
                    rx="2"
                  >
                    <title>
                      {bucket.label}: {bucket.count.toLocaleString('ko-KR')}명
                    </title>
                  </rect>
                  {showLabel ? (
                    <text class="visitor-series-label" x={x + barWidth / 2} y="148" text-anchor="middle">
                      {bucket.label}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </svg>
        </div>
        {chart.peakCount === 0 ? (
          <figcaption class="visitor-series-empty">선택한 기간의 방문자가 없습니다.</figcaption>
        ) : (
          <figcaption>각 막대는 해당 구간에서 중복 IP를 제외한 방문자 수입니다.</figcaption>
        )}
      </figure>

      <details class="visitor-series-data">
        <summary>구간별 수치 보기</summary>
        <div class="cache-table-wrap">
          <table class="cache-table">
            <thead>
              <tr>
                <th scope="col">구간 시작</th>
                <th scope="col">유니크 방문자</th>
              </tr>
            </thead>
            <tbody>
              {chart.buckets.map((bucket) => (
                <tr key={bucket.startAt}>
                  <td>{bucket.label}</td>
                  <td>{bucket.count.toLocaleString('ko-KR')}명</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

export function AdminVisitorLogsPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  logs,
  chart,
}: {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  logs: PaginatedResult<VisitorPageViewRow>
  chart: VisitorTimeSeries
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

      <VisitorSeriesChart chart={chart} />

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
            <a
              class="button button-secondary"
              href={`/admin/visitors?range=${chart.range}&page=${logs.page - 1}`}
              rel="prev"
            >
              이전
            </a>
          ) : (
            <span class="button button-secondary is-disabled" aria-disabled="true">
              이전
            </span>
          )}
          {logs.page < logs.totalPages ? (
            <a
              class="button button-secondary"
              href={`/admin/visitors?range=${chart.range}&page=${logs.page + 1}`}
              rel="next"
            >
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
