import Sortable from 'sortablejs'
import { localImageValidationError } from '../shared/images'

function showToast(message: string, tone: 'success' | 'error' = 'success'): void {
  const region = document.querySelector<HTMLElement>('[data-toast-region]')
  if (!region) return
  const toast = document.createElement('div')
  toast.className = `toast toast-${tone}`
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status')
  toast.textContent = message
  region.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('is-visible'))
  window.setTimeout(() => {
    toast.classList.remove('is-visible')
    window.setTimeout(() => toast.remove(), 180)
  }, 3600)
}

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

  document.querySelectorAll<HTMLDialogElement>('dialog[data-auto-dialog]').forEach((dialog) => {
    openDialog(dialog)
  })
}

function setupValueCopies(): void {
  document.addEventListener('click', async (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest<HTMLButtonElement>('[data-copy-value]')
    const value = button?.dataset.copyValue
    if (!button || !value) return

    try {
      await navigator.clipboard.writeText(value)
      showToast('공유 코드를 복사했습니다.')
    } catch {
      showToast('공유 코드를 복사하지 못했습니다.', 'error')
    }
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

function setupDoubleSubmitPrevention(): void {
  const resetForms = (): void => {
    document.querySelectorAll<HTMLFormElement>('form[data-prevent-double-submit]').forEach((form) => {
      delete form.dataset.submitting
      form.removeAttribute('aria-busy')
      form.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[type="submit"]').forEach((control) => {
        control.disabled = false
      })
    })
  }

  resetForms()
  window.addEventListener('pageshow', resetForms)
  document.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-prevent-double-submit')) return
    if (event.defaultPrevented || form.dataset.submitting === 'true') {
      event.preventDefault()
      return
    }

    form.dataset.submitting = 'true'
    form.setAttribute('aria-busy', 'true')
    form.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[type="submit"]').forEach((control) => {
      control.disabled = true
    })
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

interface ImageUploadTicket {
  imageId: number
  uploadUrl: string
  cacheUrl: string
  headers: Record<string, string>
}

async function jsonError(response: Response, fallback: string): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(payload?.error ?? fallback)
}

function uploadImageFile(
  ticket: ImageUploadTicket,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', ticket.uploadUrl)
    for (const [name, value] of Object.entries(ticket.headers)) request.setRequestHeader(name, value)
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error(`R2 업로드에 실패했습니다. (${request.status})`))
    })
    request.addEventListener('error', () => reject(new Error('R2 업로드 연결에 실패했습니다. CORS 설정을 확인하세요.')))
    request.addEventListener('abort', () => reject(new Error('이미지 업로드가 취소되었습니다.')))
    request.send(file)
  })
}

async function cancelPendingImage(imageId: number): Promise<void> {
  await fetch(`/api/images/${encodeURIComponent(imageId)}/pending`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken(),
    },
  }).catch(() => null)
}

function setupImageUpload(): void {
  const uploader = document.querySelector<HTMLElement>('[data-image-uploader]')
  const input = uploader?.querySelector<HTMLInputElement>('[data-image-file]')
  const progress = uploader?.querySelector<HTMLElement>('[data-image-progress]')
  const progressLabel = uploader?.querySelector<HTMLElement>('[data-image-progress-label]')
  const progressBar = uploader?.querySelector<HTMLProgressElement>('[data-image-progress-bar]')
  if (!uploader || !input || !progress || !progressLabel || !progressBar) return

  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return

    const validationError = localImageValidationError(file)
    if (validationError) {
      input.value = ''
      showToast(validationError, 'error')
      return
    }

    void (async () => {
      let imageId: number | null = null
      input.disabled = true
      progress.hidden = false
      progressBar.value = 0
      progressLabel.textContent = '업로드 주소를 준비하는 중…'

      try {
        const ticketResponse = await fetch('/api/images/upload-url', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-Token': csrfToken(),
          },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        })
        if (!ticketResponse.ok) throw await jsonError(ticketResponse, '이미지 업로드를 준비하지 못했습니다.')

        const ticket = (await ticketResponse.json()) as ImageUploadTicket
        imageId = ticket.imageId
        progressLabel.textContent = 'R2에 직접 업로드하는 중…'
        await uploadImageFile(ticket, file, (percent) => {
          progressBar.value = percent
          progressLabel.textContent = `R2에 직접 업로드하는 중… ${percent}%`
        })

        progressLabel.textContent = '업로드 결과를 확인하는 중…'
        const completeResponse = await fetch(`/api/images/${encodeURIComponent(ticket.imageId)}/complete`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'X-CSRF-Token': csrfToken(),
          },
        })
        if (!completeResponse.ok) throw await jsonError(completeResponse, '이미지 업로드를 완료하지 못했습니다.')

        imageId = null
        progressBar.value = 100
        showToast('이미지를 저장했습니다.')
        window.setTimeout(() => window.location.reload(), 450)
      } catch (error) {
        if (imageId !== null) await cancelPendingImage(imageId)
        showToast(error instanceof Error ? error.message : '이미지를 업로드하지 못했습니다.', 'error')
      } finally {
        input.disabled = false
        input.value = ''
        progress.hidden = true
      }
    })()
  })
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('클립보드에 복사하지 못했습니다.')
}

