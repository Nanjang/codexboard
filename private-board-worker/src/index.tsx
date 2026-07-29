import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import {
  clearOAuthTransaction,
  createOAuthTransaction,
  createSession,
  destroySession,
  exchangeGoogleCode,
  findOrCreateGoogleUser,
  loadAuthContext,
  readOAuthTransaction,
  verifyGoogleIdToken,
  verifyTurnstile,
} from './lib/auth'
import {
  addBookmarkDashboardWidget,
  addFreeBoardDashboardWidget,
  addRssDashboardWidget,
  canManageResource,
  createComment,
  createMemo,
  createMemoUrlPattern,
  createPendingPrivateImage,
  createPost,
  createTicket,
  deleteComment,
  deleteMemo,
  deleteMemoUrlPattern,
  deletePendingPrivateImage,
  deletePost,
  deleteTicket,
  getBoardBySlug,
  getComment,
  getDevlogAuthor,
  getImageServiceRecord,
  getImageServiceSettings,
  getMemoUrlPattern,
  getMemoUrlSettings,
  getPost,
  getPrivateImage,
  getTicket,
  incrementPostViewCount,
  ensureUserDashboard,
  isImageStorageEnabled,
  listDevlogAuthors,
  listDevlogPosts,
  listDashboardWidgets,
  listComments,
  listMemoUrlPatterns,
  listMemos,
  listPrivateImages,
  listPosts,
  listRecentPostsByBoardSlug,
  listTickets,
  listTrashedTickets,
  MAX_MEMO_PATTERNS_PER_USER,
  MAX_RSS_WIDGETS_PER_USER,
  moveTicket,
  permanentlyDeleteTicket,
  markPrivateImageCopied,
  markPrivateImageReady,
  reorderDashboardWidgets,
  reorderTickets,
  restoreTicket,
  removeDashboardWidget,
  saveBookmarkDashboardIcon,
  saveImageServiceSettings,
  setImageServiceEnabled,
  setImageStorageEnabled,
  updateComment,
  updateBookmarkDashboardWidget,
  updateMemoUrlPattern,
  upsertMemoUrlSettings,
  updatePost,
  updateTicket,
} from './lib/db'
import { safeEqual } from './lib/crypto'
import {
  bookmarkIconFallback,
  discoverBookmarkIconUrl,
  fetchBookmarkIconUrl,
  storedBookmarkIcon,
} from './lib/bookmark-icon'
import { normalizeBookmarkIconColor } from './lib/bookmark-icon-palette'
import { getAppName, getDeployInfo, turnstileEnabled } from './lib/env'
import { acceptsJson, noticeFromRequest, redirectWithNotice } from './lib/http'
import { postVisibility, sanitizeDevlogHtml } from './lib/devlog'
import { devlogMarkdownDocument, devlogMarkdownFilename } from './lib/devlog-markdown'
import { RequestProcessError, type RequestProcessDiagnostic } from './lib/request-diagnostics'
import {
  DEVLOG_IMAGE_CACHE_CONTROL,
  DEVLOG_IMAGE_HASH_PATTERN,
  DEVLOG_IMAGE_MAX_BYTES,
  ImageServiceVerificationError,
  devlogImagePublicUrl,
  imageServiceBindingConfigured,
  imageServiceCredentials,
  imageServiceFetch,
  imageUploadContentType,
  verifyImageService,
} from './lib/image-service'
import { decryptSecret, encryptSecret } from './lib/secret-box'
import { creationRequestId } from './lib/idempotency'
import {
  createImageUploadUrl,
  IMAGE_CACHE_CONTROL,
  imageContentType,
  imageObjectKey,
  imagePublicUrl,
  inspectUploadedImage,
  isR2ImageStorageConfigured,
  MAX_IMAGE_BYTES,
  R2ConfigurationError,
  removeR2Object,
} from './lib/r2'
import { loadRssFeed, RssFeedError } from './lib/rss'
import {
  acknowledgeThemeOrphanNotice,
  createOwnedTheme,
  deleteOwnedTheme,
  importSharedTheme,
  listThemeLibrary,
  normalizeThemeShareCode,
  publishOwnedTheme,
  resolveUserTheme,
  selectBuiltinTheme,
  selectOwnedTheme,
  selectSharedTheme,
  themeCss,
  themePaletteFromForm,
  updateOwnedTheme,
} from './lib/themes'
import {
  assertCsrf,
  assertSameOrigin,
  enforceAuthRateLimit,
  enforceWriteRateLimit,
  isPublicDevlogImagePath,
  isPublicPath,
  requireAuth,
  SameOriginError,
  securityMiddleware,
} from './lib/security'
import {
  boardSlug,
  bookmarkIconColor,
  bookmarkIconMode,
  bookmarkUrl,
  manualBookmarkIconUrl,
  multiline,
  nickname,
  optionalSingleLine,
  positiveInteger,
  rssUrl,
  singleLine,
  ticketLane,
  ticketCreationRequestId,
  validateMemoUrlTemplate,
  ValidationError,
} from './lib/validation'
import type {
  AppContext,
  AppEnv,
  AuthContext,
  BoardSlug,
  BookmarkIconColor,
  MemoUrlSettings,
  PostDetailRow,
  RssWidgetResult,
  TicketLane,
  TicketRow,
} from './types'
import { AdminPage } from './views/admin'
import { AccountPage } from './views/account'
import { BoardListPage, CommentEditPage, PostDetailPage, PostFormPage } from './views/boards'
import { DevlogDirectoryPage, DevlogPostPage, UserDevlogPage } from './views/devlogs'
import { DashboardPage } from './views/dashboard'
import { AppErrorPage, BlockedPage, PublicErrorPage, type AdminErrorDetail } from './views/errors'
import { GuestHomePage } from './views/home'
import { PrivacyPage, TermsPage } from './views/legal'
import { LoginPage } from './views/login'
import { PrivateImagesPage } from './views/images'
import { MemoBoardPage, MemoSettingsPage, type MemoPatternDraft } from './views/memos'
import { TicketFormPage, TicketsPage, TicketTrashPage } from './views/tickets'

const app = new Hono<AppEnv>()
const MAX_REQUEST_BYTES = 64 * 1024

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503

function viewMeta(c: AppContext) {
  return {
    appName: getAppName(c.env),
    deployInfo: getDeployInfo(c.env),
  }
}

function errorTitle(status: ErrorStatus): string {
  switch (status) {
    case 400:
      return '요청을 확인해 주세요'
    case 401:
      return '로그인이 필요합니다'
    case 403:
      return '접근할 수 없습니다'
    case 404:
      return '페이지를 찾을 수 없습니다'
    case 409:
      return '요청이 충돌했습니다'
    case 413:
      return '요청 내용이 너무 큽니다'
    case 429:
      return '요청이 너무 많습니다'
    case 500:
      return '서비스 오류가 발생했습니다'
    case 503:
      return '서비스 설정이 필요합니다'
  }
}

function normalizeStatus(value: number): ErrorStatus {
  if ([400, 401, 403, 404, 409, 413, 429, 503].includes(value)) return value as ErrorStatus
  return 500
}

function createIncidentCode(): string {
  return `PB-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`
}

function sameOriginAdminDetails(c: AppContext, error: unknown): AdminErrorDetail[] | undefined {
  if (c.get('auth')?.user.role !== 'admin' || !(error instanceof SameOriginError)) return undefined

  const stageLabels: Record<SameOriginError['details']['stage'], string> = {
    'request-url': '요청 URL Origin',
    'origin-header': 'Origin 헤더',
    'referer-header': 'Referer 헤더',
    'referer-invalid': 'Referer 형식',
  }
  const details = error.details

  return [
    { label: '실패한 검사', value: stageLabels[details.stage] },
    { label: '설정된 BASE_URL Origin', value: details.expectedOrigin },
    { label: '실제 요청 URL Origin', value: details.requestOrigin },
    { label: 'Origin 헤더', value: details.originHeader ?? '(없음)' },
    {
      label: 'Referer Origin',
      value: details.refererOrigin ?? (details.stage === 'referer-invalid' ? '(해석 실패)' : '(없음)'),
    },
    { label: '요청', value: `${details.method} ${details.path}` },
  ]
}

function imageServiceAdminDetails(c: AppContext, error: unknown): AdminErrorDetail[] | undefined {
  if (c.get('auth')?.user.role !== 'admin' || !(error instanceof ImageServiceVerificationError)) {
    return undefined
  }

  return error.diagnostics.map((detail, index) => ({
    label: `${index + 1}. ${detail.label}`,
    value: detail.value,
  }))
}

function requestProcessAdminDetails(c: AppContext, error: unknown): AdminErrorDetail[] | undefined {
  if (c.get('auth')?.user.role !== 'admin' || !(error instanceof RequestProcessError)) {
    return undefined
  }
  return error.diagnostics
}

function renderError(
  c: AppContext,
  status: ErrorStatus,
  message: string,
  incidentCode?: string,
  adminDetails?: AdminErrorDetail[],
): Response | Promise<Response> {
  const auth = c.get('auth')
  const meta = viewMeta(c)
  const view = auth ? (
    <AppErrorPage
      {...meta}
      title={errorTitle(status)}
      message={message}
      status={status}
      {...(incidentCode ? { incidentCode } : {})}
      {...(adminDetails ? { adminDetails } : {})}
      user={auth.user}
      csrfToken={auth.csrfToken}
    />
  ) : (
    <PublicErrorPage
      {...meta}
      title={errorTitle(status)}
      message={message}
      status={status}
      {...(incidentCode ? { incidentCode } : {})}
    />
  )
  return c.html(view, status as ContentfulStatusCode)
}

function requireActiveAuth(c: AppContext) {
  const auth = requireAuth(c)
  if (auth.user.status !== 'active') {
    throw new HTTPException(403, { message: '계정 이용이 제한되었습니다.' })
  }
  return auth
}

