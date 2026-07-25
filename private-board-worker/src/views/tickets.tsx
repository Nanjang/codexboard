import type { CurrentUser, TicketLane, TicketRow } from '../types'
import { CsrfInput, EmptyState } from './components'
import { laneLabel } from './format'
import { AppLayout } from './layout'

interface TicketPageProps {
  appName: string
  user: CurrentUser
  csrfToken: string
  notice?: string | null
}

const lanes: TicketLane[] = ['todo', 'doing', 'done']

function previousLane(lane: TicketLane): TicketLane | null {
  if (lane === 'doing') return 'todo'
  if (lane === 'done') return 'doing'
  return null
}

function nextLane(lane: TicketLane): TicketLane | null {
  if (lane === 'todo') return 'doing'
  if (lane === 'doing') return 'done'
  return null
}

function TicketCard({ ticket, csrfToken }: { ticket: TicketRow; csrfToken: string }) {
  const left = previousLane(ticket.lane)
  const right = nextLane(ticket.lane)

  return (
    <article
      class="ticket-card"
      data-ticket-id={ticket.id}
      data-ticket-title={ticket.title}
      data-ticket-note={ticket.note}
      data-ticket-lane={ticket.lane}
    >
      <div class="ticket-card-top">
        <a
          class="ticket-card-open"
          href={`/tickets/${ticket.id}/edit`}
          data-ticket-edit
          aria-label={`${ticket.title} 수정`}
        >
          <strong>{ticket.title}</strong>
        </a>
        <button type="button" class="drag-handle" aria-label={`${ticket.title} 끌어서 이동`} title="끌어서 이동">
          <span aria-hidden="true">⠿</span>
        </button>
      </div>
      {ticket.note ? <p class="ticket-note">{ticket.note}</p> : <p class="ticket-note ticket-note-empty">메모 없음</p>}
      <footer class="ticket-card-footer">
        <div class="ticket-move-actions" aria-label="작업 상태 이동">
          {left ? (
            <form action={`/tickets/${ticket.id}/move`} method="post">
              <CsrfInput token={csrfToken} />
              <input type="hidden" name="lane" value={left} />
              <button class="icon-button icon-button-small" type="submit" aria-label={`${laneLabel(left)}로 이동`}>
                ←
              </button>
            </form>
          ) : (
            <span class="icon-spacer"></span>
          )}
          {right ? (
            <form action={`/tickets/${ticket.id}/move`} method="post">
              <CsrfInput token={csrfToken} />
              <input type="hidden" name="lane" value={right} />
              <button class="icon-button icon-button-small" type="submit" aria-label={`${laneLabel(right)}로 이동`}>
                →
              </button>
            </form>
          ) : (
            <span class="icon-spacer"></span>
          )}
        </div>
        <a class="text-button" href={`/tickets/${ticket.id}/edit`} data-ticket-edit>
          열기
        </a>
      </footer>
    </article>
  )
}

export function TicketsPage({
  appName,
  user,
  csrfToken,
  notice = null,
  tickets,
}: TicketPageProps & { tickets: TicketRow[] }) {
  const byLane = Object.fromEntries(lanes.map((lane) => [lane, tickets.filter((ticket) => ticket.lane === lane)])) as Record<
    TicketLane,
    TicketRow[]
  >

  return (
    <AppLayout
      appName={appName}
      documentTitle="내 작업"
      topbarTitle="내 작업"
      user={user}
      csrfToken={csrfToken}
      activeNav="tickets"
      notice={notice}
      contextAction={{ kind: 'link', label: '티켓 추가', href: '/tickets/new', dialogId: 'ticket-create-dialog' }}
    >
      <section class="page-heading ticket-page-heading">
        <div>
          <p class="eyebrow">개인 작업 보드</p>
          <h2>내 작업</h2>
          <p>이 페이지의 티켓은 현재 로그인한 본인에게만 보입니다. 카드를 끌어 상태와 순서를 바꿀 수 있습니다.</p>
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
                <TicketCard key={ticket.id} ticket={ticket} csrfToken={csrfToken} />
              ))}
            </div>
          </section>
        ))}
      </section>

      <dialog id="ticket-create-dialog" class="ticket-dialog">
        <form action="/tickets" method="post" class="stack-form">
          <CsrfInput token={csrfToken} />
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
        <form action="/tickets/0/update" method="post" class="stack-form" data-ticket-edit-form>
          <CsrfInput token={csrfToken} />
          <div class="dialog-header">
            <h2>티켓 수정</h2>
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
          <div class="form-actions form-actions-split">
            <button type="button" class="button button-secondary" data-dialog-close>
              취소
            </button>
            <button type="submit" class="button">
              저장
            </button>
          </div>
        </form>
        <form action="/tickets/0/delete" method="post" class="dialog-delete-form" data-ticket-delete-form data-confirm="티켓을 삭제할까요?">
          <CsrfInput token={csrfToken} />
          <button type="submit" class="button button-danger button-full">
            티켓 삭제
          </button>
        </form>
      </dialog>
    </AppLayout>
  )
}

export function TicketFormPage({
  appName,
  user,
  csrfToken,
  mode,
  ticket,
  error,
}: TicketPageProps & {
  mode: 'create' | 'edit'
  ticket?: TicketRow
  error?: string | null
}) {
  const isEdit = mode === 'edit'
  const heading = isEdit ? '티켓 수정' : '티켓 추가'
  const action = isEdit && ticket ? `/tickets/${ticket.id}/update` : '/tickets'

  return (
    <AppLayout
      appName={appName}
      documentTitle={heading}
      topbarTitle={heading}
      user={user}
      csrfToken={csrfToken}
      activeNav="tickets"
      backHref="/tickets"
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
          <form action={`/tickets/${ticket.id}/delete`} method="post" class="separate-danger-form" data-confirm="티켓을 삭제할까요?">
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