function setupImageCopies(): void {
  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest<HTMLButtonElement>('[data-image-copy]')
    const card = button?.closest<HTMLElement>('[data-image-id]')
    const imageId = card?.dataset.imageId
    const url = button?.dataset.copyUrl
    if (!button || !card || !imageId || !url) return

    void (async () => {
      button.disabled = true
      try {
        await copyText(url)
        card.querySelector<HTMLElement>('[data-image-copied-mark]')?.removeAttribute('hidden')
        const response = await fetch(`/api/images/${encodeURIComponent(imageId)}/copied`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'X-CSRF-Token': csrfToken(),
          },
        })
        if (!response.ok) throw await jsonError(response, '복사 이력을 저장하지 못했습니다.')
        showToast('캐시 URL을 복사했습니다.')
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'URL을 복사하지 못했습니다.', 'error')
      } finally {
        button.disabled = false
      }
    })()
  })
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

function dashboardWidgetIds(root: HTMLElement): number[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-dashboard-sortable]')).flatMap(
    (container) =>
      Array.from(
        container.querySelectorAll<HTMLElement>(':scope > [data-dashboard-widget-id]'),
      )
        .map((widget) => Number.parseInt(widget.dataset.dashboardWidgetId ?? '', 10))
        .filter(Number.isSafeInteger),
  )
}

function setDashboardStatus(message: string): void {
  const status = document.querySelector<HTMLElement>('[data-dashboard-save-status]')
  if (status) status.textContent = message
}

async function saveDashboardOrder(root: HTMLElement): Promise<void> {
  if (root.dataset.saving === 'true') {
    root.dataset.pendingSave = 'true'
    return
  }

  root.dataset.saving = 'true'
  root.classList.add('is-saving')
  root.setAttribute('aria-busy', 'true')
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
      body: JSON.stringify({ widgetIds: dashboardWidgetIds(root) }),
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
    delete root.dataset.saving
    root.classList.remove('is-saving')
    root.removeAttribute('aria-busy')

    if (!failed && root.dataset.pendingSave === 'true') {
      delete root.dataset.pendingSave
      void saveDashboardOrder(root)
    }
  }
}

function moveDashboardWidget(root: HTMLElement, widget: HTMLElement, direction: -1 | 1): void {
  const container = widget.closest<HTMLElement>('[data-dashboard-sortable]')
  if (!container) return

  const widgets = Array.from(
    container.querySelectorAll<HTMLElement>(':scope > [data-dashboard-widget-id]'),
  )
  const index = widgets.indexOf(widget)
  const sibling = widgets[index + direction]
  if (index < 0 || !sibling) return

  if (direction === -1) container.insertBefore(widget, sibling)
  else container.insertBefore(sibling, widget)

  void saveDashboardOrder(root)
}

function setupDashboardEditing(): void {
  const root = document.querySelector<HTMLElement>('[data-dashboard]')
  const toggle = document.querySelector<HTMLButtonElement>('[data-dashboard-edit-toggle]')
  if (!root || !toggle) return

  const sortables = Array.from(
    root.querySelectorAll<HTMLElement>('[data-dashboard-sortable]'),
  ).map((container) =>
    Sortable.create(container, {
      animation: 150,
      handle: '.dashboard-drag-handle',
      draggable: '[data-dashboard-widget-id]',
      ghostClass: 'dashboard-widget-ghost',
      chosenClass: 'dashboard-widget-chosen',
      dragClass: 'dashboard-widget-drag',
      fallbackOnBody: true,
      swapThreshold: 0.65,
      disabled: true,
      onEnd: (event) => {
        const addSlot = container.querySelector<HTMLElement>('[data-dashboard-add-slot]')
        if (addSlot) container.appendChild(addSlot)
        if (event.oldIndex !== event.newIndex) void saveDashboardOrder(root)
      },
    }),
  )

  toggle.addEventListener('click', () => {
    const editing = !root.classList.contains('is-editing')
    root.classList.toggle('is-editing', editing)
    sortables.forEach((sortable) => sortable.option('disabled', !editing))
    toggle.setAttribute('aria-pressed', String(editing))
    toggle.textContent = editing ? '편집 완료' : '대시보드 편집'
    setDashboardStatus(editing ? '같은 종류 안에서 끌거나 화살표로 순서를 바꾸세요.' : '')
  })

  root.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element) || !root.classList.contains('is-editing')) return
    const button = target.closest<HTMLButtonElement>('[data-dashboard-move]')
    const widget = button?.closest<HTMLElement>('[data-dashboard-widget-id]')
    if (!button || !widget) return

    const direction = button.dataset.dashboardMove === '-1' ? -1 : 1
    moveDashboardWidget(root, widget, direction)
  })

  root.addEventListener('keydown', (event) => {
    if (!root.classList.contains('is-editing') || !event.altKey) return
    const target = event.target
    if (!(target instanceof Element)) return
    const widget = target.closest<HTMLElement>('[data-dashboard-widget-id]')
    if (!widget) return

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveDashboardWidget(root, widget, -1)
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      moveDashboardWidget(root, widget, 1)
    }
  })
}

function initialize(): void {
  setupMenu()
  setupDialogs()
  setupTicketEditing()
  setupConfirmations()
  setupDoubleSubmitPrevention()
  setupNotices()
  setupTicketBoard()
  setupDashboardEditing()
  setupImageUpload()
  setupImageCopies()
  setupValueCopies()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true })
} else {
  initialize()
}
