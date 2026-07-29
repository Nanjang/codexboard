import type {
  CurrentUser,
  DeployInfo,
  DevlogAuthor,
  DevlogAuthorRow,
  DevlogPostListRow,
  PostDetailRow,
} from '../types'
import type { Child } from 'hono/jsx'
import { canManageResource } from '../lib/db'
import { devlogExcerpt } from '../lib/devlog'
import { firstDevlogImageSource } from '../lib/devlog-preview'
import { AuthorName, EmptyState } from './components'
import { formatDateTime } from './format'
import { AppLayout, PublicLayout } from './layout'

interface ViewerProps {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser | null | undefined
  csrfToken: string | undefined
}

function DevlogShell({
  appName,
  deployInfo,
  user,
  csrfToken,
  documentTitle,
  topbarTitle,
  backHref,
  contextAction,
  children,
}: ViewerProps & {
  documentTitle: string
  topbarTitle: string
  backHref?: string
  contextAction?: { kind: 'link'; label: string; href: string }
  children: Child
}) {
  if (user && csrfToken) {
    return (
      <AppLayout
        appName={appName}
        deployInfo={deployInfo}
        documentTitle={documentTitle}
        topbarTitle={topbarTitle}
        user={user}
        csrfToken={csrfToken}
        activeNav="development"
        {...(backHref ? { backHref } : {})}
        {...(contextAction ? { contextAction } : {})}
      >
        {children}
      </AppLayout>
    )
  }

  return (
    <PublicLayout appName={appName} deployInfo={deployInfo} documentTitle={documentTitle}>
      <main class="public-devlog-shell">
        <header class="public-devlog-topbar">
          <a href="/devlogs" class="public-devlog-brand">
            {appName} 개발일지
          </a>
          <a href="/login" class="button button-secondary button-compact">
            로그인
          </a>
        </header>
        {children}
      </main>
    </PublicLayout>
  )
}

