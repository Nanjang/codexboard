import Sortable from 'sortablejs'
import {
  devlogImageValidationError,
  localImageValidationError,
  normalizedDevlogImageSource,
} from '../shared/images'

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
  const protectedFormSelector = 'form[method="post"], form[data-prevent-double-submit]'

  const resetForms = (): void => {
    document.querySelectorAll<HTMLFormElement>(protectedFormSelector).forEach((form) => {
      delete form.dataset.submitting
      form.removeAttribute('aria-busy')
      form.querySelectorAll<HTMLInputElement>('[data-submit-value-proxy]').forEach((control) => {
        control.remove()
      })
      form.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[type="submit"]').forEach((control) => {
        control.disabled = false
      })
    })
  }

  resetForms()
  window.addEventListener('pageshow', resetForms)
  document.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || !form.matches(protectedFormSelector)) return
    if (event.defaultPrevented || form.dataset.submitting === 'true') {
      event.preventDefault()
      return
    }

    const submitter = event instanceof SubmitEvent ? event.submitter : null
    if (
      (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement)
      && submitter.name
    ) {
      const proxy = document.createElement('input')
      proxy.type = 'hidden'
      proxy.name = submitter.name
      proxy.value = submitter.value
      proxy.dataset.submitValueProxy = 'true'
      form.appendChild(proxy)
    }

    form.dataset.submitting = 'true'
    form.setAttribute('aria-busy', 'true')
    form.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[type="submit"]').forEach((control) => {
      control.disabled = true
    })
  })
}

interface DevlogImageUpload {
  url: string
  hash: string
  width: number | null
  height: number | null
}

function setupDevlogEditor(): void {
  const form = document.querySelector<HTMLFormElement>('[data-devlog-editor-form]')
  const editor = form?.querySelector<HTMLElement>('[data-devlog-editor]')
  const value = form?.querySelector<HTMLTextAreaElement>('[data-devlog-editor-value]')
  const status = form?.querySelector<HTMLElement>('[data-editor-status]')
  const count = form?.querySelector<HTMLElement>('[data-editor-count]')
  const imageButton = form?.querySelector<HTMLButtonElement>('[data-editor-image]')
  const imageInput = form?.querySelector<HTMLInputElement>('[data-editor-image-input]')
  const previewImageReset = form?.querySelector<HTMLButtonElement>('[data-preview-image-reset]')
  if (!form || !editor || !value) return

  let savedRange: Range | null = null
  let imageUploadInProgress = false
  const imageUploadEnabled = imageInput?.disabled === false
  const fixedPreviewImage = previewImageReset
    ? normalizedDevlogImageSource(
        previewImageReset.dataset.fixedPreviewImage ?? '',
        window.location.href,
      )
    : null
  const updatePreviewImageResetVisibility = (): void => {
    if (!previewImageReset) return
    const firstImageSource = editor.querySelector<HTMLImageElement>('img[src]')?.getAttribute('src')
    const currentFirstImage = firstImageSource
      ? normalizedDevlogImageSource(firstImageSource, window.location.href)
      : null
    previewImageReset.hidden = !(
      fixedPreviewImage
      && currentFirstImage
      && fixedPreviewImage !== currentFirstImage
    )
  }
  const sync = (): void => {
    value.value = editor.innerHTML
    if (count) count.textContent = `${value.value.length.toLocaleString()} / 20,000`
    updatePreviewImageResetVisibility()
  }
  const rememberRange = (): void => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editor.contains(selection.anchorNode)) {
      savedRange = selection.getRangeAt(0).cloneRange()
    }
  }
  const focusSavedRange = (): void => {
    editor.focus()
    if (!savedRange) return
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(savedRange)
  }
  const runCommand = (command: string, commandValue?: string): void => {
    focusSavedRange()
    document.execCommand(command, false, commandValue)
    rememberRange()
    sync()
  }
  const uploadAndInsertImage = async (
    file: File,
    insertionRange: Range | null,
    source: 'file' | 'clipboard',
  ): Promise<void> => {
    if (!imageInput || !imageUploadEnabled) {
      showToast('이미지 서비스가 비활성화되어 있습니다.', 'error')
      return
    }
    if (imageUploadInProgress) {
      showToast('이미지 업로드가 끝난 뒤 다시 시도해 주세요.', 'error')
      return
    }
    const validationError = devlogImageValidationError(file, source)
    if (validationError) {
      showToast(validationError, 'error')
      return
    }

    imageUploadInProgress = true
    if (status) status.textContent = '이미지를 업로드하고 있습니다…'
    if (imageButton) imageButton.disabled = true
    imageInput.disabled = true
    editor.setAttribute('aria-busy', 'true')
    try {
      const response = await fetch('/api/devlog/images', {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
          'X-CSRF-Token': csrfToken(),
        },
        body: file,
      })
      if (!response.ok) throw await jsonError(response, '이미지를 업로드하지 못했습니다.')
      const uploaded = (await response.json()) as DevlogImageUpload
      const imageSource = normalizedDevlogImageSource(uploaded.url, window.location.href)
      if (!imageSource) throw new Error('이미지 URL이 올바르지 않습니다.')

      const figure = document.createElement('figure')
      figure.className = 'devlog-image'
      const image = document.createElement('img')
      image.setAttribute('src', imageSource)
      image.alt = file.name.replace(/\.[^.]+$/u, '').slice(0, 300)
      image.loading = 'lazy'
      image.decoding = 'async'
      const caption = document.createElement('figcaption')
      figure.appendChild(image)
      figure.appendChild(caption)

      savedRange = insertionRange
      focusSavedRange()
      const selection = window.getSelection()
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null
      if (range && editor.contains(range.commonAncestorContainer)) {
        range.deleteContents()
        range.insertNode(figure)
        range.setStartAfter(figure)
        range.collapse(true)
        selection?.removeAllRanges()
        selection?.addRange(range)
      } else {
        editor.appendChild(figure)
      }
      const paragraph = document.createElement('p')
      paragraph.appendChild(document.createElement('br'))
      figure.parentNode?.insertBefore(paragraph, figure.nextSibling)
      savedRange = document.createRange()
      savedRange.setStart(paragraph, 0)
      savedRange.collapse(true)
      focusSavedRange()
      sync()
      if (status) status.textContent = '이미지를 커서 위치에 삽입했습니다.'
    } catch (error) {
      showToast(error instanceof Error ? error.message : '이미지를 업로드하지 못했습니다.', 'error')
      if (status) status.textContent = '이미지 업로드에 실패했습니다.'
    } finally {
      if (imageButton) imageButton.disabled = false
      imageInput.disabled = false
      editor.removeAttribute('aria-busy')
      imageUploadInProgress = false
    }
  }

  editor.addEventListener('input', sync)
  editor.addEventListener('keyup', rememberRange)
  editor.addEventListener('mouseup', rememberRange)
  editor.addEventListener('focus', rememberRange)
  new MutationObserver(updatePreviewImageResetVisibility).observe(editor, {
    attributes: true,
    attributeFilter: ['src'],
    childList: true,
    subtree: true,
  })
  editor.addEventListener('paste', (event) => {
    const imageItem = Array.from(event.clipboardData?.items ?? []).find(
      (item) => item.kind === 'file' && item.type.toLowerCase().startsWith('image/'),
    )
    if (!imageItem) return

    event.preventDefault()
    rememberRange()
    const file = imageItem.getAsFile()
    if (!file) {
      showToast('클립보드 이미지를 읽지 못했습니다.', 'error')
      return
    }
    const insertionRange = savedRange?.cloneRange() ?? null
    void uploadAndInsertImage(file, insertionRange, 'clipboard')
  })

  form.querySelectorAll<HTMLButtonElement>('[data-editor-command]').forEach((button) => {
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => runCommand(button.dataset.editorCommand ?? ''))
  })
  form.querySelectorAll<HTMLButtonElement>('[data-editor-format]').forEach((button) => {
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => runCommand('formatBlock', button.dataset.editorFormat ?? 'p'))
  })
  form.querySelector<HTMLButtonElement>('[data-editor-link]')?.addEventListener('click', () => {
    const href = window.prompt('연결할 HTTPS 주소를 입력하세요.')
    if (!href) return
    try {
      const url = new URL(href)
      if (url.protocol !== 'https:') throw new Error('HTTPS required')
      runCommand('createLink', url.toString())
    } catch {
      showToast('HTTPS 링크만 삽입할 수 있습니다.', 'error')
    }
  })

  imageButton?.addEventListener('mousedown', () => rememberRange())
  imageButton?.addEventListener('click', () => imageInput?.click())
  imageInput?.addEventListener('change', async () => {
    const file = imageInput.files?.[0]
    imageInput.value = ''
    if (!file) return
    const insertionRange = savedRange?.cloneRange() ?? null
    await uploadAndInsertImage(file, insertionRange, 'file')
  })

  form.addEventListener('submit', (event) => {
    if (imageUploadInProgress) {
      event.preventDefault()
      showToast('이미지 업로드가 끝난 뒤 글을 저장해 주세요.', 'error')
      return
    }
    sync()
    if (value.value.length > 20_000) {
      event.preventDefault()
      showToast('본문은 HTML 포함 20,000자 이하여야 합니다.', 'error')
      editor.focus()
    }
  })
  sync()
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

