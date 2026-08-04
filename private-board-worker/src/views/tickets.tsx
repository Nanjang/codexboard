import type {
  CurrentUser,
  DeployInfo,
  TicketLane,
  TicketLogAction,
  TicketLogRow,
  TicketRow,
  TicketTagColor,
  TicketTagRow,
  TrashedTicketRow,
} from '../types'
import { CsrfInput, EmptyState } from './components'
import { formatDateTime, laneLabel } from './format'
import { AppLayout } from './layout'

interface TicketPageProps {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  notice?: string | null
}

export interface TicketTagsPageProps {
  appName: string
  deployInfo: DeployInfo
  user: CurrentUser
  csrfToken: string
  tags: TicketTagRow[]
  error?: string | null
  notice?: string | null
}

export function TicketTagsPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  tags,
  error = null,
  notice = null,
}: TicketTagsPageProps) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="티켓 태그 관리"
      topbarTitle="티켓 태그 관리"
      user={user}
      csrfToken={csrfToken}
      activeNav="tickets"
      backHref="/tickets"
      wide
      notice={notice}
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">개인 작업 보드</p>
          <h2>티켓 태그 관리</h2>
          <p>나만 사용하는 태그를 만들어 티켓을 쉽게 분류해 보세요.</p>
        </div>
        <a class="button button-secondary button-compact" href="/tickets">
          작업 보드
        </a>
      </section>

      <section class="ticket-tags-layout">
        <div class="form-card ticket-tag-create-card">
          {error ? <div class="notice notice-error">{error}</div> : null}
          <h2>태그 만들기</h2>
          <p>태그 이름과 카드에 표시할 색상을 정하세요.</p>
          <form action="/tickets/tags" method="post" class="stack-form">
            <CsrfInput token={csrfToken} />
            <label>
              <span>태그 이름</span>
              <input type="text" name="name" maxlength={32} required autocomplete="off" />
            </label>
            <label>
              <span>태그 색상</span>
              <select name="color" required>
                {ticketTagColors.map((color) => (
                  <option value={color.value} selected={color.value === 'blue'}>
                    {color.label}
                  </option>
                ))}
              </select>
            </label>
            <div class="form-actions">
              <button class="button" type="submit">
                태그 추가
              </button>
            </div>
          </form>
        </div>

        <section class="ticket-tag-list-card" aria-labelledby="ticket-tag-list-title">
          <div class="ticket-tag-list-heading">
            <div>
              <p class="eyebrow">현재 태그</p>
              <h2 id="ticket-tag-list-title">내 태그</h2>
            </div>
            <span>{tags.length}개</span>
          </div>
          {tags.length ? (
            <div class="ticket-tags-management-list">
              {tags.map((tag) => (
                <article class="ticket-tag-management-row" key={tag.id}>
                  <span class={`ticket-tag ticket-tag-color-${tag.color}`}>
                    {tag.name}
                  </span>
                  <form
                    action={`/tickets/tags/${tag.id}/delete`}
                    method="post"
                    data-confirm={`'${tag.name}' 태그를 삭제할까요? 연결된 티켓에서는 태그가 해제됩니다.`}
                  >
                    <CsrfInput token={csrfToken} />
                    <button class="button button-danger button-small" type="submit">
                      삭제
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="아직 태그가 없습니다" description="위에서 첫 태그를 만들어 보세요." />
          )}
        </section>
      </section>
    </AppLayout>
  )
}

interface TicketBoardPageProps extends TicketPageProps {
  availableTags?: TicketTagRow[]
}

const lanes: TicketLane[] = ['todo', 'doing', 'done']

const ticketTagColors: Array<{ value: TicketTagColor; label: string }> = [
  { value: 'coral', label: '산호' },
  { value: 'orange', label: '주황' },
  { value: 'green', label: '초록' },
  { value: 'blue', label: '파랑' },
  { value: 'purple', label: '보라' },
]

const ticketLogActionLabels: Record<TicketLogAction, string> = {
  created: '추가',
  moved: '이동',
  updated: '수정',
  deleted: '삭제',
  restored: '복원',
  purged: '영구 삭제',
}

function TicketTags({ tags }: { tags: TicketTagRow[] | undefined }) {
  if (!tags?.length) return null

  return (
    <div class="ticket-tags" aria-label="연결된 태그">
      {tags.map((tag) => (
        <span class={`ticket-tag ticket-tag-color-${tag.color}`} key={tag.id}>
          {tag.name}
        </span>
      ))}
    </div>
  )
}

function TicketTagSelect({
  availableTags,
  selectedTags = [],
  selectedTagIds,
}: {
  availableTags: TicketTagRow[]
  selectedTags?: TicketTagRow[]
  selectedTagIds?: Array<number | string>
}) {
  const selectedIds = new Set((selectedTagIds ?? selectedTags.map((tag) => tag.id)).map(String))

  return (
    <label>
      <span>태그</span>
      <select class="ticket-tag-select" name="tag_ids" multiple size={Math.min(Math.max(availableTags.length, 3), 6)}>
        {availableTags.length ? (
          availableTags.map((tag) => (
            <option value={tag.id} selected={selectedIds.has(String(tag.id))} key={tag.id}>
              {tag.name}
            </option>
          ))
        ) : (
          <option value="" disabled>
            아직 만든 태그가 없습니다
          </option>
        )}
      </select>
      <span class="form-hint">Ctrl 또는 ⌘를 누른 채 여러 태그를 선택할 수 있습니다.</span>
    </label>
  )
}

function TicketCard({ ticket }: { ticket: TicketRow }) {
  return (
    <article
      class="ticket-card"
      data-ticket-id={ticket.id}
      data-ticket-title={ticket.title}
      data-ticket-note={ticket.note}
      data-ticket-lane={ticket.lane}
      data-ticket-tag-ids={ticket.tags?.map((tag) => String(tag.id)).join(',') ?? ''}
    >
      <div class="ticket-card-top">
        <div class="ticket-card-heading">
          <a
            class="ticket-card-open"
            href={`/tickets/${ticket.id}/edit`}
            data-ticket-edit
            aria-label={`${ticket.title} 수정`}
          >
            <strong>{ticket.title}</strong>
          </a>
          <TicketTags tags={ticket.tags ?? []} />
        </div>
        <button type="button" class="drag-handle" aria-label={`${ticket.title} 끌어서 이동`} title="끌어서 이동">
          <span aria-hidden="true">⠿</span>
        </button>
      </div>
      {ticket.note ? <p class="ticket-note">{ticket.note}</p> : <p class="ticket-note ticket-note-empty">메모 없음</p>}
    </article>
  )
}

export function TicketsPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  notice = null,
  tickets,
  creationRequestId,
  availableTags = [],
}: TicketBoardPageProps & { tickets: TicketRow[]; creationRequestId: string }) {
  const byLane = Object.fromEntries(lanes.map((lane) => [lane, tickets.filter((ticket) => ticket.lane === lane)])) as Record<
    TicketLane,
    TicketRow[]
  >

  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="내 작업"
      topbarTitle="내 작업"
      user={user}
      csrfToken={csrfToken}
      activeNav="tickets"
      wide
      notice={notice}
      contextAction={{ kind: 'link', label: '티켓 추가', href: '/tickets/new', dialogId: 'ticket-create-dialog' }}
    >
      <section class="page-heading ticket-page-heading">
        <div>
          <p class="eyebrow">개인 작업 보드</p>
          <h2>내 작업</h2>
          <p>이 페이지의 티켓은 현재 로그인한 본인에게만 보입니다. 카드를 끌어 상태와 순서를 바꿀 수 있습니다.</p>
        </div>
        <div class="ticket-page-heading-actions">
          <a class="button button-secondary button-compact" href="/tickets/tags">
            태그 관리
          </a>
          <a class="button button-secondary button-compact" href="/tickets/export">
            전체 내보내기
          </a>
          <a class="button button-secondary button-compact" href="/tickets/logs">
            변경 로그
          </a>
          <a class="button button-secondary button-compact" href="/tickets/trash">
            휴지통
          </a>
        </div>
      </section>

      {tickets.length === 0 ? (
        <EmptyState title="작업 티켓이 없습니다" description="간단한 포스트잇처럼 첫 티켓을 추가해 보세요." />
      ) : null}

      <section class="ticket-board" data-ticket-board aria-label="개인 작업 티켓 보드">
        {lanes.map((lane) => (
          <section class="ticket-lane" data-lane={lane} key={lane} aria-labelledby={`lane-${lane}`}>
            <header class="ticket-lane-header">
              <h3 id={`lane-${lane}`}>{laneLabel(lane)}</h3>
              <span>{byLane[lane].length}</span>
            </header>
            <div class="ticket-lane-list" data-lane-list={lane}>
              {byLane[lane].map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
              <button
                type="button"
                class="ticket-drop-zone"
                data-ticket-drop-zone
                data-ticket-create-lane={lane}
                aria-label={`${laneLabel(lane)} 상태에 티켓 추가`}
                title={`${laneLabel(lane)} 상태에 티켓 추가`}
              >
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </section>
        ))}
      </section>

      <dialog id="ticket-create-dialog" class="ticket-dialog">
        <form action="/tickets" method="post" class="stack-form" data-prevent-double-submit>
          <CsrfInput token={csrfToken} />
          <input type="hidden" name="creation_request_id" value={creationRequestId} />
          <div class="dialog-header">
            <h2>티켓 추가</h2>
            <button type="button" class="icon-button" aria-label="닫기" data-dialog-close>
              ×
            </button>
          </div>
          <label>
            <span>제목</span>
            <input type="text" name="title" maxlength={120} required autocomplete="off" />
          </label>
          <label>
            <span>메모</span>
            <textarea name="note" rows={6} maxlength={4000}></textarea>
          </label>
          <label>
            <span>상태</span>
            <select name="lane">
              <option value="todo">할 일</option>
              <option value="doing">진행 중</option>
              <option value="done">완료</option>
            </select>
          </label>
          <TicketTagSelect availableTags={availableTags} />
          <div class="form-actions">
            <button type="button" class="button button-secondary" data-dialog-close>
              취소
            </button>
            <button type="submit" class="button">
              추가
            </button>
          </div>
        </form>
      </dialog>

      <dialog id="ticket-edit-dialog" class="ticket-dialog">
        <form
          id="ticket-delete-form"
          action="/tickets/0/delete"
          method="post"
          class="dialog-delete-form"
          data-ticket-delete-form
          data-confirm="티켓을 휴지통으로 이동할까요?"
        >
          <CsrfInput token={csrfToken} />
        </form>
        <form action="/tickets/0/update" method="post" class="stack-form" data-ticket-edit-form>
          <CsrfInput token={csrfToken} />
          <div class="dialog-header">
            <h2>티켓 수정</h2>
            <div class="dialog-header-actions">
              <button
                type="submit"
                form="ticket-delete-form"
                class="icon-button icon-button-small dialog-delete-button"
                aria-label="티켓 삭제"
                title="티켓 삭제"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M5 7h14m-9 4v6m4-6v6M8 7l1 13h6l1-13M9 7V4h6v3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button type="button" class="icon-button" aria-label="닫기" data-dialog-close>
                ×
              </button>
            </div>
          </div>
          <label>
            <span>제목</span>
            <input type="text" name="title" maxlength={120} required autocomplete="off" />
          </label>
          <label>
            <span>메모</span>
            <textarea name="note" rows={6} maxlength={4000}></textarea>
          </label>
          <label>
            <span>상태</span>
            <select name="lane">
              <option value="todo">할 일</option>
              <option value="doing">진행 중</option>
              <option value="done">완료</option>
            </select>
          </label>
          <TicketTagSelect availableTags={availableTags} />
          <div class="form-actions form-actions-split">
            <button type="button" class="button button-secondary" data-dialog-close>
              취소
            </button>
            <button type="submit" class="button">
              저장
            </button>
          </div>
        </form>
      </dialog>
    </AppLayout>
  )
}