function requireAdminAuth(c: AppContext) {
  const auth = requireActiveAuth(c)
  if (auth.user.role !== 'admin') {
    throw new HTTPException(403, { message: '관리자만 접근할 수 있습니다.' })
  }
  return auth
}

function requireImageStorageAuth(c: AppContext) {
  const auth = requireActiveAuth(c)
  if (auth.user.imageStorageEnabled !== true) {
    throw new HTTPException(404, { message: '개인 이미지 저장 기능이 비활성화되어 있습니다.' })
  }
  return auth
}

async function renderAccountPage(
  c: AppContext,
  auth: AuthContext,
  options: {
    nicknameError?: string | null
    themeError?: string | null
    nicknameValue?: string
    status?: 200 | 400
  } = {},
) {
  const themeLibrary = await listThemeLibrary(c.env.DB, auth.user.id)
  return c.html(
    <AccountPage
      {...viewMeta(c)}
      user={options.nicknameValue ? { ...auth.user, nickname: options.nicknameValue } : auth.user}
      csrfToken={auth.csrfToken}
      notice={noticeFromRequest(c)}
      {...(options.nicknameError !== undefined ? { error: options.nicknameError } : {})}
      {...(options.themeError !== undefined ? { themeError: options.themeError } : {})}
      themeLibrary={themeLibrary}
    />,
    options.status ?? 200,
  )
}

async function readForm(c: AppContext): Promise<FormData> {
  const form = await c.req.formData()
  const token = form.get('_csrf')
  assertCsrf(c, typeof token === 'string' ? token : null)
  return form
}

function draftPost(
  boardId: number,
  boardName: string,
  boardSlugValue: BoardSlug,
  authorId: string,
  title: string,
  body: string,
  bodyFormat: 'plain' | 'rich' = 'plain',
  visibility: 'public' | 'private' = 'private',
): PostDetailRow {
  return {
    id: 0,
    board_id: boardId,
    board_slug: boardSlugValue,
    board_name: boardName,
    author_id: authorId,
    author_nickname: '',
    author_role: 'user',
    title,
    body,
    body_format: bodyFormat,
    visibility,
    comment_count: 0,
    view_count: 0,
    created_at: 0,
    updated_at: 0,
  }
}

function assertPostReadable(user: AuthContext['user'], post: PostDetailRow): void {
  if (
    post.board_slug === 'development' &&
    post.visibility !== 'public' &&
    !canManageResource(user, post.author_id)
  ) {
    throw new HTTPException(404, { message: '게시글을 찾을 수 없습니다.' })
  }
}

function draftTicket(ownerId: string, title: string, note: string, lane: TicketLane, id = 0): TicketRow {
  return {
    id,
    owner_id: ownerId,
    title,
    note,
    lane,
    sort_order: 0,
    created_at: 0,
    updated_at: 0,
    deleted_at: null,
    purge_after: null,
  }
}

function rawFormString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : ''
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  if (!response.body) return null
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      return null
    }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function selectedMemoPatternId(value: FormDataEntryValue | null): number | null {
  if (value === null || value === 'auto') return null
  if (typeof value !== 'string') throw new ValidationError('메모 패턴 형식이 올바르지 않습니다.')
  return positiveInteger(value, '메모 패턴 ID')
}

function rawMemoPatternDraft(form: FormData, id: number | null): MemoPatternDraft {
  return {
    id,
    name: rawFormString(form.get('name')),
    prefix: rawFormString(form.get('prefix')),
    suffix: rawFormString(form.get('suffix')),
  }
}

function validateMemoPatternDraft(draft: MemoPatternDraft): MemoPatternDraft {
  const normalized: MemoPatternDraft = {
    id: draft.id,
    name: singleLine(draft.name, '패턴 이름', 60),
    prefix: optionalSingleLine(draft.prefix, '패턴 앞 URL', 1000),
    suffix: optionalSingleLine(draft.suffix, '패턴 뒤 URL', 1000),
  }
  if (!normalized.prefix && !normalized.suffix) {
    throw new ValidationError('패턴의 앞 URL 또는 뒤 URL을 입력하세요.')
  }
  validateMemoUrlTemplate(normalized.prefix, normalized.suffix, normalized.name)
  return normalized
}

function memoPatternErrorMessage(error: unknown): string | null {
  if (error instanceof ValidationError) return error.message
  if (error instanceof Error && /UNIQUE|constraint/i.test(error.message)) {
    return '같은 이름의 패턴이 이미 있습니다.'
  }
  return null
}

const standardBodyLimit = bodyLimit({
  maxSize: MAX_REQUEST_BYTES,
  onError: (c) =>
    c.html(
      <PublicErrorPage
        {...viewMeta(c)}
        title="요청 내용이 너무 큽니다"
        message="한 번에 전송할 수 있는 내용의 크기를 초과했습니다."
        status={413}
      />,
      413,
    ),
})
const devlogImageBodyLimit = bodyLimit({
  maxSize: DEVLOG_IMAGE_MAX_BYTES,
  onError: (c) => c.json({ error: '이미지는 최대 10MiB까지 업로드할 수 있습니다.' }, 413),
})
app.use('*', async (c, next) => {
  if (c.req.path === '/api/devlog/images') return devlogImageBodyLimit(c, next)
  return standardBodyLimit(c, next)
})
app.use('*', securityMiddleware)

app.use('*', async (c, next) => {
  c.set('auth', null)

  if (!c.req.path.startsWith('/assets/') && !isPublicDevlogImagePath(c.req.path)) {
    const auth = await loadAuthContext(c)
    if (auth) {
      auth.user.imageStorageEnabled = await isImageStorageEnabled(c.env.DB)
    }
    c.set('auth', auth)
  }

  assertSameOrigin(c)

  if (!isPublicPath(c.req.path) && !c.get('auth')) {
    if (acceptsJson(c)) return c.json({ error: '로그인이 필요합니다.' }, 401)
    const returnTo = c.req.method === 'GET' ? c.req.path : ''
    const loginUrl = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'
    return c.redirect(loginUrl, 303)
  }

  const auth = c.get('auth')
  const blockedAllowed = c.req.path === '/account/blocked' || c.req.path === '/logout'
  if (auth?.user.status === 'blocked' && !isPublicPath(c.req.path) && !blockedAllowed) {
    if (acceptsJson(c)) return c.json({ error: '계정 이용이 제한되었습니다.' }, 403)
    return c.redirect('/account/blocked', 303)
  }

  const shouldConsumeThemeNotice =
    auth?.user.themeOrphanNoticePending === true &&
    c.req.method === 'GET' &&
    (c.req.path === '/' || !isPublicPath(c.req.path)) &&
    (c.req.header('Accept')?.includes('text/html') === true || c.req.header('Sec-Fetch-Dest') === 'document')
  if (shouldConsumeThemeNotice) {
    auth.user.themeOrphanNoticePending = await acknowledgeThemeOrphanNotice(c.env.DB, auth.user.id)
  }

  await next()
})

