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
  canManageResource,
  createComment,
  createPost,
  createTicket,
  deleteComment,
  deletePost,
  deleteTicket,
  getBoardBySlug,
  getComment,
  getPost,
  getTicket,
  listComments,
  listPosts,
  listTickets,
  moveTicket,
  reorderTickets,
  updateComment,
  updatePost,
  updateTicket,
} from './lib/db'
import { safeEqual } from './lib/crypto'
import { getAppName, turnstileEnabled } from './lib/env'
import { acceptsJson, noticeFromRequest, redirectWithNotice } from './lib/http'
import {
  assertCsrf,
  enforceAuthRateLimit,
  enforceWriteRateLimit,
  isPublicPath,
  requireAuth,
  securityMiddleware,
} from './lib/security'
import { boardSlug, multiline, nickname, positiveInteger, singleLine, ticketLane, ValidationError } from './lib/validation'
import type { AppContext, AppEnv, PostDetailRow, TicketLane, TicketRow } from './types'
import { AccountPage } from './views/account'
import { BoardListPage, CommentEditPage, PostDetailPage, PostFormPage } from './views/boards'
import { AppErrorPage, BlockedPage, PublicErrorPage } from './views/errors'
import { PrivacyPage, TermsPage } from './views/legal'
import { LoginPage } from './views/login'
import { TicketFormPage, TicketsPage } from './views/tickets'

const app = new Hono<AppEnv>()
const MAX_REQUEST_BYTES = 64 * 1024

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500

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
  }
}

function normalizeStatus(value: number): ErrorStatus {
  if ([400, 401, 403, 404, 409, 413, 429].includes(value)) return value as ErrorStatus
  return 500
}