export function DevlogDirectoryPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  authors,
}: ViewerProps & { authors: DevlogAuthorRow[] }) {
  return (
    <DevlogShell
      appName={appName}
      deployInfo={deployInfo}
      user={user}
      csrfToken={csrfToken}
      documentTitle="개발일지"
      topbarTitle="개발일지"
      {...(user
        ? {
            contextAction: {
              kind: 'link' as const,
              label: '내 개발일지',
              href: `/devlogs/u/${encodeURIComponent(user.id)}`,
            },
          }
        : {})}
    >
      <section class="devlog-directory">
        <header class="devlog-hero">
          <p class="eyebrow">BUILD NOTES</p>
          <h1>개발일지</h1>
          <p>만드는 과정과 배운 내용을 사용자별 블로그에서 살펴보세요.</p>
        </header>

        {authors.length === 0 ? (
          <EmptyState title="공개된 개발일지가 없습니다" description="첫 번째 공개 개발 기록을 작성해 보세요." />
        ) : (
          <div class="devlog-author-grid">
            {authors.map((author) => (
              <a class="devlog-author-card" href={`/devlogs/u/${encodeURIComponent(author.id)}`} key={author.id}>
                <span class="devlog-author-avatar" aria-hidden="true">
                  {author.nickname.slice(0, 1).toUpperCase()}
                </span>
                <span class="devlog-author-copy">
                  <strong>
                    <AuthorName nickname={author.nickname} role={author.role} />
                  </strong>
                  <small>공개 글 {author.public_post_count}개</small>
                  <time datetime={new Date(author.latest_post_at).toISOString()}>
                    최근 기록 {formatDateTime(author.latest_post_at)}
                  </time>
                </span>
                <span aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        )}
      </section>
    </DevlogShell>
  )
}

export function UserDevlogPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  author,
  posts,
  hasMore,
}: ViewerProps & {
  author: DevlogAuthor
  posts: DevlogPostListRow[]
  hasMore: boolean
}) {
  const canWrite = user?.id === author.id
  const canExport = user ? canManageResource(user, author.id) : false
  const lastPost = posts.at(-1)
  return (
    <DevlogShell
      appName={appName}
      deployInfo={deployInfo}
      user={user}
      csrfToken={csrfToken}
      documentTitle={`${author.nickname}의 개발일지`}
      topbarTitle={`${author.nickname}의 개발일지`}
      backHref="/devlogs"
      {...(canWrite
        ? {
            contextAction: {
              kind: 'link' as const,
              label: '새 기록',
              href: '/boards/development/new',
            },
          }
        : {})}
    >
      <section class="devlog-blog">
        <header class="devlog-blog-header">
          <span class="devlog-blog-avatar" aria-hidden="true">
            {author.nickname.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p class="eyebrow">DEVELOPMENT LOG</p>
            <h1>{author.nickname}의 개발일지</h1>
            <p>작업 과정, 결정, 시행착오를 기록합니다.</p>
          </div>
        </header>

        {posts.length === 0 ? (
          <EmptyState
            title={canWrite ? '아직 작성한 기록이 없습니다' : '공개된 기록이 없습니다'}
            description={canWrite ? '첫 개발 기록을 작성해 보세요.' : '작성자가 공개한 글이 아직 없습니다.'}
          />
        ) : (
          <div class="devlog-post-grid">
            {posts.map((post) => {
              const previewImageUrl =
                post.preview_image_url ?? firstDevlogImageSource(post.body)
              return (
                <article class="devlog-post-card" key={post.id}>
                  <a href={`/devlogs/u/${encodeURIComponent(author.id)}/posts/${post.id}`}>
                    <div class="devlog-post-card-meta">
                      <time datetime={new Date(post.created_at).toISOString()}>{formatDateTime(post.created_at)}</time>
                      {post.visibility === 'private' ? <span class="visibility-badge">비공개</span> : null}
                    </div>
                    {previewImageUrl ? (
                      <div class="devlog-post-card-preview">
                        <img src={previewImageUrl} alt="" loading="lazy" decoding="async" />
                      </div>
                    ) : null}
                    <h2>{post.title}</h2>
                    <p>{devlogExcerpt(post.body, post.body_format) || '이미지 중심의 기록입니다.'}</p>
                    <span class="devlog-read-more">기록 읽기 →</span>
                  </a>
                </article>
              )
            })}
          </div>
        )}

        {hasMore && lastPost ? (
          <nav class="pagination" aria-label="개발일지 페이지">
            <a
              class="button button-secondary"
              href={`/devlogs/u/${encodeURIComponent(author.id)}?before=${lastPost.id}`}
            >
              이전 기록 더 보기
            </a>
          </nav>
        ) : null}

        {canExport ? (
          <footer class="devlog-archive-export">
            <div>
              <strong>개발일지 전체 보관</strong>
              <p>모든 게시물을 Markdown 파일로 묶고 이미지 경로는 images/ 하위로 유지합니다.</p>
            </div>
            <a
              class="button button-secondary"
              href={`/devlogs/u/${encodeURIComponent(author.id)}/export.zip`}
              download
            >
              전체 Markdown ZIP 내보내기
            </a>
          </footer>
        ) : null}
      </section>
    </DevlogShell>
  )
}

export function DevlogPostPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  post,
}: ViewerProps & { post: PostDetailRow }) {
  const canManage = user ? canManageResource(user, post.author_id) : false
  const backHref = `/devlogs/u/${encodeURIComponent(post.author_id)}`
  return (
    <DevlogShell
      appName={appName}
      deployInfo={deployInfo}
      user={user}
      csrfToken={csrfToken}
      documentTitle={post.title}
      topbarTitle="개발일지"
      backHref={backHref}
      {...(canManage
        ? {
            contextAction: {
              kind: 'link' as const,
              label: '편집',
              href: `/posts/${post.id}/edit`,
            },
          }
        : {})}
    >
      <article class="devlog-entry">
        <header class="devlog-entry-header">
          <a href={backHref} class="devlog-entry-author">
            <AuthorName nickname={post.author_nickname} role={post.author_role} />
          </a>
          <h1>{post.title}</h1>
          <div class="devlog-entry-meta">
            <time datetime={new Date(post.created_at).toISOString()}>{formatDateTime(post.created_at)}</time>
            {post.updated_at !== post.created_at ? <span>수정됨</span> : null}
            {post.visibility === 'private' ? <span class="visibility-badge">비공개</span> : null}
          </div>
          {canManage ? (
            <a
              class="button button-secondary button-small"
              href={`/devlogs/u/${encodeURIComponent(post.author_id)}/posts/${post.id}/export.md`}
              download
            >
              Markdown 내보내기
            </a>
          ) : null}
        </header>
        {post.body_format === 'rich' ? (
          <div class="devlog-rich-body" dangerouslySetInnerHTML={{ __html: post.body }} />
        ) : (
          <div class="devlog-rich-body devlog-plain-body">{post.body}</div>
        )}
      </article>
    </DevlogShell>
  )
}