app.get('/assets/*', (c) => c.env.ASSETS.fetch(c.req.raw))
app.get('/health', (c) => c.json({ ok: true }))
app.on(['GET', 'HEAD'], '/devlog-images/i/:image', async (c) => {
  const filename = c.req.param('image')
  const match = /^([a-f0-9]{64})\.webp$/u.exec(filename)
  if (!match) return new Response(null, { status: 404 })

  const hash = match[1]!
  let upstream: Response
  try {
    const headers = new Headers({ Accept: 'image/webp' })
    const ifNoneMatch = c.req.header('If-None-Match')
    if (ifNoneMatch) headers.set('If-None-Match', ifNoneMatch)

    upstream = await imageServiceFetch(c.env, `/i/${hash}.webp`, {
      method: c.req.method,
      headers,
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return new Response(null, { status: 503 })
  }

  const responseHeaders = new Headers({
    'Cache-Control': upstream.headers.get('Cache-Control') ?? DEVLOG_IMAGE_CACHE_CONTROL,
    'Content-Type': upstream.headers.get('Content-Type') ?? 'image/webp',
    ETag: upstream.headers.get('ETag') ?? `"sha256-${hash}"`,
  })
  const contentLength = upstream.headers.get('Content-Length')
  if (contentLength) responseHeaders.set('Content-Length', contentLength)

  if (upstream.status === 304) {
    await upstream.body?.cancel()
    return new Response(null, { status: 304, headers: responseHeaders })
  }
  if (upstream.status === 404) {
    await upstream.body?.cancel()
    return new Response(null, { status: 404 })
  }
  if (!upstream.ok || !upstream.headers.get('Content-Type')?.toLowerCase().startsWith('image/webp')) {
    await upstream.body?.cancel()
    return new Response(null, { status: 503 })
  }

  if (c.req.method === 'HEAD') {
    await upstream.body?.cancel()
    return new Response(null, {
      status: upstream.status,
      headers: responseHeaders,
    })
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
})
app.get('/account/theme.css', async (c) => {
  const auth = requireActiveAuth(c)
  const palette = await resolveUserTheme(c.env.DB, auth.user.id)
  return c.body(themeCss(palette), 200, { 'Content-Type': 'text/css; charset=utf-8' })
})

app.get('/login', (c) => {
  const auth = c.get('auth')
  if (auth?.user.status === 'active') return c.redirect('/', 303)
  if (auth?.user.status === 'blocked') return c.redirect('/account/blocked', 303)

  const errorCode = c.req.query('error')
  const error =
    errorCode === 'not-allowed'
      ? '이 Google 계정은 서비스 이용 대상이 아닙니다.'
      : errorCode === 'oauth'
        ? 'Google 로그인을 완료하지 못했습니다. 다시 시도하세요.'
        : null

  return c.html(
    <LoginPage
      {...viewMeta(c)}
      error={error}
      {...(turnstileEnabled(c.env) && c.env.TURNSTILE_SITE_KEY
        ? { turnstileSiteKey: c.env.TURNSTILE_SITE_KEY }
        : {})}
    />,
  )
})

app.get('/privacy', (c) =>
  c.html(
    <PrivacyPage
      {...viewMeta(c)}
      {...(c.env.CONTACT_EMAIL?.trim() ? { contactEmail: c.env.CONTACT_EMAIL.trim() } : {})}
    />,
  ),
)
app.get('/terms', (c) =>
  c.html(
    <TermsPage
      {...viewMeta(c)}
      {...(c.env.CONTACT_EMAIL?.trim() ? { contactEmail: c.env.CONTACT_EMAIL.trim() } : {})}
    />,
  ),
)

app.post('/auth/google/start', async (c) => {
  await enforceAuthRateLimit(c)
  const form = await c.req.formData()
  const turnstileToken = form.get('cf-turnstile-response')
  const verified = await verifyTurnstile(c, typeof turnstileToken === 'string' ? turnstileToken : null)
  if (!verified) {
    return c.html(
      <LoginPage
        {...viewMeta(c)}
        error="자동화 방지 검증에 실패했습니다. 다시 시도하세요."
        {...(c.env.TURNSTILE_SITE_KEY ? { turnstileSiteKey: c.env.TURNSTILE_SITE_KEY } : {})}
      />,
      400,
    )
  }

  const { url } = await createOAuthTransaction(c)
  return c.redirect(url, 302)
})

app.get('/auth/google/callback', async (c) => {
  await enforceAuthRateLimit(c)
  const transaction = await readOAuthTransaction(c)
  clearOAuthTransaction(c)

  try {
    if (c.req.query('error')) throw new Error('Google 인증이 취소되었거나 거부되었습니다.')
    const state = c.req.query('state')
    const code = c.req.query('code')
    if (!transaction || !state || !code || !safeEqual(transaction.state, state)) {
      throw new Error('OAuth 로그인 상태 검증에 실패했습니다.')
    }

    const token = await exchangeGoogleCode(c.env, code, transaction.verifier)
    if (!token.id_token) throw new Error('Google ID 토큰이 없습니다.')
    const identity = await verifyGoogleIdToken(c.env, token.id_token, transaction.nonce)
    const user = await findOrCreateGoogleUser(c.env, identity)
    await createSession(c, user.id)

    return c.redirect(user.status === 'blocked' ? '/account/blocked' : '/', 303)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    console.error('Google OAuth callback failed', { reason: message.slice(0, 160) })
    const code = message.includes('허용 목록') ? 'not-allowed' : 'oauth'
    return c.redirect(`/login?error=${code}`, 303)
  }
})

app.post('/logout', async (c) => {
  await readForm(c)
  const auth = c.get('auth')
  await destroySession(c, auth)
  return c.redirect('/login', 303)
})

app.get('/account/blocked', (c) => {
  const auth = requireAuth(c)
  return c.html(<BlockedPage {...viewMeta(c)} user={auth.user} csrfToken={auth.csrfToken} />, 403)
})

app.get('/', async (c) => {
  const currentAuth = c.get('auth')
  if (!currentAuth) {
    const [freePosts, developmentPosts, newsPosts] = await Promise.all([
      listRecentPostsByBoardSlug(c.env.DB, 'free'),
      listRecentPostsByBoardSlug(c.env.DB, 'development'),
      listRecentPostsByBoardSlug(c.env.DB, 'news'),
    ])
    return c.html(
      <GuestHomePage
        {...viewMeta(c)}
        previews={[
          { slug: 'free', name: '자유게시판', posts: freePosts },
          { slug: 'development', name: '개발일지', posts: developmentPosts },
          { slug: 'news', name: '뉴스', posts: newsPosts },
        ]}
      />,
    )
  }
  if (currentAuth.user.status === 'blocked') return c.redirect('/account/blocked', 303)

  const auth = requireActiveAuth(c)
  await ensureUserDashboard(c.env.DB, auth.user.id)
  const widgets = await listDashboardWidgets(c.env.DB, auth.user.id)
  const freeBoardPosts = widgets.some((widget) => widget.widget_type === 'free-board')
    ? await listRecentPostsByBoardSlug(c.env.DB, 'free')
    : []
  const rssEntries = await Promise.all(
    widgets
      .filter((widget) => widget.widget_type === 'rss' && widget.url)
      .map(async (widget): Promise<[number, RssWidgetResult]> => {
        const feedUrl = widget.url
        if (!feedUrl) return [widget.id, { feed: null, error: 'RSS 주소가 없습니다.' }]
        try {
          const feed = await loadRssFeed(feedUrl, c.env.DB, c.executionCtx)
          return [widget.id, { feed, error: null }]
        } catch (error) {
          console.warn('RSS widget load failed', {
            widgetId: widget.id,
            message: error instanceof Error ? error.message.slice(0, 160) : 'unknown',
          })
          return [
            widget.id,
            {
              feed: null,
              error: error instanceof RssFeedError ? error.message : 'RSS를 불러오지 못했습니다.',
            },
          ]
        }
      }),
  )
  const rssResults: Record<number, RssWidgetResult> = Object.fromEntries(rssEntries)

  return c.html(
    <DashboardPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      notice={noticeFromRequest(c)}
      widgets={widgets}
      freeBoardPosts={freeBoardPosts}
      rssResults={rssResults}
      bookmarkCreationRequestId={crypto.randomUUID()}
    />,
  )
})

app.get('/dashboard/widgets/:id/icon', async (c) => {
  const auth = requireActiveAuth(c)
  const widgetId = positiveInteger(c.req.param('id'), '위젯 ID')
  const widget = await c.env.DB.prepare(
    `
    SELECT icon_url, icon_color, icon_content_type, icon_data
    FROM dashboard_widgets
    WHERE id = ?1 AND user_id = ?2 AND widget_type = 'bookmark'
    LIMIT 1
    `,
  )
    .bind(widgetId, auth.user.id)
    .first<{
      icon_url: string | null
      icon_color: string | null
      icon_content_type: string | null
      icon_data: number[] | null
    }>()

  return widget?.icon_url && widget.icon_content_type && widget.icon_data
    ? storedBookmarkIcon(widget.icon_data, widget.icon_content_type)
    : bookmarkIconFallback(normalizeBookmarkIconColor(widget?.icon_color))
})

app.get('/api/dashboard/bookmark-icon-url', async (c) => {
  requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'dashboard-bookmark-icon')
  const url = bookmarkUrl(c.req.query('url') ?? null)
  const iconUrl = await discoverBookmarkIconUrl(url)
  if (!iconUrl) {
    return c.json({ error: '이 사이트에서 사용할 수 있는 아이콘 URL을 찾지 못했습니다.' }, 404)
  }
  return c.json({ iconUrl })
})

async function bookmarkIconSelection(form: FormData): Promise<{
  iconUrl: string | null
  iconColor: BookmarkIconColor
  icon: Awaited<ReturnType<typeof fetchBookmarkIconUrl>>
}> {
  const mode = bookmarkIconMode(form.get('iconMode'))
  const iconColor = bookmarkIconColor(form.get('iconColor'))
  if (mode === 'default') return { iconUrl: null, iconColor, icon: null }

  const iconUrl = manualBookmarkIconUrl(form.get('iconUrl'))
  const icon = await fetchBookmarkIconUrl(iconUrl)
  if (!icon) {
    throw new ValidationError(
      '아이콘 URL에서 지원하는 이미지(PNG, JPG, WebP, GIF, ICO)를 가져오지 못했습니다.',
    )
  }
  return { iconUrl, iconColor, icon }
}

app.post('/dashboard/bookmarks', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'dashboard-bookmark')
  const form = await readForm(c)
  const title = singleLine(form.get('title'), '표시 이름', 60)
  const url = bookmarkUrl(form.get('url'))
  const requestId = creationRequestId(form.get('creation_request_id'))
  const { iconUrl, iconColor, icon } = await bookmarkIconSelection(form)
  const widgetId = await addBookmarkDashboardWidget(
    c.env.DB,
    auth.user.id,
    title,
    url,
    iconUrl,
    iconColor,
    requestId,
  )
  if (icon) {
    await saveBookmarkDashboardIcon(
      c.env.DB,
      auth.user.id,
      widgetId,
      icon.contentType,
      icon.bytes,
    )
  }

  return redirectWithNotice(c, '/', 'bookmark-added')
})

app.post('/dashboard/bookmarks/:id/update', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'dashboard-bookmark')
  const form = await readForm(c)
  const widgetId = positiveInteger(c.req.param('id'), '위젯 ID')
  const title = singleLine(form.get('title'), '표시 이름', 60)
  const url = bookmarkUrl(form.get('url'))
  const { iconUrl, iconColor, icon } = await bookmarkIconSelection(form)
  const updated = await updateBookmarkDashboardWidget(
    c.env.DB,
    auth.user.id,
    widgetId,
    title,
    url,
    iconUrl,
    iconColor,
  )
  if (!updated) throw new HTTPException(404, { message: '북마크를 찾을 수 없습니다.' })
  if (icon) {
    await saveBookmarkDashboardIcon(
      c.env.DB,
      auth.user.id,
      widgetId,
      icon.contentType,
      icon.bytes,
    )
  }

  return redirectWithNotice(c, '/', 'bookmark-updated')
})

