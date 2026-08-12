import type { BoardRow, CommentRow, DeployInfo, PostDetailRow, PostListRow } from '../types'
import { AutoLinkText, AuthorName, EmptyState } from './components'
import { formatDateTime, formatPostListDateTime } from './format'
import { PublicLayout } from './layout'

interface PublicBoardProps {
  appName: string
  deployInfo: DeployInfo
  board: BoardRow
  posts: PostListRow[]
  hasMore: boolean
}

function PublicHeader({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <header class="public-board-topbar">
      <a href={backHref} class="public-board-brand">
        {backLabel}
      </a>
      <a href="/login" class="button button-secondary button-compact">
        로그인
      </a>
    </header>
  )
}

export function PublicBoardListPage({ appName, deployInfo, board, posts, hasMore }: PublicBoardProps) {
  const lastPost = posts.at(-1)

  return (
    <PublicLayout appName={appName} deployInfo={deployInfo} documentTitle={board.name}>
      <main class="public-board-shell">
        <PublicHeader backHref="/" backLabel={appName} />
        <section class="page-heading">
          <div>
            <p class="eyebrow">공용 게시판</p>
            <h1>{board.name}</h1>
            <p>{board.description}</p>
          </div>
        </section>

        {posts.length === 0 ? (
          <EmptyState title="등록된 글이 없습니다" description="아직 공개된 글이 없습니다." />
        ) : (
          <section class="post-list" aria-label={`${board.name} 글 목록`}>
            <div class="post-list-header">
              <span>제목</span>
              <span>작성자</span>
              <span>시간</span>
              <span>조회</span>
            </div>
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
                        <span class="post-meta-time-full">{formatDateTime(post.created_at)}</span>
                        <span class="post-meta-time-compact">{formatPostListDateTime(post.created_at)}</span>
                      </time>
                      <span class="post-meta-views">{post.view_count}</span>
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
        <p class="public-read-note">게시글을 읽는 중입니다. 글쓰기와 댓글 작성은 로그인 후 이용할 수 있습니다.</p>
      </main>
    </PublicLayout>
  )
}

export function PublicPostDetailPage({
  appName,
  deployInfo,
  post,
  comments,
}: {
  appName: string
  deployInfo: DeployInfo
  post: PostDetailRow
  comments: CommentRow[]
}) {
  return (
    <PublicLayout appName={appName} deployInfo={deployInfo} documentTitle={post.title}>
      <main class="public-board-shell">
        <PublicHeader backHref={`/boards/${post.board_slug}`} backLabel={`← ${post.board_name}`} />
        <article class="post-detail">
          <header class="post-detail-header">
            <p class="eyebrow">{post.board_name}</p>
            <h1>{post.title}</h1>
            <div class="post-meta post-detail-meta">
              <span>
                <AuthorName nickname={post.author_nickname} role={post.author_role} />
              </span>
              <time datetime={new Date(post.created_at).toISOString()}>{formatDateTime(post.created_at)}</time>
              {post.updated_at !== post.created_at ? <span>수정됨</span> : null}
            </div>
          </header>
          {post.body_format === 'rich' ? (
            <div class="post-body devlog-rich-body" dangerouslySetInnerHTML={{ __html: post.body }} />
          ) : (
            <div class="post-body"><AutoLinkText text={post.body} /></div>
          )}
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
              {comments.map((comment) => (
                <article class="comment" id={`comment-${comment.id}`} key={comment.id}>
                  <header>
                    <strong>
                      <AuthorName nickname={comment.author_nickname} role={comment.author_role} />
                    </strong>
                    <time datetime={new Date(comment.created_at).toISOString()}>
                      {formatDateTime(comment.created_at)}
                    </time>
                  </header>
                  <div class="comment-body"><AutoLinkText text={comment.body} /></div>
                </article>
              ))}
            </div>
          )}
          <p class="public-read-note">댓글을 읽을 수 있습니다. <a href="/login">로그인 후 댓글을 작성할 수 있습니다.</a></p>
        </section>
      </main>
    </PublicLayout>
  )
}
