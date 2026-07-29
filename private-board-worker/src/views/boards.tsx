import type {
  BoardSlug,
  BoardRow,
  CommentRow,
  CurrentUser,
  DeployInfo,
  PostDetailRow,
  PostListRow,
} from '../types'
import { canManageResource } from '../lib/db'
import { plainTextAsHtml } from '../lib/devlog'
import { AuthorName, CsrfInput, EmptyState } from './components'
import { formatDateTime } from './format'
import { AppLayout } from './layout'

function boardActiveNav(slug: BoardSlug): BoardSlug {
  return slug
}

interface CommonPageProps {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  notice?: string | null
}

export function BoardListPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  notice = null,
  board,
  posts,
  hasMore,
}: CommonPageProps & {
  board: BoardRow
  posts: PostListRow[]
  hasMore: boolean
}) {
  const lastPost = posts.at(-1)

  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle={board.name}
      topbarTitle={board.name}
      user={user}
      csrfToken={csrfToken}
      activeNav={boardActiveNav(board.slug)}
      notice={notice}
      contextAction={{ kind: 'link', label: board.slug === 'inquiry' ? '문의 작성' : '글쓰기', href: `/boards/${board.slug}/new` }}
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">공용 게시판</p>
          <h2>{board.name}</h2>
          <p>{board.description}</p>
        </div>
      </section>

      {posts.length === 0 ? (
        <EmptyState title="등록된 글이 없습니다" description="첫 번째 글을 작성해 보세요." />
      ) : (
        <section class="post-list" aria-label={`${board.name} 글 목록`}>
          {posts.map((post) => (
            <article class="post-row" key={post.id}>
              <a class="post-row-link" href={`/posts/${post.id}`}>
                <div class="post-row-main">
                  <div class="post-row-title">
                    <h3>{post.title}</h3>
                    <span class="comment-count" aria-label={`댓글 ${post.comment_count}개`}>
                      [{post.comment_count}]
                    </span>
                  </div>
                  <div class="post-meta">
                    <span class="post-meta-author">
                      <AuthorName nickname={post.author_nickname} role={post.author_role} />
                    </span>
                    <time class="post-meta-time" datetime={new Date(post.created_at).toISOString()}>
                      {formatDateTime(post.created_at)}
                    </time>
                    <span class="post-meta-views">조회 {post.view_count}</span>
                  </div>
                </div>
              </a>
            </article>
          ))}
        </section>
      )}

      {hasMore && lastPost ? (
        <nav class="pagination" aria-label="게시글 페이지">
          <a class="button button-secondary" href={`/boards/${board.slug}?before=${lastPost.id}`}>
            이전 글 더 보기
          </a>
        </nav>
      ) : null}
    </AppLayout>
  )
}