app.post('/dashboard/widgets', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'dashboard-widget')
  const form = await readForm(c)
  const widgetType = form.get('widgetType')

  if (widgetType === 'free-board') {
    await addFreeBoardDashboardWidget(c.env.DB, auth.user.id)
  } else if (widgetType === 'rss') {
    const title = singleLine(form.get('title'), '표시 이름', 60)
    const url = rssUrl(form.get('url'))
    const existingWidgets = await listDashboardWidgets(c.env.DB, auth.user.id)
    if (
      existingWidgets.filter((widget) => widget.widget_type === 'rss').length >=
      MAX_RSS_WIDGETS_PER_USER
    ) {
      throw new ValidationError(`RSS 위젯은 최대 ${MAX_RSS_WIDGETS_PER_USER}개까지 추가할 수 있습니다.`)
    }
    try {
      await loadRssFeed(url, c.env.DB, c.executionCtx)
      await addRssDashboardWidget(c.env.DB, auth.user.id, title, url)
    } catch (error) {
      if (error instanceof RssFeedError) throw new ValidationError(error.message)
      if (error instanceof Error && error.message.startsWith('RSS 위젯은 최대')) {
        throw new ValidationError(error.message)
      }
      throw error
    }
  } else {
    throw new ValidationError('지원하지 않는 위젯입니다.')
  }

  return redirectWithNotice(c, '/', 'widget-added')
})

app.post('/dashboard/widgets/:id/delete', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'dashboard-widget')
  await readForm(c)
  const widgetId = positiveInteger(c.req.param('id'), '위젯 ID')
  await removeDashboardWidget(c.env.DB, auth.user.id, widgetId)
  return redirectWithNotice(c, '/', 'widget-removed')
})

app.put('/api/dashboard/widgets/order', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'dashboard-widget-order')
  assertCsrf(c, c.req.header('X-CSRF-Token'))

  const payload = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const value = payload?.widgetIds
  if (!Array.isArray(value)) throw new ValidationError('위젯 순서 데이터가 올바르지 않습니다.')

  const widgetIds = value.map((id) => {
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
      throw new ValidationError('위젯 ID가 올바르지 않습니다.')
    }
    return id
  })

  await reorderDashboardWidgets(c.env.DB, auth.user.id, widgetIds)
  return c.json({ ok: true })
})

app.get('/devlogs', async (c) => {
  const auth = c.get('auth')
  const authors = await listDevlogAuthors(c.env.DB)
  return c.html(
    <DevlogDirectoryPage
      {...viewMeta(c)}
      user={auth?.user}
      csrfToken={auth?.csrfToken}
      authors={authors}
    />,
  )
})

app.get('/devlogs/u/:authorId', async (c) => {
  const auth = c.get('auth')
  const authorId = c.req.param('authorId')
  const author = await getDevlogAuthor(c.env.DB, authorId)
  if (!author) throw new HTTPException(404, { message: '개발일지 사용자를 찾을 수 없습니다.' })
  const beforeRaw = c.req.query('before')
  const before = beforeRaw ? positiveInteger(beforeRaw, '페이지 기준 ID') : null
  const includePrivate = auth ? canManageResource(auth.user, author.id) : false
  const { posts, hasMore } = await listDevlogPosts(c.env.DB, author.id, includePrivate, before)
  return c.html(
    <UserDevlogPage
      {...viewMeta(c)}
      user={auth?.user}
      csrfToken={auth?.csrfToken}
      author={author}
      posts={posts}
      hasMore={hasMore}
    />,
  )
})

app.get('/devlogs/u/:authorId/posts/:postId', async (c) => {
  const auth = c.get('auth')
  const postId = positiveInteger(c.req.param('postId'), '게시글 ID')
  const post = await getPost(c.env.DB, postId)
  if (!post || post.board_slug !== 'development' || post.author_id !== c.req.param('authorId')) {
    throw new HTTPException(404, { message: '개발일지를 찾을 수 없습니다.' })
  }
  if (post.visibility !== 'public' && (!auth || !canManageResource(auth.user, post.author_id))) {
    throw new HTTPException(404, { message: '개발일지를 찾을 수 없습니다.' })
  }
  await incrementPostViewCount(c.env.DB, postId)
  return c.html(
    <DevlogPostPage
      {...viewMeta(c)}
      user={auth?.user}
      csrfToken={auth?.csrfToken}
      post={post}
    />,
  )
})

app.get('/devlogs/u/:authorId/posts/:postId/export.md', async (c) => {
  const auth = requireActiveAuth(c)
  const postId = positiveInteger(c.req.param('postId'), '게시글 ID')
  const post = await getPost(c.env.DB, postId)
  if (!post || post.board_slug !== 'development' || post.author_id !== c.req.param('authorId')) {
    throw new HTTPException(404, { message: '개발일지를 찾을 수 없습니다.' })
  }
  if (!canManageResource(auth.user, post.author_id)) {
    throw new HTTPException(403, { message: '내보내기 권한이 없습니다.' })
  }

  return new Response(devlogMarkdownDocument(post), {
    headers: {
      'Content-Disposition': `attachment; filename="${devlogMarkdownFilename(post)}"`,
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  })
})

app.get('/boards/development', (c) => c.redirect('/devlogs', 302))

app.get('/boards/:slug', async (c) => {
  const auth = requireActiveAuth(c)
  const slug = boardSlug(c.req.param('slug'))
  const board = await getBoardBySlug(c.env.DB, slug)
  if (!board) throw new HTTPException(404, { message: '게시판을 찾을 수 없습니다.' })

  const beforeRaw = c.req.query('before')
  const before = beforeRaw ? positiveInteger(beforeRaw, '페이지 기준 ID') : null
  const { posts, hasMore } = await listPosts(c.env.DB, board.id, before)
  return c.html(
    <BoardListPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      notice={noticeFromRequest(c)}
      board={board}
      posts={posts}
      hasMore={hasMore}
    />,
  )
})

app.get('/boards/:slug/new', async (c) => {
  const auth = requireActiveAuth(c)
  const slug = boardSlug(c.req.param('slug'))
  const board = await getBoardBySlug(c.env.DB, slug)
  if (!board) throw new HTTPException(404, { message: '게시판을 찾을 수 없습니다.' })
  const imageService = board.slug === 'development' ? await getImageServiceSettings(c.env.DB) : null
  return c.html(
    <PostFormPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      board={board}
      mode="create"
      imageServiceEnabled={imageService?.enabled === true && imageServiceBindingConfigured(c.env)}
    />,
  )
})

app.post('/boards/:slug/posts', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'post')
  const slug = boardSlug(c.req.param('slug'))
  const board = await getBoardBySlug(c.env.DB, slug)
  if (!board) throw new HTTPException(404, { message: '게시판을 찾을 수 없습니다.' })

  const form = await readForm(c)
  const rawTitle = typeof form.get('title') === 'string' ? String(form.get('title')) : ''
  const rawBody = typeof form.get('body') === 'string' ? String(form.get('body')) : ''
  const isDevlog = board.slug === 'development'
  let safeDraftBody = isDevlog ? '<p></p>' : rawBody
  let visibility: 'public' | 'private' = 'private'

  try {
    const title = singleLine(form.get('title'), '제목', 120)
    if (title.length < 2) throw new ValidationError('제목은 2자 이상이어야 합니다.')
    const body = isDevlog
      ? await sanitizeDevlogHtml(form.get('body'))
      : multiline(form.get('body'), '내용', 20000)
    safeDraftBody = body
    visibility = isDevlog ? postVisibility(form.get('visibility')) : 'private'
    const postId = await createPost(
      c.env.DB,
      board.id,
      auth.user.id,
      title,
      body,
      isDevlog ? 'rich' : 'plain',
      visibility,
    )
    const destination = isDevlog ? `/devlogs/u/${auth.user.id}/posts/${postId}` : `/posts/${postId}`
    return redirectWithNotice(c, destination, 'post-created')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    const imageService = isDevlog ? await getImageServiceSettings(c.env.DB) : null
    return c.html(
      <PostFormPage
        {...viewMeta(c)}
        user={auth.user}
        csrfToken={auth.csrfToken}
        board={board}
        mode="create"
        post={draftPost(
          board.id,
          board.name,
          board.slug,
          auth.user.id,
          rawTitle,
          safeDraftBody,
          isDevlog ? 'rich' : 'plain',
          visibility,
        )}
        imageServiceEnabled={imageService?.enabled === true && imageServiceBindingConfigured(c.env)}
        error={error.message}
      />,
      400,
    )
  }
})

app.get('/posts/:id', async (c) => {
  const auth = requireActiveAuth(c)
  const postId = positiveInteger(c.req.param('id'), '게시글 ID')
  const post = await getPost(c.env.DB, postId)
  if (!post) throw new HTTPException(404, { message: '게시글을 찾을 수 없습니다.' })
  if (post.board_slug === 'development') {
    return c.redirect(`/devlogs/u/${post.author_id}/posts/${post.id}`, 302)
  }
  await incrementPostViewCount(c.env.DB, postId)
  const comments = await listComments(c.env.DB, postId)
  return c.html(
    <PostDetailPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      notice={noticeFromRequest(c)}
      post={post}
      comments={comments}
    />,
  )
})

app.get('/posts/:id/edit', async (c) => {
  const auth = requireActiveAuth(c)
  const postId = positiveInteger(c.req.param('id'), '게시글 ID')
  const post = await getPost(c.env.DB, postId)
  if (!post) throw new HTTPException(404, { message: '게시글을 찾을 수 없습니다.' })
  if (!canManageResource(auth.user, post.author_id)) throw new HTTPException(403, { message: '수정 권한이 없습니다.' })
  const board = await getBoardBySlug(c.env.DB, boardSlug(post.board_slug))
  if (!board) throw new HTTPException(404, { message: '게시판을 찾을 수 없습니다.' })
  const imageService = board.slug === 'development' ? await getImageServiceSettings(c.env.DB) : null
  return c.html(
    <PostFormPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      board={board}
      mode="edit"
      post={post}
      imageServiceEnabled={imageService?.enabled === true && imageServiceBindingConfigured(c.env)}
    />,
  )
})

