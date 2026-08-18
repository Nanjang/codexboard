import type { CurrentUser, DeployInfo, PrivateImageRow } from '../types'
import { CsrfInput, EmptyState } from './components'
import { formatDateTime } from './format'
import { AppLayout } from './layout'

export interface PrivateImageViewItem {
  image: PrivateImageRow
  cacheUrl: string | null
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function PrivateImagesPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  images,
  searchQuery = '',
}: {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  images: PrivateImageViewItem[]
  searchQuery?: string
}) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="개인 이미지 저장"
      topbarTitle="개인 이미지 저장"
      user={user}
      csrfToken={csrfToken}
      activeNav="images"
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">개인 전용 목록</p>
          <h2>이미지 저장 게시판</h2>
          <p>목록은 본인에게만 보입니다. 주소를 복사하면 해당 공개 캐시 URL을 공유할 수 있습니다.</p>
        </div>
        <div class="image-page-heading-actions">
          <button
            type="button"
            class="button button-secondary button-compact"
            data-image-edit-toggle
            aria-pressed="false"
          >
            편집
          </button>
        </div>
      </section>

      <section class="image-tools" aria-label="이미지 검색 및 업로드">
        <form class="image-search-form" action="/images" method="get" role="search">
          <label class="visually-hidden" for="image-search">파일명 또는 메모 검색</label>
          <input
            id="image-search"
            type="search"
            name="q"
            value={searchQuery}
            placeholder="파일명 또는 메모 검색"
            autocomplete="off"
          />
          <button class="button button-secondary" type="submit">검색</button>
        </form>
        <details class="image-upload-disclosure" data-image-uploader>
          <summary class="image-upload-summary">업로드 메뉴</summary>
          <form class="image-upload-card" aria-labelledby="image-upload-title" data-image-upload-form>
            <div>
              <h3 id="image-upload-title">새 이미지 업로드</h3>
              <p>JPEG, PNG, WebP, GIF, AVIF · 파일당 최대 5MiB</p>
            </div>
            <label class="image-file-picker">
              <span class="button">이미지 선택</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                data-image-file
              />
            </label>
            <label class="image-upload-memo">
              <span>메모</span>
              <input type="text" name="memo" maxlength={240} data-image-memo placeholder="이미지 메모(선택)" />
            </label>
            <div class="image-upload-actions">
              <button class="button" type="submit" data-image-submit disabled>업로드</button>
              <button class="button button-secondary" type="button" data-image-upload-cancel>취소</button>
            </div>
            <div class="image-upload-progress" hidden data-image-progress>
              <span data-image-progress-label>업로드 준비 중…</span>
              <progress max={100} value={0} data-image-progress-bar></progress>
            </div>
          </form>
        </details>
      </section>

      {images.length === 0 ? (
        <EmptyState
          title={searchQuery ? '검색 결과가 없습니다' : '저장된 이미지가 없습니다'}
          description={searchQuery ? '파일명 또는 메모를 바꿔 다시 검색해 보세요.' : '업로드 버튼으로 첫 이미지를 저장해 보세요.'}
        />
      ) : (
        <section class="private-image-grid" aria-label="내 이미지 목록">
          {images.map(({ image, cacheUrl }) => (
            <article class="private-image-card" key={image.id} data-image-id={image.id}>
              {cacheUrl ? (
                <a href={cacheUrl} target="_blank" rel="noopener noreferrer" class="private-image-preview">
                  <img src={cacheUrl} alt={image.original_name} loading="lazy" decoding="async" />
                </a>
              ) : (
                <div class="private-image-preview private-image-preview-missing">
                  공개 캐시 URL 설정이 필요합니다.
                </div>
              )}
              <div class="private-image-meta">
                <div class="private-image-meta-heading">
                  <div class="private-image-meta-copy">
                    <strong title={image.original_name}>{image.original_name}</strong>
                    <p class="private-image-memo" data-image-memo-text>{image.memo || '메모 없음'}</p>
                  </div>
                  <button
                    type="button"
                    class="icon-button icon-button-small"
                    data-image-memo-edit
                    aria-label={`${image.original_name} 메모 편집`}
                    title="메모 편집"
                  >
                    ✎
                  </button>
                </div>
                <span class="private-image-details">
                  {formatFileSize(image.size_bytes)} ·{' '}
                  <time datetime={new Date(image.created_at).toISOString()}>{formatDateTime(image.created_at)}</time>
                </span>
                <form class="private-image-memo-form" data-image-memo-form hidden>
                  <label class="visually-hidden" for={`image-memo-${image.id}`}>이미지 메모</label>
                  <input id={`image-memo-${image.id}`} type="text" name="memo" maxlength={240} value={image.memo} data-image-memo-input />
                  <button class="button button-secondary" type="button" data-image-memo-cancel>취소</button>
                  <button class="button" type="submit">저장</button>
                </form>
              </div>
              <div class="private-image-url-row">
                <code title={cacheUrl ?? undefined}>{cacheUrl ?? '캐시 URL 미설정'}</code>
                <button
                  type="button"
                  class="button button-secondary image-copy-button"
                  data-image-copy
                  data-copy-url={cacheUrl ?? ''}
                  disabled={!cacheUrl}
                >
                  복사
                </button>
                <span
                  class="image-copied-mark"
                  aria-label="이 주소를 복사한 적 있음"
                  title="복사 이력 있음"
                  hidden={image.copied_at === null}
                  data-image-copied-mark
                >
                  ✓
                </span>
              </div>
              <form
                action={`/images/${image.id}/delete`}
                method="post"
                class="private-image-delete"
                hidden
                data-image-delete
                data-confirm="보관함 기록만 삭제할까요? 업로드된 원본 이미지는 삭제되지 않습니다."
              >
                <CsrfInput token={csrfToken} />
                <button
                  type="submit"
                  class="text-button text-danger image-delete-button"
                  aria-label="보관함에서 삭제"
                  title="보관함에서 삭제"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-.8 11.2A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.8L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z" />
                  </svg>
                </button>
              </form>
            </article>
          ))}
        </section>
      )}
    </AppLayout>
  )
}
