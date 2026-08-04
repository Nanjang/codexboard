import Sortable from 'sortablejs'
import { strToU8, Zip, ZipDeflate, ZipPassThrough } from 'fflate'
import {
  devlogMarkdownDocument,
  devlogMarkdownFilename,
  devlogMarkdownImages,
  type DevlogMarkdownSource,
} from '../lib/devlog-markdown'
import {
  devlogImageValidationError,
  isDevlogImagePath,
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
    const tagInput = editForm.elements.namedItem('tag_ids')
    const tagIds = (card.dataset.ticketTagIds ?? '').split(',').filter(Boolean)
    if (titleInput instanceof HTMLInputElement) titleInput.value = title
    if (noteInput instanceof HTMLTextAreaElement) noteInput.value = note
    if (laneInput instanceof HTMLSelectElement) laneInput.value = lane
    if (tagInput instanceof HTMLSelectElement && tagInput.multiple) {
      Array.from(tagInput.options).forEach((option) => {
        option.selected = tagIds.includes(option.value)
      })
    }

    openDialog(dialog)
  })
}

function setupTicketCreateDropZones(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#ticket-create-dialog')
  const form = dialog?.querySelector<HTMLFormElement>('form')
  const laneInput = form?.elements.namedItem('lane')
  if (!dialog || !form || !(laneInput instanceof HTMLSelectElement)) return

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const zone = target.closest<HTMLButtonElement>('[data-ticket-drop-zone]')
    if (!zone) return

    const lane = zone.dataset.ticketCreateLane
    if (lane !== 'todo' && lane !== 'doing' && lane !== 'done') return
    event.preventDefault()
    form.reset()
    laneInput.value = lane
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

function setupRichEditor(): void {
  const form = document.querySelector<HTMLFormElement>(
    '[data-rich-editor-form], [data-devlog-editor-form]',
  )
  const editor = form?.querySelector<HTMLElement>('[data-rich-editor], [data-devlog-editor]')
  const value = form?.querySelector<HTMLTextAreaElement>('[data-devlog-editor-value]')
  const status = form?.querySelector<HTMLElement>('[data-editor-status]')
  const count = form?.querySelector<HTMLElement>('[data-editor-count]')
  const imageButton = form?.querySelector<HTMLButtonElement>('[data-editor-image]')
  const imageInput = form?.querySelector<HTMLInputElement>('[data-editor-image-input]')
  const previewImageReset = form?.querySelector<HTMLButtonElement>('[data-preview-image-reset]')
  if (!form || !editor || !value) return

  const imageUploadUrl = form.dataset.imageUploadUrl || '/api/devlog/images'
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
    const validationError =
      source === 'clipboard' || imageUploadUrl === '/api/devlog/images'
        ? devlogImageValidationError(file, source)
        : localImageValidationError(file)
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
      const response = await fetch(imageUploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
          'X-CSRF-Token': csrfToken(),
          'X-File-Name': encodeURIComponent(file.name),
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

async function jsonError(response: Response, fallback: string): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(payload?.error ?? fallback)
}

interface DevlogExportPageResponse {
  posts: DevlogMarkdownSource[]
  nextAfter: number | null
}

interface DevlogArchiveImage {
  source: string
  filename: string
}

const DEVLOG_EXPORT_IMAGE_CONCURRENCY = 3

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function setupDevlogExport(): void {
  const root = document.querySelector<HTMLElement>('[data-devlog-export]')
  const status = root?.querySelector<HTMLElement>('[data-export-status]')
  const count = root?.querySelector<HTMLElement>('[data-export-count]')
  const detail = root?.querySelector<HTMLElement>('[data-export-detail]')
  const progress = root?.querySelector<HTMLProgressElement>('[data-export-progress]')
  const retry = root?.querySelector<HTMLButtonElement>('[data-export-retry]')
  const download = root?.querySelector<HTMLAnchorElement>('[data-export-download]')
  if (!root || !status || !count || !detail || !progress || !retry || !download) return

  const authorId = root.dataset.authorId ?? ''
  const totalCount = Number.parseInt(root.dataset.totalCount ?? '', 10)
  const snapshotMaxId = Number.parseInt(root.dataset.snapshotMaxId ?? '', 10)
  const archiveFilename = root.dataset.archiveFilename ?? 'devlog-markdown.zip'
  if (
    !authorId
    || !Number.isSafeInteger(totalCount)
    || totalCount < 0
    || !Number.isSafeInteger(snapshotMaxId)
    || snapshotMaxId < 0
  ) {
    status.textContent = '내보내기 정보를 확인할 수 없습니다.'
    detail.textContent = '개발일지 화면으로 돌아가 다시 시도해 주세요.'
    return
  }

  let running = false
  let archiveUrl: string | null = null

  const clearArchiveUrl = (): void => {
    if (archiveUrl) URL.revokeObjectURL(archiveUrl)
    archiveUrl = null
    download.hidden = true
    download.removeAttribute('href')
  }
  window.addEventListener('pagehide', clearArchiveUrl, { once: true })

  const run = async (): Promise<void> => {
    if (running) return
    running = true
    clearArchiveUrl()
    retry.hidden = true
    retry.disabled = true
    progress.max = Math.max(totalCount, 1)
    progress.value = 0
    count.textContent = `0 / ${totalCount.toLocaleString()}`
    status.textContent = totalCount === 0
      ? '빈 ZIP 파일을 만들고 있습니다.'
      : '게시물을 가져와 압축하고 있습니다.'
    detail.textContent = '게시물 내용은 이 화면에 표시하지 않습니다.'
    root.setAttribute('aria-busy', 'true')

    let zip: Zip | null = null
    try {
      const chunks: ArrayBuffer[] = []
      let resolveArchive!: (blob: Blob) => void
      let rejectArchive!: (error: Error) => void
      const archiveReady = new Promise<Blob>((resolve, reject) => {
        resolveArchive = resolve
        rejectArchive = reject
      })
      zip = new Zip((error, chunk, final) => {
        if (error) {
          rejectArchive(error)
          return
        }
        if (chunk.length > 0) {
          const copy = Uint8Array.from(chunk)
          chunks.push(copy.buffer)
        }
        if (final) resolveArchive(new Blob(chunks, { type: 'application/zip' }))
      })
      const activeZip = zip

      let processed = 0
      let after: number | null = null
      const archiveImages = new Map<string, string>()
      while (processed < totalCount) {
        const params = new URLSearchParams({ maxId: String(snapshotMaxId) })
        if (after !== null) params.set('after', String(after))
        const response = await fetch(
          `/api/devlogs/u/${encodeURIComponent(authorId)}/export?${params.toString()}`,
          { credentials: 'same-origin', headers: { Accept: 'application/json' } },
        )
        if (!response.ok) throw await jsonError(response, '개발일지를 가져오지 못했습니다.')
        const page = (await response.json()) as DevlogExportPageResponse
        if (!Array.isArray(page.posts)) throw new Error('내보내기 응답 형식이 올바르지 않습니다.')

        for (const post of page.posts) {
          for (const image of devlogMarkdownImages(post)) {
            try {
              const source = new URL(image.source, window.location.href)
              if (
                source.origin === window.location.origin
                && isDevlogImagePath(source.pathname)
                && !archiveImages.has(image.filename)
              ) {
                archiveImages.set(image.filename, source.pathname)
              }
            } catch {
              // Ignore malformed legacy image sources while exporting the remaining post.
            }
          }
          const file = new ZipDeflate(devlogMarkdownFilename(post), { level: 6 })
          file.mtime = post.created_at
          zip.add(file)
          file.push(strToU8(devlogMarkdownDocument(post)), true)
          processed += 1
          progress.value = Math.min(processed, progress.max)
          count.textContent = `${processed.toLocaleString()} / ${totalCount.toLocaleString()}`
          if (processed % 10 === 0 || processed === totalCount) await nextPaint()
        }

        if (page.nextAfter === null) break
        if (
          !Number.isSafeInteger(page.nextAfter)
          || page.nextAfter <= (after ?? 0)
          || page.posts.length === 0
        ) {
          throw new Error('내보내기 페이지 커서가 올바르지 않습니다.')
        }
        after = page.nextAfter
      }

      const images: DevlogArchiveImage[] = Array.from(
        archiveImages,
        ([filename, source]) => ({ filename, source }),
      )
      let imageProcessed = 0
      if (images.length > 0) {
        status.textContent = '본문 이미지를 내려받고 있습니다.'
        progress.max = images.length
        progress.value = 0
        count.textContent = `0 / ${images.length.toLocaleString()}`
        detail.textContent = 'Worker 이미지 경로에서 파일을 받아 ZIP의 images/ 폴더에 저장합니다.'
        await nextPaint()

        let imageCursor = 0
        const abortImages = new AbortController()
        const addNextImage = async (): Promise<void> => {
          while (imageCursor < images.length) {
            const current = images[imageCursor]
            imageCursor += 1
            if (!current) return

            try {
              const response = await fetch(current.source, {
                credentials: 'same-origin',
                headers: { Accept: 'image/*' },
                signal: abortImages.signal,
              })
              if (!response.ok) {
                throw new Error(`본문 이미지를 내려받지 못했습니다. (${response.status})`)
              }
              const contentType = response.headers.get('Content-Type')?.split(';', 1)[0]?.trim()
              if (!contentType?.toLowerCase().startsWith('image/')) {
                throw new Error('본문 이미지 응답 형식이 올바르지 않습니다.')
              }
              const imageBytes = new Uint8Array(await response.arrayBuffer())
              if (imageBytes.length === 0) throw new Error('빈 본문 이미지가 반환되었습니다.')

              const imageFile = new ZipPassThrough(`images/${current.filename}`)
              activeZip.add(imageFile)
              imageFile.push(imageBytes, true)
              imageProcessed += 1
              progress.value = imageProcessed
              count.textContent = `${imageProcessed.toLocaleString()} / ${images.length.toLocaleString()}`
            } catch (error) {
              abortImages.abort()
              throw error
            }
          }
        }
        await Promise.all(
          Array.from(
            { length: Math.min(DEVLOG_EXPORT_IMAGE_CONCURRENCY, images.length) },
            () => addNextImage(),
          ),
        )
      }

      status.textContent = 'ZIP 파일을 마무리하고 있습니다.'
      await nextPaint()
      zip.end()
      const archive = await archiveReady
      archiveUrl = URL.createObjectURL(archive)
      download.href = archiveUrl
      download.download = archiveFilename
      download.hidden = false
      status.textContent = '내보내기가 완료되었습니다.'
      count.textContent = `${processed.toLocaleString()}개 문서 · ${imageProcessed.toLocaleString()}개 이미지`
      detail.textContent = 'ZIP 다운로드를 시작했습니다. 다시 받으려면 다운로드 버튼을 누르세요.'
      download.click()
    } catch (error) {
      zip?.terminate()
      status.textContent = '내보내기에 실패했습니다.'
      detail.textContent = error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.'
      retry.hidden = false
      retry.disabled = false
    } finally {
      running = false
      root.removeAttribute('aria-busy')
    }
  }

  retry.addEventListener('click', () => {
    void run()
  })
  void run()
}

function setupDevlogArchiveToggle(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-devlog-archive-toggle]')
  const panel = document.querySelector<HTMLElement>('[data-devlog-archive-panel]')
  const label = toggle?.querySelector<HTMLElement>('[data-devlog-archive-toggle-label]')
  if (!toggle || !panel) return
  const toggleLabel = toggle.dataset.toggleLabel ?? '내보내기 메뉴'

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true'
    toggle.setAttribute('aria-expanded', String(expanded))
    toggle.classList.toggle('is-active', expanded)
    panel.hidden = !expanded
    if (label) {
      label.textContent = `${toggleLabel} ${expanded ? '닫기' : '열기'}`
    }
  })
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

