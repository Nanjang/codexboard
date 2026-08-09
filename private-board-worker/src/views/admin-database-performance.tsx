import type { CurrentUser, DeployInfo } from '../types'
import type { DatabaseQueryMeasurement } from '../lib/database-performance'
import { AppLayout } from './layout'

interface QueryPlanRow {
  id: number
  parent: number
  notused: number
  detail: string
}

interface AdminDatabasePerformancePageProps {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  postId: number
  boardSlug: string
  measurements: DatabaseQueryMeasurement[]
  plans: DatabaseQueryMeasurement<QueryPlanRow>[]
}

function formatMilliseconds(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)} ms`
}

function formatRows(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('ko-KR') : '—'
}

function MeasurementTable({ measurements }: { measurements: DatabaseQueryMeasurement[] }) {
  return (
    <div class="admin-database-table-wrap">
      <table class="admin-database-table admin-database-performance-table">
        <thead>
          <tr>
            <th scope="col">측정 항목</th>
            <th scope="col">전체 경과</th>
            <th scope="col">D1 경과</th>
            <th scope="col">SQL 실행</th>
            <th scope="col">읽기 행</th>
            <th scope="col">결과</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map((measurement) => (
            <tr key={measurement.label}>
              <th scope="row">{measurement.label}</th>
              <td>{formatMilliseconds(measurement.elapsedMs)}</td>
              <td>{formatMilliseconds(measurement.d1DurationMs)}</td>
              <td>{formatMilliseconds(measurement.sqlDurationMs)}</td>
              <td>{formatRows(measurement.rowsRead)}</td>
              <td>{formatRows(measurement.resultCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function QuerySqlDetails({ measurements }: { measurements: DatabaseQueryMeasurement[] }) {
  return (
    <div class="admin-database-performance-sql-list">
      {measurements.map((measurement) => (
        <details key={measurement.label}>
          <summary>{measurement.label} SQL</summary>
          <pre>{measurement.sql.trim()}</pre>
        </details>
      ))}
    </div>
  )
}

function QueryPlanDetails({ plans }: { plans: DatabaseQueryMeasurement<QueryPlanRow>[] }) {
  return (
    <div class="admin-database-performance-plan-list">
      {plans.map((plan) => (
        <article class="admin-database-performance-plan" key={plan.label}>
          <div class="admin-feature-heading">
            <h4>{plan.label}</h4>
            <span>{formatMilliseconds(plan.sqlDurationMs)}</span>
          </div>
          {plan.rows.length > 0 ? (
            <ul>
              {plan.rows.map((row, index) => <li key={`${row.id}-${index}`}><code>{row.detail}</code></li>)}
            </ul>
          ) : (
            <p class="form-hint">실행 계획이 반환되지 않았습니다.</p>
          )}
        </article>
      ))}
    </div>
  )
}

export function AdminDatabasePerformancePage({
  appName,
  deployInfo,
  user,
  csrfToken,
  postId,
  boardSlug,
  measurements,
  plans,
}: AdminDatabasePerformancePageProps) {
  const totalElapsedMs = measurements.reduce((total, measurement) => total + measurement.elapsedMs, 0)

  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="DB 조회 성능 측정"
      topbarTitle="DB 조회 성능 측정"
      user={user}
      csrfToken={csrfToken}
      activeNav="admin"
      backHref="/admin/database"
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">D1 · 관리자 전용</p>
          <h2>DB 조회 성능 측정</h2>
          <p>자유게시판 글 수정 화면에서 사용하는 대표 조회와 인덱스 실행 계획을 실제 Worker DB에서 측정합니다.</p>
        </div>
      </section>

      <section class="admin-database-performance" aria-labelledby="database-performance-title">
        <article class="form-card admin-database-card">
          <div class="admin-feature-heading">
            <div>
              <p class="eyebrow">측정 대상</p>
              <h3 id="database-performance-title">대표 조회 재실행</h3>
            </div>
            <a class="button button-secondary button-compact" href="/admin/database">DB 사용량</a>
          </div>
          <form class="admin-database-performance-form" method="get" action="/admin/database/performance">
            <label>
              <span>게시글 ID</span>
              <input type="number" name="postId" min="1" value={postId} />
            </label>
            <label>
              <span>게시판</span>
              <select name="board">
                <option value="free" selected={boardSlug === 'free'}>자유게시판</option>
                <option value="inquiry" selected={boardSlug === 'inquiry'}>문의</option>
              </select>
            </label>
            <button class="button" type="submit">다시 측정</button>
          </form>
          <dl class="admin-database-summary admin-database-summary-compact">
            <div>
              <dt>측정 쿼리 수</dt>
              <dd>{measurements.length}개</dd>
            </div>
            <div>
              <dt>합산 Worker 경과</dt>
              <dd>{formatMilliseconds(totalElapsedMs)}</dd>
            </div>
          </dl>
          <p class="form-hint">전체 경과에는 Worker와 D1 사이 네트워크 시간이 포함됩니다. SQL 실행 시간은 D1 내부 실행 시간입니다.</p>
        </article>

        <article class="form-card admin-database-card">
          <div class="admin-feature-heading">
            <div>
              <p class="eyebrow">실측 결과</p>
              <h3>조회별 상세 시간</h3>
            </div>
          </div>
          <MeasurementTable measurements={measurements} />
          <QuerySqlDetails measurements={measurements} />
        </article>

        <article class="form-card admin-database-card">
          <div class="admin-feature-heading">
            <div>
              <p class="eyebrow">SQLite</p>
              <h3>인덱스 실행 계획</h3>
            </div>
          </div>
          <QueryPlanDetails plans={plans} />
        </article>
      </section>
    </AppLayout>
  )
}
