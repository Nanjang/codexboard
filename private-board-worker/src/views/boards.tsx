import type {
  BoardRow,
  CommentRow,
  CurrentUser,
  PostDetailRow,
  PostListRow,
} from '../types'
import { canManageResource } from '../lib/db'
import { CsrfInput, EmptyState } from './components'
import { formatDateTime } from './format'
import { AppLayout } from './layout'

function boardActiveNav(slug: string): 'free' | 'inquiry' {
  return slug === 'inquiry' ? 'inquiry' : 'free'
}

interface CommonPageProps {
  appName: string
  user: CurrentUser
  csrfToken: string
  notice?: string | null
}

export function BoardListPage({
  appName,
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
                  <h3>{post.title}</h3>
                  <div class="post-meta">
                    <span>{post.author_nickname}</span>
                    <time datetime={new Date(post.created_at).toISOString()}>{formatDateTime(post.created_at)}</time>
                  </div>
                </div>
                <span class="comment-count" aria-label={`댓글 ${post.comment_count}개`}>
                  {post.comment_count}
                </span>
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
  user,
  csrfToken,
  board,
  mode,
  post,
  error,
}: CommonPageProps & {
  board: BoardRow
  mode: 'create' | 'edit'
  post?: PostDetailRow
  error?: string | null
}) {
  const isEdit = mode === 'edit'
  const action = isEdit && post ? `/posts/${post.id}/update` : `/boards/${board.slug}/posts`
  const backHref = isEdit && post ? `/posts/${post.id}` : `/boards/${board.slug}`
  const heading = isEdit ? '글 수정' : board.slug === 'inquiry' ? '문의 작성' : '새 글'

  return (
    <AppLayout
      appName={appName}
      documentTitle={heading}
      topbarTitle={heading}
      user={user}
      csrfToken={csrfToken}
      activeNav={boardActiveNav(board.slug)}
      backHref={backHref}
    >
      <section class="form-card">
        {error ? <div class="notice notice-error">{error}</div> : null}
        <form action={action} method="post" class="stack-form">
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
          <label>
            <span>내용</span>
            <textarea name="body" rows={14} maxlength={20000} required>
              {post?.body ?? ''}
            </textarea>
          </label>
          <p class="form-hint">일반 텍스트만 저장합니다. 이미지, HTML, 첨부파일은 지원하지 않습니다.</p>
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
            <span>{post.author_nickname}</span>
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
                    <strong>{comment.author_nickname}</strong>
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
