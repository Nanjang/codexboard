import type {
  CurrentUser,
  DashboardWidgetRow,
  DeployInfo,
  PostListRow,
  RssWidgetResult,
} from '../types'
import { AuthorName, CsrfInput } from './components'
import { formatDateTime } from './format'
import { AppLayout } from './layout'
import {
  BOOKMARK_ICON_OPTIONS,
  normalizeBookmarkIconColor,
} from '../lib/bookmark-icon-palette'

interface DashboardPageProps {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  notice?: string | null
  widgets: DashboardWidgetRow[]
  freeBoardPosts: PostListRow[]
  rssResults: Record<number, RssWidgetResult>
  bookmarkCreationRequestId: string
}

function WidgetEditControls({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div class="dashboard-edit-controls" aria-label={`${label} 순서 편집`}>
      {compact ? null : (
        <>
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
        </>
      )}
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
                <span>
                  <AuthorName nickname={post.author_nickname} role={post.author_role} />
                </span>
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

function BookmarkQuickLink({
  widget,
  csrfToken,
}: {
  widget: DashboardWidgetRow
  csrfToken: string
}) {
  if (!widget.title || !widget.url) return null
  const compactMode = widget.compact_mode === 1

  return (
    <article
      class={`bookmark-quick-link${compactMode ? ' is-compact' : ''}`}
      data-dashboard-widget-id={widget.id}
    >
      <a
        class="bookmark-quick-link-main"
        href={widget.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={compactMode ? widget.title : undefined}
        title={compactMode ? widget.title : undefined}
      >
        <span class="bookmark-widget-icon" aria-hidden="true">
          <img
            src={`/dashboard/widgets/${widget.id}/icon`}
            alt=""
            width="20"
            height="20"
            loading="lazy"
            decoding="async"
          />
        </span>
        <span>
          <strong>{widget.title}</strong>
        </span>
      </a>
      <div class="bookmark-quick-link-actions">
        <button
          class="icon-button icon-button-small"
          type="button"
          aria-label={`${widget.title} 북마크 정보 변경`}
          title="북마크 정보 변경"
          data-dialog-open={`bookmark-edit-dialog-${widget.id}`}
        >
          ✎
        </button>
        <form
          class="dashboard-remove-form"
          action={`/dashboard/widgets/${widget.id}/delete`}
          method="post"
          data-confirm="이 북마크를 제거할까요?"
        >
          <CsrfInput token={csrfToken} />
          <button
            class="icon-button icon-button-small widget-remove-button"
            type="submit"
            aria-label={`${widget.title} 북마크 제거`}
            title="북마크 제거"
          >
            <svg
              class="dashboard-remove-icon"
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </form>
        <WidgetEditControls label={`${widget.title} 북마크`} compact />
      </div>
    </article>
  )
}

function BookmarkFormFields({ widget }: { widget?: DashboardWidgetRow }) {
  return (
    <div class="bookmark-dialog-fields">
      <label>
        <span>표시 이름</span>
        <input
          type="text"
          name="title"
          maxlength={60}
          value={widget?.title ?? ''}
          required
          autocomplete="off"
        />
      </label>
      <label>
        <span>URL</span>
        <input
          type="url"
          name="url"
          maxlength={2048}
          value={widget?.url ?? ''}
          placeholder="https://example.com/"
          required
          autocomplete="url"
        />
      </label>
    </div>
  )
}

function BookmarkIconFields({ widget }: { widget?: DashboardWidgetRow }) {
  const usesIconUrl = Boolean(widget?.icon_url)
  const iconColor = normalizeBookmarkIconColor(widget?.icon_color)

  return (
    <fieldset class="bookmark-icon-settings">
      <legend>아이콘</legend>
      <div class="bookmark-icon-mode-options">
        <label>
          <input type="radio" name="iconMode" value="default" checked={!usesIconUrl} />
          <span>기본 아이콘 사용</span>
        </label>
        <label>
          <input type="radio" name="iconMode" value="url" checked={usesIconUrl} />
          <span>아이콘 URL 사용</span>
        </label>
      </div>

      <div class="bookmark-icon-color-field">
        <span>기본 아이콘 색상</span>
        <div class="bookmark-icon-color-options">
          {BOOKMARK_ICON_OPTIONS.map((option) => (
            <label title={option.label}>
              <input
                type="radio"
                name="iconColor"
                value={option.value}
                checked={iconColor === option.value}
              />
              <span
                class={`bookmark-icon-color-swatch bookmark-icon-color-${option.value}`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 28 28">
                  <path
                    d="M10 18 18 10m-6 0h6v6"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div class="bookmark-icon-url-field">
        <div class="bookmark-icon-url-heading">
          <span>아이콘 URL</span>
          <button
            class="button button-secondary button-compact"
            type="button"
            data-bookmark-icon-lookup
          >
            아이콘 URL 자동 조회
          </button>
        </div>
        <input
          type="url"
          name="iconUrl"
          maxlength={2048}
          value={widget?.icon_url ?? ''}
          placeholder="https://example.com/icon.png"
          autocomplete="url"
        />
        <small class="bookmark-icon-lookup-status" data-bookmark-icon-lookup-status aria-live="polite" />
      </div>
      <label class="bookmark-compact-mode-field">
        <input
          type="checkbox"
          name="compactMode"
          value="1"
          checked={widget?.compact_mode === 1}
          disabled={!usesIconUrl}
          data-bookmark-compact-mode
        />
        <span>간소모드 사용</span>
      </label>
      <p class="bookmark-icon-hint">
        아이콘 URL은 공개 HTTPS PNG, JPG, WebP, GIF 또는 ICO 이미지 주소를 입력해 주세요.
      </p>
    </fieldset>
  )
}

function BookmarkAddDialog({
  csrfToken,
  creationRequestId,
}: {
  csrfToken: string
  creationRequestId: string
}) {
  return (
    <dialog id="bookmark-add-dialog" class="ticket-dialog bookmark-dialog">
      <form
        action="/dashboard/bookmarks"
        method="post"
        class="bookmark-dialog-content"
        data-prevent-double-submit
      >
        <CsrfInput token={csrfToken} />
        <input type="hidden" name="creation_request_id" value={creationRequestId} />
        <div class="dialog-header">
          <div>
            <span class="dashboard-widget-kicker">빠른 이동</span>
            <h2>북마크 추가</h2>
          </div>
          <button type="button" class="icon-button" aria-label="닫기" data-dialog-close>
            ×
          </button>
        </div>
        <BookmarkFormFields />
        <BookmarkIconFields />
        <div class="bookmark-dialog-actions">
          <button class="button" type="submit">
            북마크 추가
          </button>
        </div>
      </form>
    </dialog>
  )
}

function BookmarkEditDialog({
  widget,
  csrfToken,
}: {
  widget: DashboardWidgetRow
  csrfToken: string
}) {
  if (!widget.title || !widget.url) return null

  return (
    <dialog id={`bookmark-edit-dialog-${widget.id}`} class="ticket-dialog bookmark-dialog">
      <form
        action={`/dashboard/bookmarks/${widget.id}/update`}
        method="post"
        class="bookmark-dialog-content"
      >
        <CsrfInput token={csrfToken} />
        <div class="dialog-header">
          <div>
            <span class="dashboard-widget-kicker">북마크 설정</span>
            <h2>북마크 정보 변경</h2>
          </div>
          <button type="button" class="icon-button" aria-label="닫기" data-dialog-close>
            ×
          </button>
        </div>
        <BookmarkFormFields widget={widget} />
        <BookmarkIconFields widget={widget} />
        <div class="bookmark-dialog-actions">
          <button class="button" type="submit">
            변경사항 저장
          </button>
        </div>
      </form>
    </dialog>
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
  bookmarkCreationRequestId,
}: DashboardPageProps) {
  const hasFreeBoard = widgets.some((widget) => widget.widget_type === 'free-board')
  const bookmarkWidgets = widgets
    .filter((widget) => widget.widget_type === 'bookmark')
    .sort((left, right) => Number(right.compact_mode === 1) - Number(left.compact_mode === 1))
  const compactBookmarkWidgets = bookmarkWidgets.filter((widget) => widget.compact_mode === 1)
  const standardBookmarkWidgets = bookmarkWidgets.filter((widget) => widget.compact_mode !== 1)
  const contentWidgets = widgets.filter((widget) => widget.widget_type !== 'bookmark')

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
        <div class="dashboard-home-intro">
          <p
            class="eyebrow dashboard-home-title"
            tabindex={0}
            aria-describedby="dashboard-home-description"
          >
            {user.nickname}님의 개인 홈
          </p>
          <span id="dashboard-home-description" class="dashboard-home-tooltip" role="tooltip">
            자주 확인하는 정보를 위젯으로 구성하는 나만의 첫 화면입니다.
          </span>
        </div>
        <div class="dashboard-edit-panel">
          <span class="dashboard-save-status" aria-live="polite" data-dashboard-save-status />
          <button
            class="button button-secondary button-compact dashboard-edit-toggle"
            type="button"
            aria-pressed="false"
            aria-label="대시보드 편집"
            title="대시보드 편집"
            data-dashboard-edit-toggle
          >
            <img class="gear-icon dashboard-edit-icon" src="/assets/gear-tilted.png" alt="" aria-hidden="true" />
          </button>
        </div>
      </section>

      <div class="dashboard-root" data-dashboard>
        <section class="dashboard-quick-links-section" aria-labelledby="dashboard-quick-links-title">
          <div class="dashboard-section-heading">
            <div>
              <span class="dashboard-widget-kicker">빠른 이동</span>
              <h3 id="dashboard-quick-links-title">내 북마크</h3>
            </div>
            <div class="dashboard-section-actions">
              <button
                class="button button-secondary dashboard-bookmark-add-button"
                type="button"
                data-dialog-open="bookmark-add-dialog"
                aria-label="북마크 추가"
                title="북마크 추가"
              >
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </div>
          <div
            class="dashboard-quick-links"
            aria-label="내 북마크 목록"
          >
            {compactBookmarkWidgets.length > 0 ? (
              <div
                class="dashboard-bookmark-compact-bar"
                aria-label="간소모드 북마크"
                data-dashboard-sortable="bookmarks-compact"
              >
                {compactBookmarkWidgets.map((widget) => (
                  <BookmarkQuickLink key={widget.id} widget={widget} csrfToken={csrfToken} />
                ))}
              </div>
            ) : null}
            <div
              class="dashboard-bookmark-standard-grid"
              aria-label="일반 북마크"
              data-dashboard-sortable="bookmarks-standard"
            >
              {standardBookmarkWidgets.map((widget) => (
                <BookmarkQuickLink key={widget.id} widget={widget} csrfToken={csrfToken} />
              ))}
            </div>
          </div>
        </section>

        <section
          class="dashboard-grid"
          aria-label="내 정보 위젯"
          data-dashboard-sortable="widgets"
        >
          {contentWidgets.map((widget) => {
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
            return (
              <RssWidget
                key={widget.id}
                widget={widget}
                result={rssResults[widget.id]}
                csrfToken={csrfToken}
              />
            )
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
      </div>

      <BookmarkAddDialog
        csrfToken={csrfToken}
        creationRequestId={bookmarkCreationRequestId}
      />
      {bookmarkWidgets.map((widget) => (
        <BookmarkEditDialog key={widget.id} widget={widget} csrfToken={csrfToken} />
      ))}

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
            현재 자유게시판 요약과 RSS 최신 글 위젯을 지원합니다.
          </p>
        </div>
      </dialog>
    </AppLayout>
  )
}