function renderError(c: AppContext, status: ErrorStatus, message: string): Response | Promise<Response> {
  const auth = c.get('auth')
  const appName = getAppName(c.env)
  const view = auth ? (
    <AppErrorPage
      appName={appName}
      title={errorTitle(status)}
      message={message}
      status={status}
      user={auth.user}
      csrfToken={auth.csrfToken}
    />
  ) : (
    <PublicErrorPage appName={appName} title={errorTitle(status)} message={message} status={status} />
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

async function readForm(c: AppContext): Promise<FormData> {
  const form = await c.req.formData()
  const token = form.get('_csrf')
  assertCsrf(c, typeof token === 'string' ? token : null)
  return form
}

function draftPost(boardId: number, boardName: string, boardSlugValue: string, title: string, body: string): PostDetailRow {
  return {
    id: 0,
    board_id: boardId,
    board_slug: boardSlugValue,
    board_name: boardName,
    author_id: '',
    author_nickname: '',
    title,
    body,
    comment_count: 0,
    created_at: 0,
    updated_at: 0,
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
  }
}

app.use(
  '*',
  bodyLimit({
    maxSize: MAX_REQUEST_BYTES,
    onError: (c) =>
      c.html(
        <PublicErrorPage
          appName={getAppName(c.env)}
          title="요청 내용이 너무 큽니다"
          message="한 번에 전송할 수 있는 내용의 크기를 초과했습니다."
          status={413}
        />,
        413,
      ),
  }),
)
app.use('*', securityMiddleware)

app.use('*', async (c, next) => {
  c.set('auth', null)

  if (!c.req.path.startsWith('/assets/')) {
    const auth = await loadAuthContext(c)
    c.set('auth', auth)
  }

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

  await next()
})

app.get('/assets/*', (c) => c.env.ASSETS.fetch(c.req.raw))
app.get('/health', (c) => c.json({ ok: true }))

app.get('/login', (c) => {
  const auth = c.get('auth')
  if (auth?.user.status === 'active') return c.redirect('/boards/free', 303)
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
      appName={getAppName(c.env)}
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
      appName={getAppName(c.env)}
      {...(c.env.CONTACT_EMAIL?.trim() ? { contactEmail: c.env.CONTACT_EMAIL.trim() } : {})}
    />,
  ),
)
app.get('/terms', (c) =>
  c.html(
    <TermsPage
      appName={getAppName(c.env)}
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
        appName={getAppName(c.env)}
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

    return c.redirect(user.status === 'blocked' ? '/account/blocked' : '/boards/free', 303)
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
  return c.html(<BlockedPage appName={getAppName(c.env)} user={auth.user} csrfToken={auth.csrfToken} />, 403)
})

app.get('/', (c) => c.redirect('/boards/free', 303))

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
      appName={getAppName(c.env)}
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
  return c.html(
    <PostFormPage appName={getAppName(c.env)} user={auth.user} csrfToken={auth.csrfToken} board={board} mode="create" />,
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

  try {
    const title = singleLine(form.get('title'), '제목', 120)
    if (title.length < 2) throw new ValidationError('제목은 2자 이상이어야 합니다.')
    const body = multiline(form.get('body'), '내용', 20000)
    const postId = await createPost(c.env.DB, board.id, auth.user.id, title, body)
    return redirectWithNotice(c, `/posts/${postId}`, 'post-created')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    return c.html(
      <PostFormPage
        appName={getAppName(c.env)}
        user={auth.user}
        csrfToken={auth.csrfToken}
        board={board}
        mode="create"
        post={draftPost(board.id, board.name, board.slug, rawTitle, rawBody)}
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
  const comments = await listComments(c.env.DB, postId)
  return c.html(
    <PostDetailPage
      appName={getAppName(c.env)}
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
  return c.html(
    <PostFormPage
      appName={getAppName(c.env)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      board={board}
      mode="edit"
      post={post}
    />,
  )
})

app.post('/posts/:id/update', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'post')
  const postId = positiveInteger(c.req.param('id'), '게시글 ID')
  const post = await getPost(c.env.DB, postId)
  if (!post) throw new HTTPException(404, { message: '게시글을 찾을 수 없습니다.' })
  if (!canManageResource(auth.user, post.author_id)) throw new HTTPException(403, { message: '수정 권한이 없습니다.' })
  const board = await getBoardBySlug(c.env.DB, boardSlug(post.board_slug))
  if (!board) throw new HTTPException(404, { message: '게시판을 찾을 수 없습니다.' })

  const form = await readForm(c)
  const rawTitle = typeof form.get('title') === 'string' ? String(form.get('title')) : ''
  const rawBody = typeof form.get('body') === 'string' ? String(form.get('body')) : ''
  try {
    const title = singleLine(form.get('title'), '제목', 120)
    if (title.length < 2) throw new ValidationError('제목은 2자 이상이어야 합니다.')
    const body = multiline(form.get('body'), '내용', 20000)
    const changed = await updatePost(c.env.DB, postId, title, body)
    if (!changed) throw new HTTPException(404, { message: '게시글을 찾을 수 없습니다.' })
    return redirectWithNotice(c, `/posts/${postId}`, 'post-updated')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    return c.html(
      <PostFormPage
        appName={getAppName(c.env)}
        user={auth.user}
        csrfToken={auth.csrfToken}
        board={board}
        mode="edit"
        post={{ ...post, title: rawTitle, body: rawBody }}
        error={error.message}
      />,
      400,
    )
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
  return redirectWithNotice(c, `/boards/${post.board_slug}`, 'post-deleted')
})

app.post('/posts/:id/comments', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'comment')
  const postId = positiveInteger(c.req.param('id'), '게시글 ID')
  const post = await getPost(c.env.DB, postId)
  if (!post) throw new HTTPException(404, { message: '게시글을 찾을 수 없습니다.' })
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
  return c.html(
    <CommentEditPage
      appName={getAppName(c.env)}
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
        appName={getAppName(c.env)}
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

app.get('/tickets', async (c) => {
  const auth = requireActiveAuth(c)
  const tickets = await listTickets(c.env.DB, auth.user.id)
  return c.html(
    <TicketsPage
      appName={getAppName(c.env)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      notice={noticeFromRequest(c)}
      tickets={tickets}
    />,
  )
})

app.get('/tickets/new', (c) => {
  const auth = requireActiveAuth(c)
  return c.html(
    <TicketFormPage appName={getAppName(c.env)} user={auth.user} csrfToken={auth.csrfToken} mode="create" />,
  )
})

app.post('/tickets', async (c) => {
  const auth = requireActiveAuth(c)
  await enforceWriteRateLimit(c, 'ticket')
  const form = await readForm(c)
  const rawTitle = typeof form.get('title') === 'string' ? String(form.get('title')) : ''
  const rawNote = typeof form.get('note') === 'string' ? String(form.get('note')) : ''
  let rawLane: TicketLane = 'todo'
  try {
    rawLane = ticketLane(form.get('lane'))
    const title = singleLine(form.get('title'), '제목', 120)
    const note = multiline(form.get('note'), '메모', 4000, false)
    await createTicket(c.env.DB, auth.user.id, title, note, rawLane)
    return redirectWithNotice(c, '/tickets', 'ticket-created')
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    return c.html(
      <TicketFormPage
        appName={getAppName(c.env)}
        user={auth.user}
        csrfToken={auth.csrfToken}
        mode="create"
        ticket={draftTicket(auth.user.id, rawTitle, rawNote, rawLane)}
        error={error.message}
      />,
      400,
    )
  }
})

app.get('/tickets/:id/edit', async (c) => {
  const auth = requireActiveAuth(c)
  const ticketId = positiveInteger(c.req.param('id'), '티켓 ID')
  const ticket = await getTicket(c.env.DB, auth.user.id, ticketId)
  if (!ticket) throw new HTTPException(404, { message: '티켓을 찾을 수 없습니다.' })
  return c.html(
    <TicketFormPage
      appName={getAppName(c.env)}
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
        appName={getAppName(c.env)}
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

app.get('/account', (c) => {
  const auth = requireActiveAuth(c)
  return c.html(
    <AccountPage
      appName={getAppName(c.env)}
      user={auth.user}
      csrfToken={auth.csrfToken}
      notice={noticeFromRequest(c)}
    />,
  )
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
    return c.html(
      <AccountPage
        appName={getAppName(c.env)}
        user={{ ...auth.user, nickname: rawNickname }}
        csrfToken={auth.csrfToken}
        error={message}
      />,
      400,
    )
  }
})

app.notFound((c) => renderError(c, 404, '요청한 페이지 또는 데이터를 찾을 수 없습니다.'))

app.onError((error, c) => {
  const status = normalizeStatus(error instanceof HTTPException ? error.status : error instanceof ValidationError ? 400 : 500)
  const message =
    status === 500
      ? '일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.'
      : error instanceof Error
        ? error.message
        : '요청을 처리하지 못했습니다.'

  if (status === 500) {
    console.error('Unhandled application error', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
    })
  }

  if (acceptsJson(c)) return c.json({ error: message }, status as ContentfulStatusCode)
  return renderError(c, status, message)
})

export default app
