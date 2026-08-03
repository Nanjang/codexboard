import type {
  CurrentUser,
  DeployInfo,
  PaginatedResult,
  PersonalBookmarkRow,
} from '../types'
import { CsrfInput, EmptyState } from './components'
import { AppLayout } from './layout'

interface PersonalBookmarksPageProps {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  notice?: string | null
  bookmarks: PaginatedResult<PersonalBookmarkRow>
  creationRequestId: string
}

function BookmarkFields({ bookmark }: { bookmark?: PersonalBookmarkRow }) {
  return (
    <div class="personal-bookmark-fields">
      <label>
        <span>내용</span>
        <input
          type="text"
          name="content"
          value={bookmark?.content ?? ''}
          maxlength={240}
          placeholder="한 줄 메모"
          required
          autocomplete="off"
        />
      </label>
      <label>
        <span>링크</span>
        <input
          type="url"
          name="url"
          value={bookmark?.url ?? ''}
          maxlength={2048}
          placeholder="https://example.com/"
          required
          autocomplete="url"
        />
      </label>
      <label>
        <span>{bookmark ? '아이콘 변경' : '아이콘'}</span>
        <input
          type="file"
          name="icon"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          required={!bookmark}
        />
        <small>
          {bookmark
            ? '새 이미지를 선택하지 않으면 현재 아이콘을 유지합니다.'
            : 'PNG, JPG, WebP, GIF, AVIF · 최대 128KiB'}
        </small>
      </label>
    </div>
  )
}

function AddDialog({
  csrfToken,
  creationRequestId,
}: {
  csrfToken: string
  creationRequestId: string
}) {
  return (
    <dialog id="personal-bookmark-add-dialog" class="ticket-dialog personal-bookmark-dialog">
      <form
        action="/personal-bookmarks"
        method="post"
        enctype="multipart/form-data"
        class="personal-bookmark-dialog-content"
        data-prevent-double-submit
      >
        <CsrfInput token={csrfToken} />
        <input type="hidden" name="creation_request_id" value={creationRequestId} />
        <div class="dialog-header">
          <div>
            <span class="eyebrow">개인 전용</span>
            <h2>개인 북마크 추가</h2>
          </div>
          <button type="button" class="icon-button" aria-label="닫기" data-dialog-close>
            ×
          </button>
        </div>
        <BookmarkFields />
        <div class="personal-bookmark-dialog-actions">
          <button class="button" type="submit">
            추가
          </button>
        </div>
      </form>
    </dialog>
  )
}

function EditDialog({
  bookmark,
  page,
  csrfToken,
}: {
  bookmark: PersonalBookmarkRow
  page: number
  csrfToken: string
}) {
  return (
    <dialog
      id={`personal-bookmark-edit-dialog-${bookmark.id}`}
      class="ticket-dialog personal-bookmark-dialog"
    >
      <form
        action={`/personal-bookmarks/${bookmark.id}/update`}
        method="post"
        enctype="multipart/form-data"
        class="personal-bookmark-dialog-content"
      >
        <CsrfInput token={csrfToken} />
        <input type="hidden" name="page" value={page} />
        <div class="dialog-header">
          <div>
            <span class="eyebrow">개인 북마크</span>
            <h2>항목 편집</h2>
          </div>
          <button type="button" class="icon-button" aria-label="닫기" data-dialog-close>
            ×
          </button>
        </div>
        <BookmarkFields bookmark={bookmark} />
        <div class="personal-bookmark-dialog-actions">
          <button class="button" type="submit">
            저장
          </button>
        </div>
      </form>
    </dialog>
  )
}

function Pagination({ bookmarks }: { bookmarks: PaginatedResult<PersonalBookmarkRow> }) {
  const displayTotalPages = Math.max(1, bookmarks.totalPages)
  return (
    <nav class="personal-bookmark-pagination" aria-label="개인 북마크 페이지">
      <span>
        {bookmarks.totalItems}개 · {bookmarks.page} / {displayTotalPages}페이지
      </span>
      <div>
        {bookmarks.page > 1 ? (
          <a class="button button-secondary" href={`/personal-bookmarks?page=${bookmarks.page - 1}`} rel="prev">
            이전
          </a>
        ) : (
          <span />
        )}
        {bookmarks.page < bookmarks.totalPages ? (
          <a class="button button-secondary" href={`/personal-bookmarks?page=${bookmarks.page + 1}`} rel="next">
            다음
          </a>
        ) : null}
      </div>
    </nav>
  )
}

