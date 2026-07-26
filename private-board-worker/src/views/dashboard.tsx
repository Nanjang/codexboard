import type {
  CurrentUser,
  DashboardWidgetRow,
  DeployInfo,
  PostListRow,
  RssWidgetResult,
} from '../types'
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
  rssResults: Record<number, RssWidgetResult>
}

function WidgetEditControls({ label }: { label: string }) {
  return (
    <div class="dashboard-edit-controls" aria-label={`${label} 순서 편집`}>
      <button
        class="icon-button icon-button-small dashboard-move-button"
        type="button"
        aria-label={`${label} 앞으로 이동`}
        title="앞으로 이동"
        data-dashboard-move="-1"
      >
        ←
      </button>
      <button
        class="icon-button icon-button-small dashboard-move-button"
        type="button"
        aria-label={`${label} 뒤로 이동`}
        title="뒤로 이동"
        data-dashboard-move="1"
      >
        →
      </button>
      <button
        class="icon-button icon-button-small dashboard-drag-handle"
        type="button"
        aria-label={`${label} 끌어서 순서 변경`}
        title="끌어서 순서 변경"
      >
        ⠿
      </button>
    </div>
  )
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
    <article class="dashboard-widget" data-dashboard-widget-id={widgetId}>
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
            class="dashboard-remove-form"
            action={`/dashboard/widgets/${widgetId}/delete`}
            method="post"
            data-confirm="대시보드에서 자유게시판 위젯을 제거할까요?"
          >
            <CsrfInput token={csrfToken} />
            <button class="text-button widget-remove-button" type="submit">
              제거
            </button>
          </form>
          <WidgetEditControls label="자유게시판 위젯" />
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
    <article class="dashboard-widget bookmark-widget" data-dashboard-widget-id={widget.id}>
      <header class="dashboard-widget-header">
        <div>
          <span class="dashboard-widget-kicker">내 북마크</span>
          <h3>{widget.title}</h3>
        </div>
        <div class="dashboard-widget-actions">
          <form
            class="dashboard-remove-form"
            action={`/dashboard/widgets/${widget.id}/delete`}
            method="post"
            data-confirm="이 북마크 위젯을 제거할까요?"
          >
            <CsrfInput token={csrfToken} />
            <button class="text-button widget-remove-button" type="submit">
              제거
            </button>
          </form>
          <WidgetEditControls label={`${widget.title} 북마크 위젯`} />
        </div>
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

function RssWidget({
  widget,
  result,
  csrfToken,
}: {
  widget: DashboardWidgetRow
  result: RssWidgetResult | undefined
  csrfToken: string
}) {
  if (!widget.title || !widget.url) return null

  return (
    <article class="dashboard-widget rss-widget" data-dashboard-widget-id={widget.id}>
      <header class="dashboard-widget-header">
        <div>
          <span class="dashboard-widget-kicker">RSS 최신 글</span>
          <h3>{widget.title}</h3>
        </div>
        <div class="dashboard-widget-actions">
          <a class="text-button" href={widget.url} target="_blank" rel="noopener noreferrer">
            원본
          </a>
          <form
            class="dashboard-remove-form"
            action={`/dashboard/widgets/${widget.id}/delete`}
            method="post"
            data-confirm="이 RSS 위젯을 제거할까요?"
          >
            <CsrfInput token={csrfToken} />
            <button class="text-button widget-remove-button" type="submit">
              제거
            </button>
          </form>
          <WidgetEditControls label={`${widget.title} RSS 위젯`} />
        </div>
      </header>

      {result?.error ? (
        <div class="dashboard-widget-empty rss-widget-error">
          <p>{result.error}</p>
          <small>주소나 RSS 서버 상태를 확인해 주세요.</small>
        </div>
      ) : !result?.feed || result.feed.items.length === 0 ? (
        <div class="dashboard-widget-empty">
          <p>표시할 최신 글이 없습니다.</p>
        </div>
      ) : (
        <div class="rss-item-list">
          {result.feed.items.map((item) => (
            <a
              class="rss-item-row"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              key={item.url}
            >
              <strong>{item.title}</strong>
              {item.summary ? <p>{item.summary}</p> : null}
              {item.publishedAt ? (
                <time datetime={new Date(item.publishedAt).toISOString()}>
                  {formatDateTime(item.publishedAt)}
                </time>
              ) : null}
            </a>
          ))}
        </div>
      )}
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
  rssResults,
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
        <div class="dashboard-edit-panel">
          <span class="dashboard-save-status" aria-live="polite" data-dashboard-save-status />
          <button
            class="button button-secondary button-compact"
            type="button"
            aria-pressed="false"
            data-dashboard-edit-toggle
          >
            대시보드 편집
          </button>
        </div>
      </section>

      <section class="dashboard-grid" aria-label="내 위젯" data-dashboard>
        {widgets.map((widget) => {
          if (widget.widget_type === 'free-board') {
            return (
              <FreeBoardWidget
                key={widget.id}
                widgetId={widget.id}
                posts={freeBoardPosts}
                csrfToken={csrfToken}
              />
            )
          }
          if (widget.widget_type === 'rss') {
            return (
              <RssWidget
                key={widget.id}
                widget={widget}
                result={rssResults[widget.id]}
                csrfToken={csrfToken}
              />
            )
          }
          return <BookmarkWidget key={widget.id} widget={widget} csrfToken={csrfToken} />
        })}

        <button
          class="dashboard-add-slot"
          type="button"
          aria-label="대시보드 위젯 추가"
          data-dashboard-add-slot
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

          <article class="widget-catalog-item widget-catalog-rss">
            <div class="widget-catalog-copy">
              <span class="widget-catalog-icon" aria-hidden="true">
                RSS
              </span>
              <div>
                <h3>RSS 최신 글</h3>
                <p>공개 HTTPS RSS 또는 Atom 주소를 등록해 최신 글 5개를 날짜순으로 확인합니다.</p>
              </div>
            </div>
            <form action="/dashboard/widgets" method="post" class="bookmark-widget-form">
              <CsrfInput token={csrfToken} />
              <input type="hidden" name="widgetType" value="rss" />
              <label>
                <span>표시 이름</span>
                <input type="text" name="title" maxlength={60} required autocomplete="off" />
              </label>
              <label>
                <span>RSS 주소</span>
                <input
                  type="url"
                  name="url"
                  maxlength={2048}
                  placeholder="https://example.com/feed.xml"
                  required
                  autocomplete="url"
                />
              </label>
              <button class="button" type="submit">
                RSS 추가
              </button>
            </form>
          </article>

          <p class="widget-catalog-hint">
            현재 자유게시판 요약, URL 북마크, RSS 최신 글 위젯을 지원합니다.
          </p>
        </div>
      </dialog>
    </AppLayout>
  )
}