export function TicketLogsPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  logs,
  page,
  pageSize,
  totalItems,
  totalPages,
}: TicketPageProps & {
  logs: TicketLogRow[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}) {
  const pageLink = (nextPage: number) => `/tickets/logs?page=${nextPage}&pageSize=${pageSize}`
  const firstItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const lastItem = Math.min(page * pageSize, totalItems)

  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="티켓 변경 로그"
      topbarTitle="티켓 변경 로그"
      user={user}
      csrfToken={csrfToken}
      activeNav="tickets"
      backHref="/tickets"
      wide
    >
      <section class="page-heading ticket-log-page-heading">
        <div>
          <p class="eyebrow">개인 작업 보드</p>
          <h2>티켓 변경 로그</h2>
          <p>티켓의 추가, 이동, 수정, 삭제 이력을 최신순으로 확인합니다.</p>
        </div>
        <div class="ticket-page-heading-actions">
          <a class="button button-secondary button-compact" href="/tickets/export">
            전체 내보내기
          </a>
          <a class="button button-secondary button-compact" href="/tickets">
            작업 보드
          </a>
        </div>
      </section>

      <section class="ticket-log-card" aria-labelledby="ticket-log-list-title">
        <div class="ticket-log-toolbar">
          <div>
            <h3 id="ticket-log-list-title">변경 이력</h3>
            <p>{totalItems.toLocaleString('ko-KR')}개 중 {firstItem.toLocaleString('ko-KR')}–{lastItem.toLocaleString('ko-KR')}</p>
          </div>
          <form method="get" class="ticket-log-page-size-form">
            <input type="hidden" name="page" value="1" />
            <label>
              <span>페이지당</span>
              <select name="pageSize" aria-label="페이지당 로그 수">
                {[50, 100, 200, 500].map((size) => (
                  <option value={size} selected={size === pageSize}>
                    {size}개
                  </option>
                ))}
              </select>
            </label>
            <button class="button button-secondary button-small" type="submit">
              적용
            </button>
          </form>
        </div>

        {logs.length ? (
          <div class="ticket-log-list">
            {logs.map((log) => (
              <article class="ticket-log-row" key={log.id}>
                <span class={`ticket-log-action ticket-log-action-${log.action}`}>
                  {ticketLogActionLabels[log.action]}
                </span>
                <div class="ticket-log-content">
                  <strong>티켓 #{log.ticket_id}</strong>
                  <span>{log.ticket_title}</span>
                </div>
                <time datetime={new Date(log.created_at).toISOString()}>{formatDateTime(log.created_at)}</time>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="아직 변경 로그가 없습니다" description="티켓을 추가하거나 변경하면 이곳에 기록됩니다." />
        )}

        {totalPages > 1 ? (
          <nav class="ticket-log-pagination" aria-label="티켓 변경 로그 페이지">
            {page > 1 ? <a class="button button-secondary button-small" href={pageLink(page - 1)}>이전</a> : <span />}
            <span>{page} / {totalPages}</span>
            {page < totalPages ? <a class="button button-secondary button-small" href={pageLink(page + 1)}>다음</a> : <span />}
          </nav>
        ) : null}
      </section>
    </AppLayout>
  )
}

export function TicketFormPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  mode,
  ticket,
  error,
  creationRequestId,
  availableTags = [],
  selectedTagIds,
}: TicketPageProps & {
  mode: 'create' | 'edit'
  ticket?: TicketRow
  error?: string | null
  creationRequestId?: string
  availableTags?: TicketTagRow[]
  selectedTagIds?: Array<number | string>
}) {
  const isEdit = mode === 'edit'
  const heading = isEdit ? '티켓 수정' : '티켓 추가'
  const action = isEdit && ticket ? `/tickets/${ticket.id}/update` : '/tickets'

  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle={heading}
      topbarTitle={heading}
      user={user}
      csrfToken={csrfToken}
      activeNav="tickets"
      backHref="/tickets"
      wide
    >
      <section class="form-card">
        {error ? <div class="notice notice-error">{error}</div> : null}
        <form
          action={action}
          method="post"
          class="stack-form"
          data-prevent-double-submit={isEdit ? undefined : true}
        >
          <CsrfInput token={csrfToken} />
          {!isEdit ? <input type="hidden" name="creation_request_id" value={creationRequestId} /> : null}
          <label>
            <span>제목</span>
            <input
              type="text"
              name="title"
              value={ticket?.title ?? ''}
              maxlength={120}
              required
              autofocus
              autocomplete="off"
            />
          </label>
          <label>
            <span>메모</span>
            <textarea name="note" rows={8} maxlength={4000}>
              {ticket?.note ?? ''}
            </textarea>
          </label>
          <label>
            <span>상태</span>
            <select name="lane">
              {lanes.map((lane) => (
                <option value={lane} selected={(ticket?.lane ?? 'todo') === lane}>
                  {laneLabel(lane)}
                </option>
              ))}
            </select>
          </label>
          <TicketTagSelect
            availableTags={availableTags}
            selectedTags={ticket?.tags ?? []}
            {...(selectedTagIds ? { selectedTagIds } : {})}
          />
          <div class="form-actions">
            <a class="button button-secondary" href="/tickets">
              취소
            </a>
            <button class="button" type="submit">
              {isEdit ? '저장' : '추가'}
            </button>
          </div>
        </form>
        {isEdit && ticket ? (
          <form
            action={`/tickets/${ticket.id}/delete`}
            method="post"
            class="separate-danger-form"
            data-confirm="티켓을 휴지통으로 이동할까요?"
          >
            <CsrfInput token={csrfToken} />
            <button class="button button-danger" type="submit">
              티켓 삭제
            </button>
          </form>
        ) : null}
      </section>
    </AppLayout>
  )
}

