import Sortable from 'sortablejs'

function setupMenu(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]')
  const layer = document.querySelector<HTMLElement>('[data-menu-layer]')
  const panel = document.querySelector<HTMLElement>('#app-menu')
  if (!toggle || !layer || !panel) return

  const open = (): void => {
    layer.hidden = false
    document.body.classList.add('menu-open')
    toggle.setAttribute('aria-expanded', 'true')
    requestAnimationFrame(() => {
      layer.classList.add('is-open')
      panel.focus()
    })
  }

  const close = (): void => {
    layer.classList.remove('is-open')
    document.body.classList.remove('menu-open')
    toggle.setAttribute('aria-expanded', 'false')
    window.setTimeout(() => {
      layer.hidden = true
      toggle.focus()
    }, 180)
  }

  toggle.addEventListener('click', () => {
    if (layer.hidden) open()
    else close()
  })
  layer.querySelectorAll<HTMLElement>('[data-menu-close]').forEach((element) => {
    element.addEventListener('click', close)
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !layer.hidden) close()
  })
}

function openDialog(dialog: HTMLDialogElement): void {
  if (!dialog.open) dialog.showModal()
  const autofocus = dialog.querySelector<HTMLElement>('[autofocus], input, textarea, select, button')
  window.setTimeout(() => autofocus?.focus(), 0)
}

function setupDialogs(): void {
  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const opener = target.closest<HTMLElement>('[data-dialog-open]')
    if (opener) {
      const id = opener.dataset.dialogOpen
      const dialog = id ? document.getElementById(id) : null
      if (dialog instanceof HTMLDialogElement) {
        event.preventDefault()
        openDialog(dialog)
      }
      return
    }

    const closer = target.closest<HTMLElement>('[data-dialog-close]')
    if (closer) {
      const dialog = closer.closest('dialog')
      if (dialog instanceof HTMLDialogElement) dialog.close()
    }
  })

  document.querySelectorAll<HTMLDialogElement>('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close()
    })
  })
}

function setupTicketEditing(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#ticket-edit-dialog')
  const editForm = document.querySelector<HTMLFormElement>('[data-ticket-edit-form]')
  const deleteForm = document.querySelector<HTMLFormElement>('[data-ticket-delete-form]')
  if (!dialog || !editForm || !deleteForm) return

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const link = target.closest<HTMLElement>('[data-ticket-edit]')
    if (!link) return

    const card = link.closest<HTMLElement>('[data-ticket-id]')
    if (!card) return

    const id = card.dataset.ticketId
    const title = card.dataset.ticketTitle ?? ''
    const note = card.dataset.ticketNote ?? ''
    const lane = card.dataset.ticketLane ?? 'todo'
    if (!id) return

    event.preventDefault()
    editForm.action = `/tickets/${encodeURIComponent(id)}/update`
    deleteForm.action = `/tickets/${encodeURIComponent(id)}/delete`

    const titleInput = editForm.elements.namedItem('title')
    const noteInput = editForm.elements.namedItem('note')
    const laneInput = editForm.elements.namedItem('lane')
    if (titleInput instanceof HTMLInputElement) titleInput.value = title
    if (noteInput instanceof HTMLTextAreaElement) noteInput.value = note
    if (laneInput instanceof HTMLSelectElement) laneInput.value = lane

    openDialog(dialog)
  })
}

function setupConfirmations(): void {
  document.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) return
    const message = form.dataset.confirm
    if (message && !window.confirm(message)) event.preventDefault()
  })
}

function setupNotices(): void {
  document.querySelectorAll<HTMLElement>('[data-dismissible]').forEach((notice) => {
    notice.querySelector<HTMLElement>('[data-dismiss]')?.addEventListener('click', () => notice.remove())
  })
}

function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
}

function ticketOrderPayload(): Record<'todo' | 'doing' | 'done', number[]> {
  const result: Record<'todo' | 'doing' | 'done', number[]> = { todo: [], doing: [], done: [] }
  document.querySelectorAll<HTMLElement>('[data-lane-list]').forEach((list) => {
    const lane = list.dataset.laneList
    if (lane !== 'todo' && lane !== 'doing' && lane !== 'done') return
    result[lane] = Array.from(list.querySelectorAll<HTMLElement>(':scope > [data-ticket-id]'))
      .map((card) => Number.parseInt(card.dataset.ticketId ?? '', 10))
      .filter(Number.isSafeInteger)
  })
  return result
}

function updateLaneCounts(): void {
  document.querySelectorAll<HTMLElement>('[data-lane]').forEach((lane) => {
    const count = lane.querySelectorAll(':scope > [data-lane-list] > [data-ticket-id]').length
    const badge = lane.querySelector<HTMLElement>('.ticket-lane-header > span')
    if (badge) badge.textContent = String(count)
  })
}

async function saveTicketOrder(board: HTMLElement): Promise<void> {
  if (board.dataset.saving === 'true') {
    board.dataset.pendingSave = 'true'
    return
  }

  board.dataset.saving = 'true'
  board.classList.add('is-saving')
  let failed = false

  try {
    const response = await fetch('/api/tickets/order', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken(),
      },
      body: JSON.stringify(ticketOrderPayload()),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? '티켓 순서를 저장하지 못했습니다.')
    }
    updateLaneCounts()
  } catch (error) {
    failed = true
    window.alert(error instanceof Error ? error.message : '티켓 순서를 저장하지 못했습니다.')
    window.location.reload()
  } finally {
    delete board.dataset.saving
    board.classList.remove('is-saving')

    if (!failed && board.dataset.pendingSave === 'true') {
      delete board.dataset.pendingSave
      void saveTicketOrder(board)
    }
  }
}