function syncBookmarkCompactMode(form: HTMLFormElement): void {
  const mode = form.querySelector<HTMLInputElement>('input[name="iconMode"]:checked')
  const iconUrl = form.querySelector<HTMLInputElement>('input[name="iconUrl"]')
  const compactMode = form.querySelector<HTMLInputElement>('[data-bookmark-compact-mode]')
  if (!mode || !iconUrl || !compactMode) return

  const enabled = mode.value === 'url' && iconUrl.value.trim().length > 0
  compactMode.disabled = !enabled
  if (!enabled) compactMode.checked = false
}

function setupBookmarkCompactMode(): void {
  document.querySelectorAll<HTMLFormElement>('.bookmark-dialog-content').forEach((form) => {
    syncBookmarkCompactMode(form)
    form.addEventListener('input', (event) => {
      const target = event.target
      if (target instanceof HTMLInputElement && target.name === 'iconUrl') {
        syncBookmarkCompactMode(form)
      }
    })
    form.addEventListener('change', (event) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement
        && (target.name === 'iconUrl' || target.name === 'iconMode')
      ) {
        syncBookmarkCompactMode(form)
      }
    })
  })
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
      input.disabled = true
      progress.hidden = false
      progressBar.value = 0
      progressLabel.textContent = '이미지를 저장하는 중…'

      try {
        const response = await fetch('/api/images', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': file.type,
            Accept: 'application/json',
            'X-CSRF-Token': csrfToken(),
            'X-File-Name': encodeURIComponent(file.name),
          },
          body: file,
        })
        if (!response.ok) throw await jsonError(response, '이미지를 업로드하지 못했습니다.')

        progressBar.value = 100
        showToast('이미지를 저장했습니다.')
        window.setTimeout(() => window.location.reload(), 450)
      } catch (error) {
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
    const toggleLabel = editing ? '대시보드 편집 완료' : '대시보드 편집'
    toggle.setAttribute('aria-label', toggleLabel)
    toggle.setAttribute('title', toggleLabel)
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

function personalBookmarkIds(list: HTMLElement): number[] {
  return Array.from(
    list.querySelectorAll<HTMLElement>(':scope > [data-personal-bookmark-id]'),
  )
    .map((item) => Number.parseInt(item.dataset.personalBookmarkId ?? '', 10))
    .filter(Number.isSafeInteger)
}

function setPersonalBookmarkStatus(message: string): void {
  const status = document.querySelector<HTMLElement>('[data-personal-bookmark-save-status]')
  if (status) status.textContent = message
}

async function savePersonalBookmarkOrder(root: HTMLElement, list: HTMLElement): Promise<void> {
  if (root.dataset.saving === 'true') {
    root.dataset.pendingSave = 'true'
    return
  }

  root.dataset.saving = 'true'
  root.classList.add('is-saving')
  root.setAttribute('aria-busy', 'true')
  setPersonalBookmarkStatus('순서 저장 중…')
  let failed = false

  try {
    const response = await fetch('/api/personal-bookmarks/order', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken(),
      },
      body: JSON.stringify({
        page: Number.parseInt(root.dataset.page ?? '1', 10),
        bookmarkIds: personalBookmarkIds(list),
      }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? '개인 북마크 순서를 저장하지 못했습니다.')
    }
    setPersonalBookmarkStatus('순서를 저장했습니다.')
  } catch (error) {
    failed = true
    window.alert(error instanceof Error ? error.message : '개인 북마크 순서를 저장하지 못했습니다.')
    window.location.reload()
  } finally {
    delete root.dataset.saving
    root.classList.remove('is-saving')
    root.removeAttribute('aria-busy')
    if (!failed && root.dataset.pendingSave === 'true') {
      delete root.dataset.pendingSave
      void savePersonalBookmarkOrder(root, list)
    }
  }
}