export function TicketTrashPage({
  appName,
  deployInfo,
  user,
  csrfToken,
  notice = null,
  tickets,
}: TicketPageProps & { tickets: TrashedTicketRow[] }) {
  return (
    <AppLayout
      appName={appName}
      deployInfo={deployInfo}
      documentTitle="티켓 휴지통"
      topbarTitle="티켓 휴지통"
      user={user}
      csrfToken={csrfToken}
      activeNav="tickets"
      backHref="/tickets"
      wide
      notice={notice}
    >
      <section class="page-heading">
        <div>
          <p class="eyebrow">14일 보관</p>
          <h2>티켓 휴지통</h2>
          <p>삭제한 티켓은 14일 동안 복원할 수 있으며, 보관 기한이 지나면 자동으로 영구 삭제됩니다.</p>
        </div>
        <a class="button button-secondary button-compact" href="/tickets">
          작업 보드
        </a>
      </section>

      {tickets.length === 0 ? (
        <EmptyState title="휴지통이 비어 있습니다" description="삭제한 티켓이 여기에 14일 동안 보관됩니다." />
      ) : (
        <section class="ticket-trash-list" aria-label="삭제한 티켓">
          {tickets.map((ticket) => (
            <article class="ticket-trash-card" key={ticket.id}>
              <div class="ticket-trash-content">
                <div class="ticket-trash-heading">
                  <strong>{ticket.title}</strong>
                  <span>{laneLabel(ticket.lane)}</span>
                  <TicketTags tags={ticket.tags ?? []} />
                </div>
                {ticket.note ? <p class="ticket-note">{ticket.note}</p> : null}
                <p class="ticket-trash-meta">
                  삭제 <time datetime={new Date(ticket.deleted_at).toISOString()}>{formatDateTime(ticket.deleted_at)}</time>
                  <span aria-hidden="true"> · </span>
                  영구 삭제 예정{' '}
                  <time datetime={new Date(ticket.purge_after).toISOString()}>{formatDateTime(ticket.purge_after)}</time>
                </p>
              </div>
              <div class="ticket-trash-actions">
                <form action={`/tickets/${ticket.id}/restore`} method="post">
                  <CsrfInput token={csrfToken} />
                  <button class="button button-secondary button-small" type="submit">
                    복원
                  </button>
                </form>
                <form
                  action={`/tickets/${ticket.id}/purge`}
                  method="post"
                  data-confirm="이 티켓을 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다."
                >
                  <CsrfInput token={csrfToken} />
                  <button class="button button-danger button-small" type="submit">
                    영구 삭제
                  </button>
                </form>
              </div>
            </article>
          ))}
        </section>
      )}
    </AppLayout>
  )
}
