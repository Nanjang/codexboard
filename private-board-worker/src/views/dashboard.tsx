import type { CurrentUser, DashboardWidgetRow, DeployInfo, PostListRow } from '../types'
import { CsrfInput } from './components'
import { formatDateTime } from './format'
import { AppLayout } from './layout'

interface DashboardPageProps {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  notice?: string | null
  widgets: DashboardWidgetRow[]
  freeBoardPosts: PostListRow[]
}

function FreeBoardWidget({
  widgetId,
  posts,
  csrfToken,
}: {
  widgetId: number
  posts: PostListRow[]
  csrfToken: string
}) {
  return (
    <article class="dashboard-widget">
      <header class="dashboard-widget-header">
        <div>
          <span class="dashboard-widget-kicker">게시판 요약</span>
          <h3>자유게시판</h3>
        </div>
        <div class="dashboard-widget-actions">
          <a class="text-button" href="/boards/free">
            전체 보기
          </a>
          <form
            action={`/dashboard/widgets/${widgetId}/delete`}
            method="post"
            data-confirm="대시보드에서 자유게시판 위젯을 제거할까요?"
          >
            <CsrfInput token={csrfToken} />
            <button class="text-button widget-remove-button" type="submit">
              제거
            </button>
          </form>
        </div>
      </header>

      {posts.length === 0 ? (
        <div class="dashboard-widget-empty">
          <p>아직 등록된 글이 없습니다.</p>
          <a class="text-button" href="/boards/free/new">
            첫 글 작성
          </a>
        </div>
      ) : (
        <div class="dashboard-post-list">
          {posts.map((post) => (
            <a class="dashboard-post-row" href={`/posts/${post.id}`} key={post.id}>
              <div class="dashboard-post-title">
                <strong>{post.title}</strong>
                <span aria-label={`댓글 ${post.comment_count}개`}>[{post.comment_count}]</span>
              </div>
              <div class="dashboard-post-meta">
                <span>{post.author_nickname}</span>
                <time datetime={new Date(post.created_at).toISOString()}>{formatDateTime(post.created_at)}</time>
                <span>조회 {post.view_count}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </article>
  )
}

function BookmarkWidget({
  widget,
  csrfToken,
}: {
  widget: DashboardWidgetRow
  csrfToken: string
}) {
  if (!widget.title || !widget.url) return null

  const hostname = new URL(widget.url).hostname
  return (
    <article class="dashboard-widget bookmark-widget">
      <header class="dashboard-widget-header">
        <div>
          <span class="dashboard-widget-kicker">내 북마크</span>
          <h3>{widget.title}</h3>
        </div>
        <form
          action={`/dashboard/widgets/${widget.id}/delete`}
          method="post"
          data-confirm="이 북마크 위젯을 제거할까요?"
        >
          <CsrfInput token={csrfToken} />
          <button class="text-button widget-remove-button" type="submit">
            제거
          </button>
        </form>
      </header>
      <a class="bookmark-widget-link" href={widget.url} target="_blank" rel="noopener noreferrer">
        <span class="bookmark-widget-icon" aria-hidden="true">
          ↗
        </span>
        <span>
          <strong>{hostname}</strong>
          <small>{widget.url}</small>
        </span>
      </a>
    </article>
  )
}

export function DashboardPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  notice = null,
  widgets,
  freeBoardPosts,
}: DashboardPageProps) {
  const hasFreeBoard = widgets.some((widget) => widget.widget_type === 'free-board')

  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="내 대시보드"
      topbarTitle="내 대시보드"
      user={user}
      csrfToken={csrfToken}
      activeNav="dashboard"
      notice={notice}
    >
      <section class="page-heading dashboard-heading">
        <div>
          <p class="eyebrow">개인 홈</p>
          <h2>{user.nickname}님의 대시보드</h2>
          <p>자주 확인하는 정보를 위젯으로 구성하는 나만의 첫 화면입니다.</p>
        </div>
      </section>

      <section class="dashboard-grid" aria-label="내 위젯">
        {widgets.map((widget) =>
          widget.widget_type === 'free-board' ? (
            <FreeBoardWidget
              key={widget.id}
              widgetId={widget.id}
              posts={freeBoardPosts}
              csrfToken={csrfToken}
            />
          ) : (
            <BookmarkWidget key={widget.id} widget={widget} csrfToken={csrfToken} />
          ),
        )}

        <button
          class="dashboard-add-slot"
          type="button"
          aria-label="대시보드 위젯 추가"
          data-dialog-open="widget-add-dialog"
        >
          <span class="dashboard-add-icon" aria-hidden="true">
            +
          </span>
          <strong>위젯 추가</strong>
          <small>원하는 정보를 이곳에 배치하세요</small>
        </button>
      </section>

      <dialog id="widget-add-dialog" class="ticket-dialog widget-dialog">
        <div class="widget-dialog-content">
          <div class="dialog-header">
            <div>
              <span class="dashboard-widget-kicker">위젯 카탈로그</span>
              <h2>대시보드에 추가</h2>
            </div>
            <button type="button" class="icon-button" aria-label="닫기" data-dialog-close>
              ×
            </button>
          </div>

          <article class="widget-catalog-item">
            <div class="widget-catalog-copy">
              <span class="widget-catalog-icon" aria-hidden="true">
                자
              </span>
              <div>
                <h3>자유게시판 요약</h3>
                <p>최신 글 5개와 댓글 수, 작성자, 조회수를 빠르게 확인합니다.</p>
              </div>
            </div>
            {hasFreeBoard ? (
              <button class="button button-secondary" type="button" disabled>
                추가됨
              </button>
            ) : (
              <form action="/dashboard/widgets" method="post">
                <CsrfInput token={csrfToken} />
                <input type="hidden" name="widgetType" value="free-board" />
                <button class="button" type="submit">
                  추가
                </button>
              </form>
            )}
          </article>

          <article class="widget-catalog-item widget-catalog-bookmark">
            <div class="widget-catalog-copy">
              <span class="widget-catalog-icon" aria-hidden="true">
                ↗
              </span>
              <div>
                <h3>URL 북마크</h3>
                <p>자주 방문하는 웹페이지를 내 대시보드에 바로가기 위젯으로 추가합니다.</p>
              </div>
            </div>
            <form action="/dashboard/widgets" method="post" class="bookmark-widget-form">
              <CsrfInput token={csrfToken} />
              <input type="hidden" name="widgetType" value="bookmark" />
              <label>
                <span>표시 이름</span>
                <input type="text" name="title" maxlength={60} required autocomplete="off" />
              </label>
              <label>
                <span>URL</span>
                <input
                  type="url"
                  name="url"
                  maxlength={2048}
                  placeholder="https://example.com/"
                  required
                  autocomplete="url"
                />
              </label>
              <button class="button" type="submit">
                북마크 추가
              </button>
            </form>
          </article>

          <p class="widget-catalog-hint">현재 자유게시판 요약과 URL 북마크 위젯을 지원합니다.</p>
        </div>
      </dialog>
    </AppLayout>
  )
}
