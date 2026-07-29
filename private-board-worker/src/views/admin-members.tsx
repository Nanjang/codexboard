import type {
  AdminMemberActivityRow,
  AdminMemberRow,
  CurrentUser,
  DeployInfo,
  PaginatedResult,
} from '../types'
import { EmptyState } from './components'
import { formatDateTime } from './format'
import { AppLayout } from './layout'

interface AdminMembersBaseProps {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
}

function OptionalDate({ value }: { value: number | null }) {
  if (value === null) return <span class="admin-member-empty">없음</span>
  return <time datetime={new Date(value).toISOString()}>{formatDateTime(value)}</time>
}

function Pagination({
  path,
  page,
  totalItems,
  totalPages,
}: {
  path: string
  page: number
  totalItems: number
  totalPages: number
}) {
  const displayTotalPages = Math.max(1, totalPages)
  return (
    <nav class="cache-pagination" aria-label="회원 정보 페이지">
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

function memberStatusLabel(member: AdminMemberRow): string {
  return `${member.role === 'admin' ? '관리자' : '회원'} · ${member.status === 'active' ? '활성' : '차단'}`
}

function activityHref(activity: AdminMemberActivityRow): string {
  const postPath =
    activity.board_slug === 'development'
      ? `/devlogs/u/${encodeURIComponent(activity.post_author_id)}/posts/${activity.post_id}`
      : `/posts/${activity.post_id}`
  return activity.kind === 'comment' ? `${postPath}#comment-${activity.activity_id}` : postPath
}

function activityLabel(activity: AdminMemberActivityRow): string {
  if (activity.kind === 'post') return '게시글'
  return '댓글'
}

export function AdminMembersPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  members,
}: AdminMembersBaseProps & {
  members: PaginatedResult<AdminMemberRow>
}) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="회원 정보"
      topbarTitle="회원 정보"
      user={user}
      csrfToken={csrfToken}
      activeNav="admin"
      backHref="/admin"
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">관리자 · 조회 전용</p>
          <h2>회원 정보</h2>
          <p>D1에 저장된 계정 정보와 활동 수를 조회합니다. 회원 정보나 권한은 이 화면에서 변경하지 않습니다.</p>
        </div>
      </section>

      {members.items.length === 0 ? (
        <EmptyState title="등록된 회원이 없습니다" description="가입한 회원이 생기면 여기에 표시됩니다." />
      ) : (
        <section class="cache-table-card" aria-label="회원 정보 목록">
          <div class="cache-table-wrap">
            <table class="cache-table admin-members-table">
              <thead>
                <tr>
                  <th scope="col">회원</th>
                  <th scope="col">이메일</th>
                  <th scope="col">상태</th>
                  <th scope="col">글 / 댓글</th>
                  <th scope="col">최근 접속</th>
                  <th scope="col">최근 활동</th>
                  <th scope="col">가입일</th>
                  <th scope="col">활동</th>
                </tr>
              </thead>
              <tbody>
                {members.items.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.nickname}</strong>
                      <code class="admin-member-id">{member.id}</code>
                    </td>
                    <td>
                      <span>{member.email ?? '연결된 이메일 없음'}</span>
                      <small>{member.email_hidden === 1 ? '프로필 비공개' : '프로필 공개'}</small>
                    </td>
                    <td>
                      <span class={`admin-member-status status-${member.status}`}>{memberStatusLabel(member)}</span>
                    </td>
                    <td>
                      {member.post_count.toLocaleString('ko-KR')} / {member.comment_count.toLocaleString('ko-KR')}
                    </td>
                    <td>
                      <OptionalDate value={member.last_seen_at} />
                    </td>
                    <td>
                      <OptionalDate value={member.last_activity_at} />
                    </td>
                    <td>
                      <OptionalDate value={member.created_at} />
                    </td>
                    <td>
                      <a
                        class="button button-secondary"
                        href={`/admin/members/${encodeURIComponent(member.id)}/activity`}
                      >
                        최근 활동
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Pagination
        path="/admin/members"
        page={members.page}
        totalItems={members.totalItems}
        totalPages={members.totalPages}
      />
    </AppLayout>
  )
}

export function AdminMemberActivityPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  member,
  activities,
}: AdminMembersBaseProps & {
  member: AdminMemberRow
  activities: PaginatedResult<AdminMemberActivityRow>
}) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle={`${member.nickname} 활동`}
      topbarTitle="회원 활동"
      user={user}
      csrfToken={csrfToken}
      activeNav="admin"
      backHref="/admin/members"
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">관리자 · 회원 활동 히스토리</p>
          <h2>{member.nickname}</h2>
          <p>
            {member.email ?? '연결된 이메일 없음'} · 게시글 {member.post_count.toLocaleString('ko-KR')}개 · 댓글{' '}
            {member.comment_count.toLocaleString('ko-KR')}개
          </p>
        </div>
      </section>

      <dl class="admin-member-summary">
        <div>
          <dt>회원 ID</dt>
          <dd>
            <code>{member.id}</code>
          </dd>
        </div>
        <div>
          <dt>계정 상태</dt>
          <dd>{memberStatusLabel(member)}</dd>
        </div>
        <div>
          <dt>가입일</dt>
          <dd>
            <OptionalDate value={member.created_at} />
          </dd>
        </div>
        <div>
          <dt>최근 접속</dt>
          <dd>
            <OptionalDate value={member.last_seen_at} />
          </dd>
        </div>
      </dl>

      {activities.items.length === 0 ? (
        <EmptyState title="글 또는 댓글 활동이 없습니다" description="작성 활동이 생기면 최신순으로 표시됩니다." />
      ) : (
        <section class="admin-activity-list" aria-label={`${member.nickname} 활동 목록`}>
          {activities.items.map((activity) => (
            <article class="admin-activity-item" key={`${activity.kind}-${activity.activity_id}`}>
              <div class="admin-activity-meta">
                <span class={`admin-activity-kind kind-${activity.kind}`}>{activityLabel(activity)}</span>
                <span>{activity.board_slug}</span>
                <span>{activity.status === 'published' ? '게시됨' : '숨김'}</span>
                {activity.board_slug === 'development' ? (
                  <span>{activity.visibility === 'public' ? '공개' : '비공개'}</span>
                ) : null}
                <OptionalDate value={activity.created_at} />
              </div>
              <h3>
                {activity.status === 'published' ? (
                  <a href={activityHref(activity)}>{activity.post_title}</a>
                ) : (
                  activity.post_title
                )}
              </h3>
              <p class="admin-activity-body">{activity.body}</p>
            </article>
          ))}
        </section>
      )}

      <Pagination
        path={`/admin/members/${encodeURIComponent(member.id)}/activity`}
        page={activities.page}
        totalItems={activities.totalItems}
        totalPages={activities.totalPages}
      />
    </AppLayout>
  )
}
