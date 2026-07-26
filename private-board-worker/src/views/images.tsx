import type { CurrentUser, DeployInfo, PrivateImageRow } from '../types'
import { EmptyState } from './components'
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
}: {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  images: PrivateImageViewItem[]
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
      </section>

      <section class="image-upload-card" aria-labelledby="image-upload-title" data-image-uploader>
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
        <div class="image-upload-progress" hidden data-image-progress>
          <span data-image-progress-label>업로드 준비 중…</span>
          <progress max={100} value={0} data-image-progress-bar></progress>
        </div>
      </section>

      {images.length === 0 ? (
        <EmptyState title="저장된 이미지가 없습니다" description="이미지 선택 버튼으로 첫 이미지를 업로드해 보세요." />
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
                <strong title={image.original_name}>{image.original_name}</strong>
                <span>
                  {formatFileSize(image.size_bytes)} ·{' '}
                  <time datetime={new Date(image.created_at).toISOString()}>{formatDateTime(image.created_at)}</time>
                </span>
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
            </article>
          ))}
        </section>
      )}
    </AppLayout>
  )
}