export function PersonalBookmarksPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  notice = null,
  bookmarks,
  creationRequestId,
}: PersonalBookmarksPageProps) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="개인 북마크"
      topbarTitle="개인 북마크"
      user={user}
      csrfToken={csrfToken}
      activeNav="personal-bookmarks"
      notice={notice}
    >
      <section class="page-heading personal-bookmark-heading">
        <div>
          <p class="eyebrow">나만 보는 링크 메모장</p>
          <h2>개인 북마크</h2>
          <p>아이콘과 한 줄 메모를 함께 저장하고, 메모를 눌러 링크로 이동합니다.</p>
        </div>
        <div class="personal-bookmark-heading-actions">
          <span aria-live="polite" data-personal-bookmark-save-status />
          <button
            class="button button-secondary button-compact"
            type="button"
            aria-pressed="false"
            data-personal-bookmark-edit-toggle
            disabled={bookmarks.items.length === 0}
          >
            순서 편집
          </button>
          <button
            class="button button-compact"
            type="button"
            data-dialog-open="personal-bookmark-add-dialog"
          >
            항목 추가
          </button>
        </div>
      </section>

      <div
        class="personal-bookmark-root"
        data-personal-bookmarks
        data-page={bookmarks.page}
      >
        {bookmarks.page > 1 ? (
          <div
            class="personal-bookmark-previous-drop"
            data-personal-bookmark-previous-drop
            aria-label="앞 페이지로 보내기"
          >
            <strong>앞 페이지로 보내기</strong>
            <span>항목을 이곳에 놓으면 이전 페이지 끝으로 이동합니다.</span>
          </div>
        ) : null}

        {bookmarks.items.length === 0 ? (
          <EmptyState
            title="저장된 개인 북마크가 없습니다"
            description="항목 추가 버튼으로 첫 링크 메모를 만들어 보세요."
          />
        ) : (
          <section
            class="personal-bookmark-paper"
            aria-label="개인 북마크 목록"
            data-personal-bookmark-list
          >
            {bookmarks.items.map((bookmark) => (
              <article
                id={`personal-bookmark-${bookmark.id}`}
                class="personal-bookmark-row"
                data-personal-bookmark-id={bookmark.id}
                tabindex={-1}
                key={bookmark.id}
              >
                <button
                  class="personal-bookmark-drag-handle"
                  type="button"
                  aria-label={`${bookmark.content} 순서 이동 핸들`}
                  title="끌어서 순서 변경"
                >
                  ⠿
                </button>
                <a
                  class="personal-bookmark-link"
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={bookmark.url}
                >
                  <img
                    src={`/personal-bookmarks/${bookmark.id}/icon`}
                    alt=""
                    width="28"
                    height="28"
                    loading="lazy"
                    decoding="async"
                  />
                  <span>{bookmark.content}</span>
                  <span aria-hidden="true">↗</span>
                </a>
                <div class="personal-bookmark-row-actions">
                  <button
                    class="icon-button icon-button-small"
                    type="button"
                    aria-label={`${bookmark.content} 편집`}
                    title="편집"
                    data-dialog-open={`personal-bookmark-edit-dialog-${bookmark.id}`}
                  >
                    ✎
                  </button>
                  <form
                    action={`/personal-bookmarks/${bookmark.id}/delete`}
                    method="post"
                    data-confirm="이 개인 북마크를 삭제할까요?"
                  >
                    <CsrfInput token={csrfToken} />
                    <input type="hidden" name="page" value={bookmarks.page} />
                    <button
                      class="icon-button icon-button-small"
                      type="submit"
                      aria-label={`${bookmark.content} 삭제`}
                      title="삭제"
                    >
                      ×
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      <Pagination bookmarks={bookmarks} />
      <AddDialog csrfToken={csrfToken} creationRequestId={creationRequestId} />
      {bookmarks.items.map((bookmark) => (
        <EditDialog
          key={bookmark.id}
          bookmark={bookmark}
          page={bookmarks.page}
          csrfToken={csrfToken}
        />
      ))}
    </AppLayout>
  )
}