function setupTicketBoard(): void {
  const board = document.querySelector<HTMLElement>('[data-ticket-board]')
  if (!board) return

  board.querySelectorAll<HTMLElement>('[data-lane-list]').forEach((list) => {
    Sortable.create(list, {
      group: 'personal-tickets',
      animation: 150,
      handle: '.drag-handle',
      draggable: '.ticket-card',
      ghostClass: 'ticket-ghost',
      chosenClass: 'ticket-chosen',
      dragClass: 'ticket-drag',
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onEnd: () => void saveTicketOrder(board),
    })
  })
}

function dashboardWidgetIds(grid: HTMLElement): number[] {
  return Array.from(grid.querySelectorAll<HTMLElement>(':scope > [data-dashboard-widget-id]'))
    .map((widget) => Number.parseInt(widget.dataset.dashboardWidgetId ?? '', 10))
    .filter(Number.isSafeInteger)
}

function setDashboardStatus(message: string): void {
  const status = document.querySelector<HTMLElement>('[data-dashboard-save-status]')
  if (status) status.textContent = message
}

async function saveDashboardOrder(grid: HTMLElement): Promise<void> {
  if (grid.dataset.saving === 'true') {
    grid.dataset.pendingSave = 'true'
    return
  }

  grid.dataset.saving = 'true'
  grid.classList.add('is-saving')
  grid.setAttribute('aria-busy', 'true')
  setDashboardStatus('순서 저장 중…')
  let failed = false

  try {
    const response = await fetch('/api/dashboard/widgets/order', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken(),
      },
      body: JSON.stringify({ widgetIds: dashboardWidgetIds(grid) }),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? '위젯 순서를 저장하지 못했습니다.')
    }
    setDashboardStatus('순서를 저장했습니다.')
  } catch (error) {
    failed = true
    window.alert(error instanceof Error ? error.message : '위젯 순서를 저장하지 못했습니다.')
    window.location.reload()
  } finally {
    delete grid.dataset.saving
    grid.classList.remove('is-saving')
    grid.removeAttribute('aria-busy')

    if (!failed && grid.dataset.pendingSave === 'true') {
      delete grid.dataset.pendingSave
      void saveDashboardOrder(grid)
    }
  }
}

function moveDashboardWidget(grid: HTMLElement, widget: HTMLElement, direction: -1 | 1): void {
  const widgets = Array.from(grid.querySelectorAll<HTMLElement>(':scope > [data-dashboard-widget-id]'))
  const index = widgets.indexOf(widget)
  const sibling = widgets[index + direction]
  if (index < 0 || !sibling) return

  if (direction === -1) grid.insertBefore(widget, sibling)
  else grid.insertBefore(sibling, widget)

  void saveDashboardOrder(grid)
}

function setupDashboardEditing(): void {
  const grid = document.querySelector<HTMLElement>('[data-dashboard]')
  const toggle = document.querySelector<HTMLButtonElement>('[data-dashboard-edit-toggle]')
  if (!grid || !toggle) return

  const sortable = Sortable.create(grid, {
    animation: 150,
    handle: '.dashboard-drag-handle',
    draggable: '.dashboard-widget',
    ghostClass: 'dashboard-widget-ghost',
    chosenClass: 'dashboard-widget-chosen',
    dragClass: 'dashboard-widget-drag',
    fallbackOnBody: true,
    swapThreshold: 0.65,
    disabled: true,
    onEnd: (event) => {
      const addSlot = grid.querySelector<HTMLElement>('[data-dashboard-add-slot]')
      if (addSlot) grid.insertBefore(addSlot, null)
      if (event.oldIndex !== event.newIndex) void saveDashboardOrder(grid)
    },
  })

  toggle.addEventListener('click', () => {
    const editing = !grid.classList.contains('is-editing')
    grid.classList.toggle('is-editing', editing)
    sortable.option('disabled', !editing)
    toggle.setAttribute('aria-pressed', String(editing))
    toggle.textContent = editing ? '편집 완료' : '대시보드 편집'
    setDashboardStatus(editing ? '끌거나 화살표 버튼으로 순서를 변경하세요.' : '')
  })

  grid.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element) || !grid.classList.contains('is-editing')) return
    const button = target.closest<HTMLButtonElement>('[data-dashboard-move]')
    const widget = button?.closest<HTMLElement>('[data-dashboard-widget-id]')
    if (!button || !widget) return

    const direction = button.dataset.dashboardMove === '-1' ? -1 : 1
    moveDashboardWidget(grid, widget, direction)
  })

  grid.addEventListener('keydown', (event) => {
    if (!grid.classList.contains('is-editing') || !event.altKey) return
    const target = event.target
    if (!(target instanceof Element)) return
    const widget = target.closest<HTMLElement>('[data-dashboard-widget-id]')
    if (!widget) return

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveDashboardWidget(grid, widget, -1)
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      moveDashboardWidget(grid, widget, 1)
    }
  })
}

function initialize(): void {
  setupMenu()
  setupDialogs()
  setupTicketEditing()
  setupConfirmations()
  setupNotices()
  setupTicketBoard()
  setupDashboardEditing()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true })
} else {
  initialize()
}
