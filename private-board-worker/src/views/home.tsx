import type { BoardSlug, DeployInfo, PostListRow } from '../types'
import { formatDateTime } from './format'
import { PublicLayout } from './layout'

export interface GuestBoardPreview {
  slug: Extract<BoardSlug, 'free' | 'development' | 'news'>
  name: string
  posts: PostListRow[]
}

interface GuestHomePageProps {
  appName: string
  deployInfo: DeployInfo
  previews: GuestBoardPreview[]
}

export function GuestHomePage({ appName, deployInfo, previews }: GuestHomePageProps) {
  return (
    <PublicLayout appName={appName} deployInfo={deployInfo} documentTitle="홈">
      <main class="guest-home">
        <header class="guest-home-header">
          <div>
            <p class="eyebrow">회원 커뮤니티</p>
            <h1>{appName}</h1>
            <p>최근 게시글을 둘러보고 Google 계정으로 로그인해 대화에 참여하세요.</p>
          </div>
          <a class="button button-google guest-login-button" href="/login">
            Google 계정으로 로그인
          </a>
        </header>

        <div class="guest-preview-grid">
          {previews.map((preview) => (
            <section class="guest-preview-card" aria-labelledby={`preview-${preview.slug}`} key={preview.slug}>
              <header class="guest-preview-header">
                <div>
                  <p class="eyebrow">최근 게시글 5건</p>
                  <h2 id={`preview-${preview.slug}`}>{preview.name}</h2>
                </div>
                <a href={`/boards/${preview.slug}`}>게시판 보기</a>
              </header>

              {preview.posts.length === 0 ? (
                <p class="guest-preview-empty">아직 등록된 글이 없습니다.</p>
              ) : (
                <div class="guest-preview-list">
                  {preview.posts.map((post) => (
                    <a class="guest-preview-row" href={`/posts/${post.id}`} key={post.id}>
                      <strong>{post.title}</strong>
                      <span class="guest-preview-meta">
                        <span>{post.author_nickname}</span>
                        <time datetime={new Date(post.created_at).toISOString()}>
                          {formatDateTime(post.created_at)}
                        </time>
                        <span>댓글 {post.comment_count}</span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        <p class="guest-home-note">게시글 상세 확인과 작성, 댓글 참여는 로그인 후 이용할 수 있습니다.</p>
      </main>
    </PublicLayout>
  )
}