app.post('/posts/:id/update', async (c) => {
  const auth = requireActiveAuth(c)
  const diagnostics: RequestProcessDiagnostic[] = [
    { label: '1. 로그인 및 계정 확인', value: `성공 · ${auth.user.role} 계정` },
  ]
  let activeStep = '쓰기 요청 제한 확인'
  let activeStepStartedAt = Date.now()
  const completeStep = (label: string, value: string): void => {
    diagnostics.push({ label: `${diagnostics.length + 1}. ${label}`, value: `성공 · ${value}` })
  }

  try {
    await enforceWriteRateLimit(c, 'post')
    completeStep(activeStep, '통과')

    activeStep = '게시글 조회'
    activeStepStartedAt = Date.now()
    const postId = positiveInteger(c.req.param('id'), '게시글 ID')
    const post = await getPost(c.env.DB, postId)
    if (!post) throw new HTTPException(404, { message: '게시글을 찾을 수 없습니다.' })
    completeStep(activeStep, `게시글 ${postId}`)

    activeStep = '수정 권한 확인'
    activeStepStartedAt = Date.now()
    if (!canManageResource(auth.user, post.author_id)) {
      throw new HTTPException(403, { message: '수정 권한이 없습니다.' })
    }
    completeStep(activeStep, '통과')

    activeStep = '게시판 조회'
    activeStepStartedAt = Date.now()
    const board = await getBoardBySlug(c.env.DB, boardSlug(post.board_slug))
    if (!board) throw new HTTPException(404, { message: '게시판을 찾을 수 없습니다.' })
    completeStep(activeStep, board.slug)

    activeStep = '폼 및 CSRF 확인'
    activeStepStartedAt = Date.now()
    const form = await readForm(c)
    const rawTitle = typeof form.get('title') === 'string' ? String(form.get('title')) : ''
    const rawBody = typeof form.get('body') === 'string' ? String(form.get('body')) : ''
    const hasImage = /<img\b/iu.test(rawBody)
    completeStep(
      activeStep,
      `제목 ${rawTitle.length}자 · 본문 ${rawBody.length}자 · 이미지 ${hasImage ? '포함' : '없음'}`,
    )

    const isDevlog = board.slug === 'development'
    let safeDraftBody = isDevlog ? post.body : rawBody
    let visibility = post.visibility
    try {
      activeStep = isDevlog ? '이미지 포함 HTML 정제' : '본문 검증'
      activeStepStartedAt = Date.now()
      const title = singleLine(form.get('title'), '제목', 120)
      if (title.length < 2) throw new ValidationError('제목은 2자 이상이어야 합니다.')
      const body = isDevlog
        ? await sanitizeDevlogHtml(form.get('body'))
        : multiline(form.get('body'), '내용', 20000)
      safeDraftBody = body
      visibility = isDevlog ? postVisibility(form.get('visibility')) : 'private'
      completeStep(activeStep, `${body.length}자 · ${isDevlog ? 'rich HTML' : 'plain text'}`)

      activeStep = 'D1 게시글 저장'
      activeStepStartedAt = Date.now()
      const changed = await updatePost(c.env.DB, postId, title, body, isDevlog ? 'rich' : 'plain', visibility)
      if (!changed) throw new HTTPException(404, { message: '게시글을 찾을 수 없습니다.' })
      completeStep(activeStep, '변경사항 반영')

      activeStep = '이동 응답 생성'
      activeStepStartedAt = Date.now()
      const destination = isDevlog ? `/devlogs/u/${post.author_id}/posts/${postId}` : `/posts/${postId}`
      const response = redirectWithNotice(c, destination, 'post-updated')
      completeStep(activeStep, destination)
      return response
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error
      const imageService = isDevlog ? await getImageServiceSettings(c.env.DB) : null
      return c.html(
        <PostFormPage
          {...viewMeta(c)}
          user={auth.user}
          csrfToken={auth.csrfToken}
          board={board}
          mode="edit"
          post={{
            ...post,
            title: rawTitle,
            body: safeDraftBody,
            body_format: isDevlog ? 'rich' : 'plain',
            visibility,
          }}
          imageServiceEnabled={imageService?.enabled === true && imageServiceBindingConfigured(c.env)}
          error={error.message}
        />,
        400,
      )
    }
  } catch (error) {
    if (error instanceof HTTPException || error instanceof ValidationError || error instanceof RequestProcessError) {
      throw error
    }
    throw new RequestProcessError(diagnostics, activeStep, activeStepStartedAt, error)
  }
})

app.post('/posts/:id/delete', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'post')
  const postId = positiveInteger(c.req.param('id'), '게시글 ID')
  const post = await getPost(c.env.DB, postId)
  if (!post) throw new HTTPException(404, { message: '게시글을 찾을 수 없습니다.' })
  if (!canManageResource(auth.user, post.author_id)) throw new HTTPException(403, { message: '삭제 권한이 없습니다.' })
  await readForm(c)
  await deletePost(c.env.DB, postId)
  const destination = post.board_slug === 'development' ? `/devlogs/u/${post.author_id}` : `/boards/${post.board_slug}`
  return redirectWithNotice(c, destination, 'post-deleted')
})

app.post('/posts/:id/comments', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'comment')
  const postId = positiveInteger(c.req.param('id'), '게시글 ID')
  const post = await getPost(c.env.DB, postId)
  if (!post) throw new HTTPException(404, { message: '게시글을 찾을 수 없습니다.' })
  assertPostReadable(auth.user, post)
  const form = await readForm(c)
  const body = multiline(form.get('body'), '댓글', 4000)
  await createComment(c.env.DB, postId, auth.user.id, body)
  return redirectWithNotice(c, `/posts/${postId}`, 'comment-created')
})

app.get('/comments/:id/edit', async (c) => {
  const auth = requireActiveAuth(c)
  const commentId = positiveInteger(c.req.param('id'), '댓글 ID')
  const comment = await getComment(c.env.DB, commentId)
  if (!comment) throw new HTTPException(404, { message: '댓글을 찾을 수 없습니다.' })
  if (!canManageResource(auth.user, comment.author_id)) throw new HTTPException(403, { message: '수정 권한이 없습니다.' })
  const post = await getPost(c.env.DB, comment.post_id)
  if (!post) throw new HTTPException(404, { message: '게시글을 찾을 수 없습니다.' })
  assertPostReadable(auth.user, post)
  return c.html(
    <CommentEditPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      post={post}
      comment={comment}
    />,
  )
})

app.post('/comments/:id/update', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'comment')
  const commentId = positiveInteger(c.req.param('id'), '댓글 ID')
  const comment = await getComment(c.env.DB, commentId)
  if (!comment) throw new HTTPException(404, { message: '댓글을 찾을 수 없습니다.' })
  if (!canManageResource(auth.user, comment.author_id)) throw new HTTPException(403, { message: '수정 권한이 없습니다.' })
  const post = await getPost(c.env.DB, comment.post_id)
  if (!post) throw new HTTPException(404, { message: '게시글을 찾을 수 없습니다.' })
  assertPostReadable(auth.user, post)
  const form = await readForm(c)

  try {
    const body = multiline(form.get('body'), '댓글', 4000)
    await updateComment(c.env.DB, commentId, body)
    return redirectWithNotice(c, `/posts/${post.id}#comment-${commentId}`, 'comment-updated')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    const rawBody = typeof form.get('body') === 'string' ? String(form.get('body')) : ''
    return c.html(
      <CommentEditPage
        {...viewMeta(c)}
        user={auth.user}
        csrfToken={auth.csrfToken}
        post={post}
        comment={{ ...comment, body: rawBody }}
        error={error.message}
      />,
      400,
    )
  }
})

app.post('/comments/:id/delete', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'comment')
  const commentId = positiveInteger(c.req.param('id'), '댓글 ID')
  const comment = await getComment(c.env.DB, commentId)
  if (!comment) throw new HTTPException(404, { message: '댓글을 찾을 수 없습니다.' })
  if (!canManageResource(auth.user, comment.author_id)) throw new HTTPException(403, { message: '삭제 권한이 없습니다.' })
  await readForm(c)
  await deleteComment(c.env.DB, commentId, comment.post_id)
  return redirectWithNotice(c, `/posts/${comment.post_id}`, 'comment-deleted')
})

app.get('/admin', async (c) => {
  const auth = requireAdminAuth(c)
  const imageService = await getImageServiceSettings(c.env.DB)
  return c.html(
    <AdminPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      imageStorageEnabled={auth.user.imageStorageEnabled === true}
      r2Configured={isR2ImageStorageConfigured(c.env)}
      imageServiceBound={imageServiceBindingConfigured(c.env)}
      imageService={imageService}
      notice={noticeFromRequest(c)}
    />,
  )
})

app.post('/admin/image-service', async (c) => {
  const auth = requireAdminAuth(c)
  await enforceWriteRateLimit(c, 'admin-image-service')
  const form = await readForm(c)
  const rawToken = typeof form.get('token') === 'string' ? String(form.get('token')).trim() : ''
  const existing = await getImageServiceRecord(c.env.DB)

  let tokenCiphertext = existing?.token_ciphertext ?? ''
  if (rawToken) {
    if (new TextEncoder().encode(rawToken).byteLength < 32) {
      throw new ValidationError('업로드 토큰은 32자 이상 입력해 주세요.')
    }
    tokenCiphertext = await encryptSecret(rawToken, c.env.SESSION_SECRET)
  } else if (!existing) {
    throw new ValidationError('업로드 토큰을 입력해 주세요.')
  } else {
    await decryptSecret(tokenCiphertext, c.env.SESSION_SECRET)
  }

  try {
    await verifyImageService(c.env)
  } catch (error) {
    if (error instanceof ImageServiceVerificationError) {
      const tokenBytes = rawToken ? new TextEncoder().encode(rawToken).byteLength : null
      throw new ImageServiceVerificationError(error.message, [
        {
          label: '업로드 토큰 검증',
          value: tokenBytes === null ? '성공 · 기존 암호화 토큰 사용' : `성공 · ${tokenBytes}바이트 입력`,
        },
        ...error.diagnostics,
        { label: '설정 저장', value: '실행하지 않음 · 연결 확인 실패' },
      ])
    }
    throw error
  }
  await saveImageServiceSettings(c.env.DB, tokenCiphertext, auth.user.id)
  return redirectWithNotice(c, '/admin', 'image-service-saved')
})