async function movePersonalBookmarkToPreviousPage(
  root: HTMLElement,
  bookmarkId: number,
): Promise<void> {
  root.classList.add('is-saving')
  root.setAttribute('aria-busy', 'true')
  setPersonalBookmarkStatus('앞 페이지로 이동 중…')
  try {
    const response = await fetch('/api/personal-bookmarks/previous-page', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken(),
      },
      body: JSON.stringify({
        page: Number.parseInt(root.dataset.page ?? '1', 10),
        bookmarkId,
      }),
    })
    const payload = (await response.json().catch(() => null)) as {
      error?: string
      page?: number
      bookmarkId?: number
    } | null
    if (!response.ok || !payload?.page || payload.bookmarkId !== bookmarkId) {
      throw new Error(payload?.error ?? '앞 페이지로 이동하지 못했습니다.')
    }
    window.location.assign(
      `/personal-bookmarks?page=${payload.page}#personal-bookmark-${bookmarkId}`,
    )
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '앞 페이지로 이동하지 못했습니다.')
    window.location.reload()
  }
}

function focusPersonalBookmarkFromHash(): void {
  const match = window.location.hash.match(/^#personal-bookmark-([1-9][0-9]*)$/u)
  if (!match) return
  const item = document.getElementById(`personal-bookmark-${match[1] ?? ''}`)
  if (!(item instanceof HTMLElement)) return
  item.focus({ preventScroll: true })
  item.scrollIntoView({ behavior: 'smooth', block: 'center' })
  item.classList.add('is-focused')
  window.setTimeout(() => item.classList.remove('is-focused'), 2400)
}

function setupPersonalBookmarks(): void {
  const root = document.querySelector<HTMLElement>('[data-personal-bookmarks]')
  const list = root?.querySelector<HTMLElement>('[data-personal-bookmark-list]')
  const toggle = document.querySelector<HTMLButtonElement>('[data-personal-bookmark-edit-toggle]')
  if (!root) return

  focusPersonalBookmarkFromHash()
  if (!list || !toggle) return

  const groupName = `personal-bookmarks-page-${root.dataset.page ?? '1'}`
  const sortable = Sortable.create(list, {
    group: { name: groupName, pull: true, put: true },
    animation: 150,
    handle: '.personal-bookmark-drag-handle',
    draggable: '[data-personal-bookmark-id]',
    ghostClass: 'personal-bookmark-ghost',
    chosenClass: 'personal-bookmark-chosen',
    dragClass: 'personal-bookmark-drag',
    fallbackOnBody: true,
    swapThreshold: 0.65,
    disabled: true,
    onEnd: (event) => {
      if (event.to === list && event.oldIndex !== event.newIndex) {
        void savePersonalBookmarkOrder(root, list)
      }
    },
  })

  const previousDrop = root.querySelector<HTMLElement>('[data-personal-bookmark-previous-drop]')
  const previousSortable = previousDrop
    ? Sortable.create(previousDrop, {
        group: { name: groupName, pull: false, put: true },
        draggable: '[data-personal-bookmark-id]',
        disabled: true,
        onAdd: (event) => {
          const item = event.item as HTMLElement
          const bookmarkId = Number.parseInt(item.dataset.personalBookmarkId ?? '', 10)
          if (Number.isSafeInteger(bookmarkId)) {
            void movePersonalBookmarkToPreviousPage(root, bookmarkId)
          } else {
            window.location.reload()
          }
        },
      })
    : null

  toggle.addEventListener('click', () => {
    const editing = !root.classList.contains('is-editing')
    root.classList.toggle('is-editing', editing)
    sortable.option('disabled', !editing)
    previousSortable?.option('disabled', !editing)
    toggle.setAttribute('aria-pressed', String(editing))
    toggle.textContent = editing ? '편집 완료' : '순서 편집'
    setPersonalBookmarkStatus(
      editing
        ? '핸들을 끌어 순서를 바꾸세요. 2페이지부터는 위 영역에 놓아 앞 페이지로 보낼 수 있습니다.'
        : '',
    )
  })

  list.addEventListener('keydown', (event) => {
    if (!root.classList.contains('is-editing') || !event.altKey) return
    const target = event.target
    if (!(target instanceof Element)) return
    const item = target.closest<HTMLElement>('[data-personal-bookmark-id]')
    if (!item) return

    if (event.key === 'PageUp' && previousDrop) {
      event.preventDefault()
      const bookmarkId = Number.parseInt(item.dataset.personalBookmarkId ?? '', 10)
      if (Number.isSafeInteger(bookmarkId)) {
        void movePersonalBookmarkToPreviousPage(root, bookmarkId)
      }
      return
    }

    const items = Array.from(
      list.querySelectorAll<HTMLElement>(':scope > [data-personal-bookmark-id]'),
    )
    const index = items.indexOf(item)
    const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    const sibling = direction === 0 ? undefined : items[index + direction]
    if (!sibling) return
    event.preventDefault()
    if (direction === -1) list.insertBefore(item, sibling)
    else list.insertBefore(sibling, item)
    item.querySelector<HTMLElement>('.personal-bookmark-drag-handle')?.focus()
    void savePersonalBookmarkOrder(root, list)
  })
}

function initialize(): void {
  setupMenu()
  setupDialogs()
  setupTicketEditing()
  setupTicketCreateDropZones()
  setupConfirmations()
  setupRichEditor()
  setupDevlogArchiveToggle()
  setupDevlogExport()
  setupDoubleSubmitPrevention()
  setupNotices()
  setupBookmarkIconLookup()
  setupBookmarkCompactMode()
  setupTicketBoard()
  setupDashboardEditing()
  setupPersonalBookmarks()
  setupImageUpload()
  setupImageCopies()
  setupValueCopies()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true })
} else {
  initialize()
}