export function PostFormPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  board,
  mode,
  post,
  error,
  imageServiceEnabled = false,
}: CommonPageProps & {
  board: BoardRow
  mode: 'create' | 'edit'
  post?: PostDetailRow
  error?: string | null
  imageServiceEnabled?: boolean
}) {
  const isEdit = mode === 'edit'
  const isDevlog = board.slug === 'development'
  const action = isEdit && post ? `/posts/${post.id}/update` : `/boards/${board.slug}/posts`
  const backHref =
    isEdit && post
      ? isDevlog
        ? `/devlogs/u/${post.author_id}/posts/${post.id}`
        : `/posts/${post.id}`
      : isDevlog
        ? '/devlogs'
        : `/boards/${board.slug}`
  const heading = isEdit ? '글 수정' : board.slug === 'inquiry' ? '문의 작성' : isDevlog ? '개발일지 작성' : '새 글'
  const initialEditorHtml =
    post?.body_format === 'rich' ? post.body : plainTextAsHtml(post?.body ?? '')

  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle={heading}
      topbarTitle={heading}
      user={user}
      csrfToken={csrfToken}
      activeNav={boardActiveNav(board.slug)}
      backHref={backHref}
    >
      <section class="form-card">
        {error ? <div class="notice notice-error">{error}</div> : null}
        <form
          action={action}
          method="post"
          class="stack-form"
          {...(isDevlog ? { 'data-devlog-editor-form': '' } : {})}
        >
          <CsrfInput token={csrfToken} />
          <label>
            <span>제목</span>
            <input
              type="text"
              name="title"
              value={post?.title ?? ''}
              minlength={2}
              maxlength={120}
              required
              autofocus
              autocomplete="off"
            />
          </label>
          {isDevlog ? (
            <>
              <div
                class="visibility-fieldset"
                role="radiogroup"
                aria-labelledby="visibility-label"
              >
                <span class="visibility-label" id="visibility-label">
                  공개 여부
                </span>
                <label class="visibility-option">
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={post?.visibility === 'public'}
                  />
                  <span>공개</span>
                </label>
                <label class="visibility-option">
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={post?.visibility !== 'public'}
                  />
                  <span>비공개</span>
                </label>
              </div>

              <div class="devlog-editor-field">
                <span class="field-label">내용</span>
                <div class="editor-toolbar" role="toolbar" aria-label="본문 서식">
                  <button type="button" data-editor-format="p" title="본문">본문</button>
                  <button type="button" data-editor-format="h2" title="큰 제목">제목 2</button>
                  <button type="button" data-editor-format="h3" title="작은 제목">제목 3</button>
                  <span class="toolbar-divider" aria-hidden="true"></span>
                  <button type="button" data-editor-command="bold" title="굵게">
                    <strong>B</strong>
                  </button>
                  <button type="button" data-editor-command="italic" title="기울임">
                    <em>I</em>
                  </button>
                  <button type="button" data-editor-command="insertUnorderedList" title="글머리 기호">
                    • 목록
                  </button>
                  <button type="button" data-editor-command="insertOrderedList" title="번호 목록">
                    1. 목록
                  </button>
                  <button type="button" data-editor-link title="링크 삽입">
                    링크
                  </button>
                  <span class="toolbar-divider" aria-hidden="true"></span>
                  <button
                    type="button"
                    data-editor-image
                    title={imageServiceEnabled ? '이미지 삽입' : '관리자가 이미지 서비스를 먼저 활성화해야 합니다'}
                    disabled={!imageServiceEnabled}
                  >
                    이미지
                  </button>
                  <input
                    class="visually-hidden"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    data-editor-image-input
                    disabled={!imageServiceEnabled}
                  />
                </div>
                <div
                  class="devlog-editor"
                  contenteditable={true}
                  role="textbox"
                  aria-multiline="true"
                  data-devlog-editor
                  dangerouslySetInnerHTML={{ __html: initialEditorHtml }}
                ></div>
                <textarea class="visually-hidden" name="body" data-devlog-editor-value required>
                  {initialEditorHtml}
                </textarea>
                <div class="editor-status-row">
                  <span data-editor-status aria-live="polite">
                    {imageServiceEnabled
                      ? '이미지는 현재 커서 위치에 삽입됩니다.'
                      : '이미지 서비스가 비활성화되어 있습니다.'}
                  </span>
                  <span data-editor-count>{initialEditorHtml.length.toLocaleString()} / 20,000</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <label>
                <span>내용</span>
                <textarea name="body" rows={14} maxlength={20000} required>
                  {post?.body ?? ''}
                </textarea>
              </label>
              <p class="form-hint">일반 텍스트만 저장합니다. 이미지, HTML, 첨부파일은 지원하지 않습니다.</p>
            </>
          )}
          <div class="form-actions">
            <a class="button button-secondary" href={backHref}>
              취소
            </a>
            <button class="button" type="submit">
              {isEdit ? '수정 저장' : '등록'}
            </button>
          </div>
        </form>
      </section>
    </AppLayout>
  )
}