app.post('/admin/image-service/toggle', async (c) => {
  const auth = requireAdminAuth(c)
  await enforceWriteRateLimit(c, 'admin-image-service')
  const form = await readForm(c)
  const rawEnabled = form.get('enabled')
  if (rawEnabled !== 'true' && rawEnabled !== 'false') {
    throw new ValidationError('기능 활성화 값이 올바르지 않습니다.')
  }
  const enabled = rawEnabled === 'true'
  if (enabled) await verifyImageService(c.env)
  const changed = await setImageServiceEnabled(c.env.DB, enabled, auth.user.id)
  if (!changed) throw new ValidationError('이미지 서비스를 먼저 등록해 주세요.')
  return redirectWithNotice(c, '/admin', enabled ? 'image-service-enabled' : 'image-service-disabled')
})

app.post('/admin/features/image-storage', async (c) => {
  const auth = requireAdminAuth(c)
  await enforceWriteRateLimit(c, 'admin-feature')
  const form = await readForm(c)
  const rawEnabled = form.get('enabled')
  if (rawEnabled !== 'true' && rawEnabled !== 'false') {
    throw new ValidationError('기능 활성화 값이 올바르지 않습니다.')
  }
  const enabled = rawEnabled === 'true'
  await setImageStorageEnabled(c.env.DB, enabled, auth.user.id)
  return redirectWithNotice(c, '/admin', enabled ? 'image-storage-enabled' : 'image-storage-disabled')
})

app.post('/api/devlog/images', async (c) => {
  requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'devlog-image-upload')
  assertCsrf(c, c.req.header('X-CSRF-Token'))

  const contentType = imageUploadContentType(c.req.header('Content-Type'))
  const contentLength = Number(c.req.header('Content-Length'))
  if (
    c.req.header('Content-Length') &&
    (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > DEVLOG_IMAGE_MAX_BYTES)
  ) {
    throw new ValidationError('이미지는 최대 10MiB까지 업로드할 수 있습니다.')
  }

  const { token } = await imageServiceCredentials(c.env)
  let upstream: Response
  try {
    upstream = await imageServiceFetch(c.env, '/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: c.req.raw.body,
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new HTTPException(503, { message: '이미지 서비스에 연결할 수 없습니다.' })
  }

  if (!upstream.ok) {
    await upstream.body?.cancel()
    throw new HTTPException(503, { message: '이미지 서비스가 업로드를 처리하지 못했습니다.' })
  }
  const upstreamLength = Number(upstream.headers.get('Content-Length'))
  if (Number.isFinite(upstreamLength) && upstreamLength > 32 * 1024) {
    await upstream.body?.cancel()
    throw new HTTPException(503, { message: '이미지 서비스 응답이 올바르지 않습니다.' })
  }

  const payload = (await readBoundedJson(upstream, 32 * 1024)) as Record<string, unknown> | null
  if (
    !payload ||
    typeof payload.hash !== 'string' ||
    !DEVLOG_IMAGE_HASH_PATTERN.test(payload.hash)
  ) {
    throw new HTTPException(503, { message: '이미지 서비스 응답이 올바르지 않습니다.' })
  }

  return c.json({
    url: devlogImagePublicUrl(c.req.url, payload.hash),
    hash: payload.hash,
    width: typeof payload.width === 'number' ? payload.width : null,
    height: typeof payload.height === 'number' ? payload.height : null,
  })
})

app.get('/images', async (c) => {
  const auth = requireImageStorageAuth(c)
  const images = await listPrivateImages(c.env.DB, auth.user.id)
  return c.html(
    <PrivateImagesPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      images={images.map((image) => ({ image, cacheUrl: imagePublicUrl(c.env, image.object_key) }))}
    />,
  )
})

app.post('/api/images/upload-url', async (c) => {
  const auth = requireImageStorageAuth(c)
  await enforceWriteRateLimit(c, 'image-upload')
  assertCsrf(c, c.req.header('X-CSRF-Token'))

  const payload = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!payload || typeof payload !== 'object') throw new ValidationError('이미지 업로드 정보가 올바르지 않습니다.')

  const originalName = singleLine(typeof payload.fileName === 'string' ? payload.fileName : null, '파일 이름', 180)
  const contentType = imageContentType(payload.contentType)
  if (!contentType) throw new ValidationError('JPEG, PNG, WebP, GIF, AVIF 이미지만 업로드할 수 있습니다.')
  const sizeBytes = payload.sizeBytes
  if (typeof sizeBytes !== 'number' || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1) {
    throw new ValidationError('이미지 파일 크기가 올바르지 않습니다.')
  }
  if (sizeBytes > MAX_IMAGE_BYTES) throw new ValidationError('이미지는 최대 5MiB까지 업로드할 수 있습니다.')

  const objectKey = imageObjectKey(contentType)
  const cacheUrl = imagePublicUrl(c.env, objectKey)
  if (!cacheUrl) {
    throw new HTTPException(503, { message: 'R2 업로드 설정이 필요합니다. 관리자에게 문의하세요.' })
  }

  try {
    const uploadUrl = await createImageUploadUrl(c.env, objectKey, contentType)
    const imageId = await createPendingPrivateImage(
      c.env.DB,
      auth.user.id,
      objectKey,
      originalName,
      contentType,
      sizeBytes,
    )
    return c.json({
      imageId,
      uploadUrl,
      cacheUrl,
      headers: {
        'Cache-Control': IMAGE_CACHE_CONTROL,
        'Content-Type': contentType,
      },
    })
  } catch (error) {
    if (error instanceof R2ConfigurationError) {
      throw new HTTPException(503, { message: error.message })
    }
    throw error
  }
})

app.post('/api/images/:id/complete', async (c) => {
  const auth = requireImageStorageAuth(c)
  await enforceWriteRateLimit(c, 'image-upload')
  assertCsrf(c, c.req.header('X-CSRF-Token'))
  const imageId = positiveInteger(c.req.param('id'), '이미지 ID')
  const image = await getPrivateImage(c.env.DB, auth.user.id, imageId)
  if (!image || image.status !== 'pending') {
    throw new HTTPException(404, { message: '확인할 이미지 업로드를 찾을 수 없습니다.' })
  }

  try {
    const uploaded = await inspectUploadedImage(c.env, image.object_key)
    const valid =
      uploaded !== null &&
      uploaded.sizeBytes === image.size_bytes &&
      uploaded.sizeBytes <= MAX_IMAGE_BYTES &&
      uploaded.contentType === image.content_type

    if (!valid) {
      await removeR2Object(c.env, image.object_key)
      await deletePendingPrivateImage(c.env.DB, auth.user.id, imageId)
      throw new ValidationError('업로드된 이미지의 형식 또는 크기를 확인할 수 없습니다.')
    }

    const completed = await markPrivateImageReady(c.env.DB, auth.user.id, imageId)
    if (!completed) throw new HTTPException(409, { message: '이미지 업로드 상태가 이미 변경되었습니다.' })
    return c.json({ ok: true, cacheUrl: imagePublicUrl(c.env, image.object_key) })
  } catch (error) {
    if (error instanceof R2ConfigurationError) {
      throw new HTTPException(503, { message: error.message })
    }
    throw error
  }
})

app.delete('/api/images/:id/pending', async (c) => {
  const auth = requireImageStorageAuth(c)
  assertCsrf(c, c.req.header('X-CSRF-Token'))
  const imageId = positiveInteger(c.req.param('id'), '이미지 ID')
  const image = await getPrivateImage(c.env.DB, auth.user.id, imageId)
  if (!image || image.status !== 'pending') return c.json({ ok: true })

  try {
    await removeR2Object(c.env, image.object_key)
  } catch (error) {
    if (!(error instanceof R2ConfigurationError)) throw error
  }
  await deletePendingPrivateImage(c.env.DB, auth.user.id, imageId)
  return c.json({ ok: true })
})

app.post('/api/images/:id/copied', async (c) => {
  const auth = requireImageStorageAuth(c)
  await enforceWriteRateLimit(c, 'image-copy')
  assertCsrf(c, c.req.header('X-CSRF-Token'))
  const imageId = positiveInteger(c.req.param('id'), '이미지 ID')
  const copiedAt = await markPrivateImageCopied(c.env.DB, auth.user.id, imageId)
  if (copiedAt === null) throw new HTTPException(404, { message: '이미지를 찾을 수 없습니다.' })
  return c.json({ ok: true, copiedAt })
})

app.get('/memos', async (c) => {
  const auth = requireActiveAuth(c)
  const [memos, settings, patterns] = await Promise.all([
    listMemos(c.env.DB, auth.user.id),
    getMemoUrlSettings(c.env.DB, auth.user.id),
    listMemoUrlPatterns(c.env.DB, auth.user.id),
  ])
  return c.html(
    <MemoBoardPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      notice={noticeFromRequest(c)}
      memos={memos}
      settings={settings}
      patterns={patterns}
    />,
  )
})