function setupBookmarkIconLookup(): void {
  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest<HTMLButtonElement>('[data-bookmark-icon-lookup]')
    const form = button?.closest<HTMLFormElement>('form')
    if (!button || !form) return

    const bookmarkUrlInput = form.querySelector<HTMLInputElement>('input[name="url"]')
    const iconUrlInput = form.querySelector<HTMLInputElement>('input[name="iconUrl"]')
    const iconUrlMode = form.querySelector<HTMLInputElement>(
      'input[name="iconMode"][value="url"]',
    )
    const status = form.querySelector<HTMLElement>('[data-bookmark-icon-lookup-status]')
    if (!bookmarkUrlInput || !iconUrlInput || !iconUrlMode || !status) return

    if (!bookmarkUrlInput.reportValidity()) return
    button.disabled = true
    button.setAttribute('aria-busy', 'true')
    status.classList.remove('is-error')
    status.textContent = '사이트 아이콘을 찾는 중…'

    void (async () => {
      try {
        const params = new URLSearchParams({ url: bookmarkUrlInput.value })
        const response = await fetch(`/api/dashboard/bookmark-icon-url?${params.toString()}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) {
          throw await jsonError(response, '아이콘 URL을 자동으로 찾지 못했습니다.')
        }

        const payload = (await response.json()) as { iconUrl?: string }
        if (!payload.iconUrl) throw new Error('아이콘 URL 응답이 올바르지 않습니다.')
        iconUrlInput.value = payload.iconUrl
        iconUrlMode.checked = true
        iconUrlMode.dispatchEvent(new Event('change', { bubbles: true }))
        status.textContent = '아이콘 URL을 찾았습니다. 저장하면 이 아이콘을 사용합니다.'
      } catch (error) {
        status.classList.add('is-error')
        status.textContent =
          error instanceof Error ? error.message : '아이콘 URL을 자동으로 찾지 못했습니다.'
      } finally {
        button.disabled = false
        button.removeAttribute('aria-busy')
      }
    })()
  })
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
  setupDevlogEditor()
  setupDoubleSubmitPrevention()
  setupNotices()
  setupBookmarkIconLookup()
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