export function PostDetailPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  notice = null,
  post,
  comments,
}: CommonPageProps & {
  post: PostDetailRow
  comments: CommentRow[]
}) {
  const canManagePost = canManageResource(user, post.author_id)

  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle={post.title}
      topbarTitle={post.board_name}
      user={user}
      csrfToken={csrfToken}
      activeNav={boardActiveNav(post.board_slug)}
      notice={notice}
      backHref={`/boards/${post.board_slug}`}
      {...(canManagePost
        ? { contextAction: { kind: 'link' as const, label: '수정', href: `/posts/${post.id}/edit` } }
        : {})}
    >
      <article class="post-detail">
        <header class="post-detail-header">
          <p class="eyebrow">{post.board_name}</p>
          <h2>{post.title}</h2>
          <div class="post-meta post-detail-meta">
            <span>
              <AuthorName nickname={post.author_nickname} role={post.author_role} />
            </span>
            <time datetime={new Date(post.created_at).toISOString()}>{formatDateTime(post.created_at)}</time>
            {post.updated_at !== post.created_at ? <span>수정됨</span> : null}
          </div>
        </header>
        <div class="post-body">{post.body}</div>

        {canManagePost ? (
          <footer class="resource-actions">
            <a class="button button-secondary button-small" href={`/posts/${post.id}/edit`}>
              수정
            </a>
            <form action={`/posts/${post.id}/delete`} method="post" data-confirm="게시글과 댓글을 모두 삭제할까요?">
              <CsrfInput token={csrfToken} />
              <button class="button button-danger button-small" type="submit">
                삭제
              </button>
            </form>
          </footer>
        ) : null}
      </article>

      <section class="comments-section" aria-labelledby="comments-title">
        <div class="section-title-row">
          <h2 id="comments-title">댓글</h2>
          <span>{comments.length}</span>
        </div>

        {comments.length === 0 ? (
          <p class="comments-empty">아직 댓글이 없습니다.</p>
        ) : (
          <div class="comment-list">
            {comments.map((comment) => {
              const canManageComment = canManageResource(user, comment.author_id)
              return (
                <article class="comment" id={`comment-${comment.id}`} key={comment.id}>
                  <header>
                    <strong>
                      <AuthorName nickname={comment.author_nickname} role={comment.author_role} />
                    </strong>
                    <time datetime={new Date(comment.created_at).toISOString()}>
                      {formatDateTime(comment.created_at)}
                    </time>
                  </header>
                  <div class="comment-body">{comment.body}</div>
                  {canManageComment ? (
                    <footer>
                      <a class="text-button" href={`/comments/${comment.id}/edit`}>
                        수정
                      </a>
                      <form action={`/comments/${comment.id}/delete`} method="post" data-confirm="댓글을 삭제할까요?">
                        <CsrfInput token={csrfToken} />
                        <button class="text-button text-danger" type="submit">
                          삭제
                        </button>
                      </form>
                    </footer>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}

        <form action={`/posts/${post.id}/comments`} method="post" class="comment-form">
          <CsrfInput token={csrfToken} />
          <label for="comment-body">댓글 작성</label>
          <textarea id="comment-body" name="body" rows={4} maxlength={4000} required></textarea>
          <div class="form-actions form-actions-end">
            <button class="button" type="submit">
              댓글 등록
            </button>
          </div>
        </form>
      </section>
    </AppLayout>
  )
}

export function CommentEditPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  post,
  comment,
  error,
}: CommonPageProps & {
  post: PostDetailRow
  comment: CommentRow
  error?: string | null
}) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="댓글 수정"
      topbarTitle="댓글 수정"
      user={user}
      csrfToken={csrfToken}
      activeNav={boardActiveNav(post.board_slug)}
      backHref={`/posts/${post.id}#comment-${comment.id}`}
    >
      <section class="form-card">
        {error ? <div class="notice notice-error">{error}</div> : null}
        <form action={`/comments/${comment.id}/update`} method="post" class="stack-form">
          <CsrfInput token={csrfToken} />
          <label>
            <span>댓글</span>
            <textarea name="body" rows={8} maxlength={4000} required autofocus>
              {comment.body}
            </textarea>
          </label>
          <div class="form-actions">
            <a class="button button-secondary" href={`/posts/${post.id}#comment-${comment.id}`}>
              취소
            </a>
            <button class="button" type="submit">
              수정 저장
            </button>
          </div>
        </form>
      </section>
    </AppLayout>
  )
}