app.post('/memos', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'memo')
  const form = await readForm(c)
  const draftMemo = rawFormString(form.get('memo'))
  const draftValue = rawFormString(form.get('value'))
  const draftPatternId = rawFormString(form.get('patternId')) || 'auto'

  try {
    const memo = singleLine(form.get('memo'), '메모', 240)
    const value = singleLine(form.get('value'), '값', 500)
    const patternId = selectedMemoPatternId(form.get('patternId'))
    if (patternId !== null) {
      const pattern = await getMemoUrlPattern(c.env.DB, auth.user.id, patternId)
      if (!pattern) throw new ValidationError('선택한 메모 패턴을 찾을 수 없습니다.')
    }
    const memoId = await createMemo(c.env.DB, auth.user.id, memo, value, patternId)
    if (!memoId) throw new ValidationError('선택한 메모 패턴을 찾을 수 없습니다.')
    return redirectWithNotice(c, '/memos', 'memo-created')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    const [memos, settings, patterns] = await Promise.all([
      listMemos(c.env.DB, auth.user.id),
      getMemoUrlSettings(c.env.DB, auth.user.id),
      listMemoUrlPatterns(c.env.DB, auth.user.id),
    ])
    return c.html(
      <MemoBoardPage
        {...viewMeta(c)}
        user={auth.user}
        csrfToken={auth.csrfToken}
        memos={memos}
        settings={settings}
        patterns={patterns}
        draftMemo={draftMemo}
        draftValue={draftValue}
        draftPatternId={draftPatternId}
        error={error.message}
      />,
      400,
    )
  }
})

app.post('/memos/:id/delete', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'memo')
  const memoId = positiveInteger(c.req.param('id'), '메모 ID')
  await readForm(c)
  const deleted = await deleteMemo(c.env.DB, auth.user.id, memoId)
  if (!deleted) throw new HTTPException(404, { message: '메모를 찾을 수 없습니다.' })
  return redirectWithNotice(c, '/memos', 'memo-deleted')
})

app.get('/memos/settings', async (c) => {
  const auth = requireActiveAuth(c)
  const [settings, patterns] = await Promise.all([
    getMemoUrlSettings(c.env.DB, auth.user.id),
    listMemoUrlPatterns(c.env.DB, auth.user.id),
  ])
  return c.html(
    <MemoSettingsPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      settings={settings}
      patterns={patterns}
    />,
  )
})

app.post('/memos/settings', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'memo-settings')
  const form = await readForm(c)
  const rawSettings: MemoUrlSettings = {
    numeric_prefix: rawFormString(form.get('numericPrefix')),
    numeric_suffix: rawFormString(form.get('numericSuffix')),
    text_prefix: rawFormString(form.get('textPrefix')),
    text_suffix: rawFormString(form.get('textSuffix')),
  }

  try {
    const settings: MemoUrlSettings = {
      numeric_prefix: optionalSingleLine(form.get('numericPrefix'), '숫자 앞 URL', 1000),
      numeric_suffix: optionalSingleLine(form.get('numericSuffix'), '숫자 뒤 URL', 1000),
      text_prefix: optionalSingleLine(form.get('textPrefix'), '문자 앞 URL', 1000),
      text_suffix: optionalSingleLine(form.get('textSuffix'), '문자 뒤 URL', 1000),
    }
    validateMemoUrlTemplate(settings.numeric_prefix, settings.numeric_suffix, '숫자')
    validateMemoUrlTemplate(settings.text_prefix, settings.text_suffix, '문자')
    await upsertMemoUrlSettings(c.env.DB, auth.user.id, settings)
    return redirectWithNotice(c, '/memos', 'memo-settings-updated')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    const patterns = await listMemoUrlPatterns(c.env.DB, auth.user.id)
    return c.html(
      <MemoSettingsPage
        {...viewMeta(c)}
        user={auth.user}
        csrfToken={auth.csrfToken}
        settings={rawSettings}
        patterns={patterns}
        error={error.message}
      />,
      400,
    )
  }
})

app.post('/memos/patterns', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'memo-pattern')
  const form = await readForm(c)
  const rawDraft = rawMemoPatternDraft(form, null)

  try {
    const patterns = await listMemoUrlPatterns(c.env.DB, auth.user.id)
    if (patterns.length >= MAX_MEMO_PATTERNS_PER_USER) {
      throw new ValidationError(`메모 패턴은 최대 ${MAX_MEMO_PATTERNS_PER_USER}개까지 만들 수 있습니다.`)
    }
    const draft = validateMemoPatternDraft(rawDraft)
    await createMemoUrlPattern(c.env.DB, auth.user.id, draft.name, draft.prefix, draft.suffix)
    return redirectWithNotice(c, '/memos/settings', 'memo-pattern-created')
  } catch (error) {
    const message = memoPatternErrorMessage(error)
    if (!message) throw error
    const [settings, patterns] = await Promise.all([
      getMemoUrlSettings(c.env.DB, auth.user.id),
      listMemoUrlPatterns(c.env.DB, auth.user.id),
    ])
    return c.html(
      <MemoSettingsPage
        {...viewMeta(c)}
        user={auth.user}
        csrfToken={auth.csrfToken}
        settings={settings}
        patterns={patterns}
        patternDraft={rawDraft}
        error={message}
      />,
      400,
    )
  }
})

app.post('/memos/patterns/:id/update', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'memo-pattern')
  const patternId = positiveInteger(c.req.param('id'), '메모 패턴 ID')
  const current = await getMemoUrlPattern(c.env.DB, auth.user.id, patternId)
  if (!current) throw new HTTPException(404, { message: '메모 패턴을 찾을 수 없습니다.' })
  const form = await readForm(c)
  const rawDraft = rawMemoPatternDraft(form, patternId)

  try {
    const draft = validateMemoPatternDraft(rawDraft)
    const updated = await updateMemoUrlPattern(
      c.env.DB,
      auth.user.id,
      patternId,
      draft.name,
      draft.prefix,
      draft.suffix,
    )
    if (!updated) throw new HTTPException(404, { message: '메모 패턴을 찾을 수 없습니다.' })
    return redirectWithNotice(c, '/memos/settings', 'memo-pattern-updated')
  } catch (error) {
    const message = memoPatternErrorMessage(error)
    if (!message) throw error
    const [settings, patterns] = await Promise.all([
      getMemoUrlSettings(c.env.DB, auth.user.id),
      listMemoUrlPatterns(c.env.DB, auth.user.id),
    ])
    return c.html(
      <MemoSettingsPage
        {...viewMeta(c)}
        user={auth.user}
        csrfToken={auth.csrfToken}
        settings={settings}
        patterns={patterns}
        patternDraft={rawDraft}
        error={message}
      />,
      400,
    )
  }
})

app.post('/memos/patterns/:id/delete', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'memo-pattern')
  const patternId = positiveInteger(c.req.param('id'), '메모 패턴 ID')
  await readForm(c)
  const deleted = await deleteMemoUrlPattern(c.env.DB, auth.user.id, patternId)
  if (!deleted) throw new HTTPException(404, { message: '메모 패턴을 찾을 수 없습니다.' })
  return redirectWithNotice(c, '/memos/settings', 'memo-pattern-deleted')
})

app.get('/tickets', async (c) => {
  const auth = requireActiveAuth(c)
  const tickets = await listTickets(c.env.DB, auth.user.id)
  return c.html(
    <TicketsPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      notice={noticeFromRequest(c)}
      tickets={tickets}
      creationRequestId={crypto.randomUUID()}
    />,
  )
})

app.get('/tickets/new', (c) => {
  const auth = requireActiveAuth(c)
  return c.html(
    <TicketFormPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      mode="create"
      creationRequestId={crypto.randomUUID()}
    />,
  )
})

app.post('/tickets', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'ticket')
  const form = await readForm(c)
  const rawTitle = typeof form.get('title') === 'string' ? String(form.get('title')) : ''
  const rawNote = typeof form.get('note') === 'string' ? String(form.get('note')) : ''
  let rawLane: TicketLane = 'todo'
  let creationRequestId: string = crypto.randomUUID()
  try {
    rawLane = ticketLane(form.get('lane'))
    creationRequestId = ticketCreationRequestId(form.get('creation_request_id'))
    const title = singleLine(form.get('title'), '제목', 120)
    const note = multiline(form.get('note'), '메모', 4000, false)
    await createTicket(c.env.DB, auth.user.id, title, note, rawLane, creationRequestId)
    return redirectWithNotice(c, '/tickets', 'ticket-created')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    return c.html(
      <TicketFormPage
        {...viewMeta(c)}
        user={auth.user}
        csrfToken={auth.csrfToken}
        mode="create"
        ticket={draftTicket(auth.user.id, rawTitle, rawNote, rawLane)}
        creationRequestId={creationRequestId}
        error={error.message}
      />,
      400,
    )
  }
})

app.get('/tickets/trash', async (c) => {
  const auth = requireActiveAuth(c)
  const tickets = await listTrashedTickets(c.env.DB, auth.user.id)
  return c.html(
    <TicketTrashPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      notice={noticeFromRequest(c)}
      tickets={tickets}
    />,
  )
})

app.get('/tickets/:id/edit', async (c) => {
  const auth = requireActiveAuth(c)
  const ticketId = positiveInteger(c.req.param('id'), '티켓 ID')
  const ticket = await getTicket(c.env.DB, auth.user.id, ticketId)
  if (!ticket) throw new HTTPException(404, { message: '티켓을 찾을 수 없습니다.' })
  return c.html(
    <TicketFormPage
      {...viewMeta(c)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      mode="edit"
      ticket={ticket}
    />,
  )
})

app.post('/tickets/:id/update', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'ticket')
  const ticketId = positiveInteger(c.req.param('id'), '티켓 ID')
  const ticket = await getTicket(c.env.DB, auth.user.id, ticketId)
  if (!ticket) throw new HTTPException(404, { message: '티켓을 찾을 수 없습니다.' })
  const form = await readForm(c)
  const rawTitle = typeof form.get('title') === 'string' ? String(form.get('title')) : ''
  const rawNote = typeof form.get('note') === 'string' ? String(form.get('note')) : ''
  let rawLane: TicketLane = ticket.lane

  try {
    rawLane = ticketLane(form.get('lane'))
    const title = singleLine(form.get('title'), '제목', 120)
    const note = multiline(form.get('note'), '메모', 4000, false)
    await updateTicket(c.env.DB, auth.user.id, ticketId, title, note, rawLane)
    return redirectWithNotice(c, '/tickets', 'ticket-updated')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    return c.html(
      <TicketFormPage
        {...viewMeta(c)}
        user={auth.user}
        csrfToken={auth.csrfToken}
        mode="edit"
        ticket={draftTicket(auth.user.id, rawTitle, rawNote, rawLane, ticketId)}
        error={error.message}
      />,
      400,
    )
  }
})

app.post('/tickets/:id/move', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'ticket-order')
  const ticketId = positiveInteger(c.req.param('id'), '티켓 ID')
  const form = await readForm(c)
  const lane = ticketLane(form.get('lane'))
  const moved = await moveTicket(c.env.DB, auth.user.id, ticketId, lane)
  if (!moved) throw new HTTPException(404, { message: '티켓을 찾을 수 없습니다.' })
  return redirectWithNotice(c, '/tickets', 'ticket-moved')
})

app.post('/tickets/:id/delete', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'ticket')
  const ticketId = positiveInteger(c.req.param('id'), '티켓 ID')
  await readForm(c)
  const deleted = await deleteTicket(c.env.DB, auth.user.id, ticketId)
  if (!deleted) throw new HTTPException(404, { message: '티켓을 찾을 수 없습니다.' })
  return redirectWithNotice(c, '/tickets', 'ticket-deleted')
})

app.post('/tickets/:id/restore', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'ticket')
  const ticketId = positiveInteger(c.req.param('id'), '티켓 ID')
  await readForm(c)
  const restored = await restoreTicket(c.env.DB, auth.user.id, ticketId)
  if (!restored) throw new HTTPException(404, { message: '복원할 티켓을 찾을 수 없습니다.' })
  return redirectWithNotice(c, '/tickets/trash', 'ticket-restored')
})

app.post('/tickets/:id/purge', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'ticket')
  const ticketId = positiveInteger(c.req.param('id'), '티켓 ID')
  await readForm(c)
  const deleted = await permanentlyDeleteTicket(c.env.DB, auth.user.id, ticketId)
  if (!deleted) throw new HTTPException(404, { message: '영구 삭제할 티켓을 찾을 수 없습니다.' })
  return redirectWithNotice(c, '/tickets/trash', 'ticket-purged')
})

app.put('/api/tickets/order', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'ticket-order')
  assertCsrf(c, c.req.header('X-CSRF-Token'))

  const payload = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!payload || typeof payload !== 'object') throw new ValidationError('티켓 순서 데이터가 올바르지 않습니다.')

  const lanes = {} as Record<TicketLane, number[]>
  for (const lane of ['todo', 'doing', 'done'] as const) {
    const value = payload[lane]
    if (!Array.isArray(value)) throw new ValidationError('티켓 순서 데이터가 올바르지 않습니다.')
    lanes[lane] = value.map((id) => {
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
        throw new ValidationError('티켓 ID가 올바르지 않습니다.')
      }
      return id
    })
  }

  await reorderTickets(c.env.DB, auth.user.id, lanes)
  return c.json({ ok: true })
})

app.get('/account', async (c) => {
  const auth = requireActiveAuth(c)
  return renderAccountPage(c, auth)
})

app.post('/account/nickname', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'account')
  const form = await readForm(c)

  try {
    const nextNickname = nickname(form.get('nickname'))
    await c.env.DB.prepare('UPDATE users SET nickname = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(nextNickname, Date.now(), auth.user.id)
      .run()
    return redirectWithNotice(c, '/account', 'nickname-updated')
  } catch (error) {
    const isDuplicate = error instanceof Error && /UNIQUE|constraint/i.test(error.message)
    if (!(error instanceof ValidationError) && !isDuplicate) throw error
    const message = isDuplicate ? '이미 사용 중인 닉네임입니다.' : error.message
    const rawNickname = typeof form.get('nickname') === 'string' ? String(form.get('nickname')) : auth.user.nickname
    return renderAccountPage(c, auth, {
      nicknameError: message,
      nicknameValue: rawNickname,
      status: 400,
    })
  }
})

app.post('/account/email-privacy', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'account')
  const form = await readForm(c)
  const hiddenValue = form.get('hidden')

  if (hiddenValue !== 'true' && hiddenValue !== 'false') {
    throw new ValidationError('이메일 정보 가림 설정이 올바르지 않습니다.')
  }

  const emailHidden = hiddenValue === 'true'
  await c.env.DB.prepare('UPDATE users SET email_hidden = ?1, updated_at = ?2 WHERE id = ?3')
    .bind(emailHidden ? 1 : 0, Date.now(), auth.user.id)
    .run()
  return redirectWithNotice(c, '/account', 'email-privacy-updated')
})

app.post('/account/themes/builtin/:key/select', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'theme')
  await readForm(c)
  try {
    await selectBuiltinTheme(c.env.DB, auth.user.id, c.req.param('key'))
    return redirectWithNotice(c, '/account', 'theme-selected')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    return renderAccountPage(c, auth, { themeError: error.message, status: 400 })
  }
})

app.post('/account/themes', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'theme')
  const form = await readForm(c)
  try {
    const name = singleLine(form.get('name'), '테마 이름', 60)
    await createOwnedTheme(c.env.DB, auth.user.id, name)
    return redirectWithNotice(c, '/account', 'theme-created')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    return renderAccountPage(c, auth, { themeError: error.message, status: 400 })
  }
})

app.post('/account/themes/import', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'theme')
  const form = await readForm(c)
  try {
    const shareCode = normalizeThemeShareCode(form.get('shareCode'))
    await importSharedTheme(c.env.DB, auth.user.id, shareCode)
    return redirectWithNotice(c, '/account', 'theme-imported')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    return renderAccountPage(c, auth, { themeError: error.message, status: 400 })
  }
})

app.post('/account/themes/:id/select-owned', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'theme')
  await readForm(c)
  const themeId = positiveInteger(c.req.param('id'), '테마 ID')
  if (!(await selectOwnedTheme(c.env.DB, auth.user.id, themeId))) {
    throw new HTTPException(404, { message: '내 테마를 찾을 수 없습니다.' })
  }
  return redirectWithNotice(c, '/account', 'theme-selected')
})

app.post('/account/themes/:id/select-shared', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'theme')
  await readForm(c)
  const themeId = positiveInteger(c.req.param('id'), '테마 ID')
  if (!(await selectSharedTheme(c.env.DB, auth.user.id, themeId))) {
    throw new HTTPException(404, { message: '가져온 공유 테마를 찾을 수 없습니다.' })
  }
  return redirectWithNotice(c, '/account', 'theme-selected')
})

app.post('/account/themes/:id/update', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'theme')
  const form = await readForm(c)
  const themeId = positiveInteger(c.req.param('id'), '테마 ID')
  try {
    const name = singleLine(form.get('name'), '테마 이름', 60)
    const palette = themePaletteFromForm(form)
    if (!(await updateOwnedTheme(c.env.DB, auth.user.id, themeId, name, palette))) {
      throw new HTTPException(404, { message: '수정할 내 테마를 찾을 수 없습니다.' })
    }
    return redirectWithNotice(c, '/account', 'theme-updated')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    return renderAccountPage(c, auth, { themeError: error.message, status: 400 })
  }
})

app.post('/account/themes/:id/publish', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'theme')
  await readForm(c)
  const themeId = positiveInteger(c.req.param('id'), '테마 ID')
  if (!(await publishOwnedTheme(c.env.DB, auth.user.id, themeId))) {
    throw new HTTPException(404, { message: '공개할 내 테마를 찾을 수 없습니다.' })
  }
  return redirectWithNotice(c, '/account', 'theme-published')
})

app.post('/account/themes/:id/delete', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'theme')
  await readForm(c)
  const themeId = positiveInteger(c.req.param('id'), '테마 ID')
  if (!(await deleteOwnedTheme(c.env.DB, auth.user.id, themeId))) {
    throw new HTTPException(404, { message: '삭제할 내 테마를 찾을 수 없습니다.' })
  }
  return redirectWithNotice(c, '/account', 'theme-deleted')
})

app.notFound((c) => renderError(c, 404, '요청한 페이지 또는 데이터를 찾을 수 없습니다.'))

app.onError((error, c) => {
  const status = normalizeStatus(error instanceof HTTPException ? error.status : error instanceof ValidationError ? 400 : 500)
  const incidentCode = status === 500 ? createIncidentCode() : undefined
  const adminDetails =
    sameOriginAdminDetails(c, error) ??
    imageServiceAdminDetails(c, error) ??
    requestProcessAdminDetails(c, error)
  const loggedError = error instanceof RequestProcessError ? error.originalError : error
  const message =
    status === 500
      ? '일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.'
      : error instanceof Error
        ? error.message
        : '요청을 처리하지 못했습니다.'

  if (status === 500) {
    console.error('Unhandled application error', {
      incidentCode,
      name: loggedError instanceof Error ? loggedError.name : 'UnknownError',
      message: loggedError instanceof Error ? loggedError.message.slice(0, 200) : 'unknown',
      method: c.req.method,
      path: c.req.path,
    })
  }

  if (acceptsJson(c)) {
    return c.json(
      adminDetails
        ? { error: message, details: Object.fromEntries(adminDetails.map((detail) => [detail.label, detail.value])) }
        : incidentCode
          ? { error: message, code: incidentCode }
          : { error: message },
      status as ContentfulStatusCode,
    )
  }
  return renderError(c, status, message, incidentCode, adminDetails)
})

export default app
