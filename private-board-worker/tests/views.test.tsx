import { describe, expect, it } from 'vitest'
import type {
  BoardRow,
  CurrentUser,
  DashboardWidgetRow,
  DeployInfo,
  MemoRow,
  MemoUrlPatternRow,
  MemoUrlSettings,
  PostListRow,
  PostDetailRow,
  PrivateImageRow,
  TicketRow,
  TrashedTicketRow,
} from '../src/types'
import type { ThemeLibrary } from '../src/lib/themes'
import { BUILTIN_THEMES } from '../src/lib/themes'
import { AccountPage } from '../src/views/account'
import { AdminPage } from '../src/views/admin'
import { BoardListPage, PostFormPage } from '../src/views/boards'
import { DevlogPostPage, UserDevlogPage } from '../src/views/devlogs'
import { DashboardPage } from '../src/views/dashboard'
import { PublicErrorPage } from '../src/views/errors'
import { GuestHomePage } from '../src/views/home'
import { LoginPage } from '../src/views/login'
import { PrivateImagesPage } from '../src/views/images'
import { composeMemoUrl, MemoBoardPage, MemoSettingsPage } from '../src/views/memos'
import { TicketsPage, TicketTrashPage } from '../src/views/tickets'

const ticketCreationRequestId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

const user: CurrentUser = {
  id: 'user-1',
  nickname: '테스트회원',
  role: 'user',
  status: 'active',
  email: 'member@example.com',
  emailHidden: true,
}

const adminUser: CurrentUser = {
  ...user,
  id: 'admin-1',
  nickname: '관리자',
  role: 'admin',
}

const deployInfo: DeployInfo = {
  version: '0d2e4a11',
  timestamp: '2026-07-25T08:28:29.000Z',
  displayTimestamp: '2026. 07. 25. 17:28 KST',
}

const ticket: TicketRow = {
  id: 1,
  owner_id: user.id,
  title: '문서 검토',
  note: '간단한 메모',
  lane: 'todo',
  sort_order: 1000,
  created_at: 1,
  updated_at: 1,
  deleted_at: null,
  purge_after: null,
}

const board: BoardRow = {
  id: 1,
  slug: 'free',
  name: '자유게시판',
  description: '자유롭게 글을 나누는 공간',
  sort_order: 1,
}

const post: PostListRow = {
  id: 1,
  board_id: board.id,
  board_slug: board.slug,
  board_name: board.name,
  author_id: user.id,
  author_nickname: '삼방장',
  author_role: 'user',
  title: '1등!!',
  comment_count: 3,
  view_count: 17,
  created_at: Date.UTC(2026, 6, 25, 8, 29),
  updated_at: Date.UTC(2026, 6, 25, 8, 29),
}

const dashboardWidgets: DashboardWidgetRow[] = [
  {
    id: 1,
    user_id: user.id,
    widget_type: 'free-board',
    title: null,
    url: null,
    icon_url: null,
    icon_color: 'green',
    sort_order: 1000,
    created_at: 1,
  },
  {
    id: 3,
    user_id: user.id,
    widget_type: 'rss',
    title: '개발 소식',
    url: 'https://example.com/feed.xml',
    icon_url: null,
    icon_color: 'green',
    sort_order: 3000,
    created_at: 1,
  },
  {
    id: 2,
    user_id: user.id,
    widget_type: 'bookmark',
    title: '내 문서',
    url: 'https://example.com/docs',
    icon_url: 'https://example.com/icon.png',
    icon_color: 'purple',
    sort_order: 2000,
    created_at: 1,
  },
]

const themeLibrary: ThemeLibrary = {
  builtins: [...BUILTIN_THEMES],
  selection: { kind: 'shared', builtinKey: null, themeId: 22 },
  owned: [
    {
      id: 11,
      ownerId: user.id,
      ownerNickname: user.nickname,
      ownerRole: user.role,
      name: '내 픽셀 테마',
      palette: BUILTIN_THEMES[0]!.palette,
      shareCode: 'THEME-0123ABCDEF45',
      updatedAt: 1,
    },
  ],
  shared: [
    {
      id: 22,
      ownerId: 'user-2',
      ownerNickname: '테마장인',
      ownerRole: 'user',
      name: '공유 포레스트',
      palette: BUILTIN_THEMES[2]!.palette,
      shareCode: 'THEME-ABCDEF012345',
      updatedAt: 2,
    },
  ],
}

const memoSettings: MemoUrlSettings = {
  numeric_prefix: 'https://example.com/items/',
  numeric_suffix: '?from=memo',
  text_prefix: 'https://example.com/search?q=',
  text_suffix: '&from=memo',
}

const memoPatterns: MemoUrlPatternRow[] = [
  {
    id: 7,
    user_id: user.id,
    name: '상품 상세',
    prefix: 'https://shop.example.com/products/',
    suffix: '?ref=memo',
    sort_order: 1000,
    created_at: 1,
    updated_at: 1,
  },
]

const memos: MemoRow[] = [
  {
    id: 1,
    owner_id: user.id,
    memo: '상품 번호',
    value: '00123',
    pattern_id: null,
    pattern_name: null,
    pattern_prefix: null,
    pattern_suffix: null,
    created_at: 1,
    updated_at: 1,
  },
  {
    id: 2,
    owner_id: user.id,
    memo: '검색어',
    value: '한글 단어',
    pattern_id: null,
    pattern_name: null,
    pattern_prefix: null,
    pattern_suffix: null,
    created_at: 2,
    updated_at: 2,
  },
  {
    id: 3,
    owner_id: user.id,
    memo: '선택한 상품',
    value: 'ABC-42',
    pattern_id: memoPatterns[0]!.id,
    pattern_name: memoPatterns[0]!.name,
    pattern_prefix: memoPatterns[0]!.prefix,
    pattern_suffix: memoPatterns[0]!.suffix,
    created_at: 3,
    updated_at: 3,
  },
]

const privateImages: PrivateImageRow[] = [
  {
    id: 10,
    owner_id: user.id,
    object_key: 'private-images/one.png',
    original_name: '첫 이미지.png',
    content_type: 'image/png',
    size_bytes: 1024,
    status: 'ready',
    copied_at: null,
    created_at: 1,
    updated_at: 1,
  },
  {
    id: 11,
    owner_id: user.id,
    object_key: 'private-images/two.webp',
    original_name: '공유한 이미지.webp',
    content_type: 'image/webp',
    size_bytes: 2048,
    status: 'ready',
    copied_at: 2,
    created_at: 2,
    updated_at: 2,
  },
]

describe('핵심 화면', () => {
  it('개인 대시보드에 자유게시판 요약, 북마크, 위젯 추가 슬롯을 표시한다', async () => {
    const html = String(
      await DashboardPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        widgets: dashboardWidgets,
        freeBoardPosts: [post],
        bookmarkCreationRequestId: ticketCreationRequestId,
        rssResults: {
          3: {
            feed: {
              title: 'Example Feed',
              sourceUrl: 'https://example.com/feed.xml',
              fetchedAt: 1,
              items: [
                {
                  title: '새로운 개발 소식',
                  url: 'https://example.com/posts/latest',
                  summary: '최근 글의 짧은 요약입니다.',
                  publishedAt: Date.UTC(2026, 6, 26, 3, 0),
                },
              ],
            },
            error: null,
          },
        },
      }),
    )

    expect(html).toContain('테스트회원님의 대시보드')
    expect(html).toContain('자유게시판 요약')
    expect(html).toContain('내 문서')
    expect(html).toContain('https://example.com/docs')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('data-dialog-open="widget-add-dialog"')
    expect(html).toContain('data-dashboard')
    expect(html).toContain('data-dashboard-sortable="bookmarks"')
    expect(html).toContain('data-dashboard-sortable="widgets"')
    expect(html).toContain('class="bookmark-quick-link"')
    expect(html).toContain('내 북마크')
    expect(html).toContain('data-dialog-open="bookmark-add-dialog"')
    expect(html).toContain('action="/dashboard/bookmarks"')
    expect(html).toContain(`name="creation_request_id" value="${ticketCreationRequestId}"`)
    expect(html).toContain('data-prevent-double-submit')
    expect(html).toContain('action="/dashboard/bookmarks/2/update"')
    expect(html).toContain('기본 아이콘 사용')
    expect(html).toContain('아이콘 URL 사용')
    expect(html).toContain('아이콘 URL 자동 조회')
    expect(html).toContain('data-bookmark-icon-lookup')
    expect(html).toContain('data-bookmark-icon-lookup-status')
    expect(html).toContain('name="iconUrl"')
    expect(html).toContain('value="https://example.com/icon.png"')
    expect(html.match(/name="iconColor"/gu)).toHaveLength(10)
    expect(html).toContain('bookmark-icon-color-green')
    expect(html).toContain('bookmark-icon-color-blue')
    expect(html).toContain('bookmark-icon-color-purple')
    expect(html).toContain('bookmark-icon-color-orange')
    expect(html).toContain('bookmark-icon-color-rose')
    expect(html).not.toContain('사이트 아이콘 가져와 추가')
    expect(html).not.toContain('사이트 아이콘 갱신')
    expect(html).not.toContain('name="widgetType" value="bookmark"')
    const bookmarkCard = html.match(/<article class="bookmark-quick-link"[\s\S]*?<\/article>/u)?.[0]
    expect(bookmarkCard).not.toContain('<small>')
    expect(html).toContain('data-dashboard-add-slot')
    expect(html).toContain('data-dashboard-edit-toggle')
    expect(html).toContain('data-dashboard-save-status')
    expect(html).toContain('data-dashboard-widget-id="1"')
    expect(html).toContain('data-dashboard-widget-id="2"')
    expect(html).toContain('data-dashboard-widget-id="3"')
    expect(html).toContain('data-dashboard-move="-1"')
    expect(html).toContain('data-dashboard-move="1"')
    expect(html).toContain('RSS 최신 글')
    expect(html).toContain('새로운 개발 소식')
    expect(html).toContain('최근 글의 짧은 요약입니다.')
    expect(html).toContain('현재 자유게시판 요약과 RSS 최신 글 위젯을 지원합니다.')
  })

  it('내부 오류 사유 대신 추적 가능한 오류 코드만 표시한다', async () => {
    const html = String(
      await PublicErrorPage({
        appName: 'Private Board',
        deployInfo,
        title: '서비스 오류가 발생했습니다',
        message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
        status: 500,
        incidentCode: 'PB-A1B2C3D4E5',
      }),
    )

    expect(html).toContain('오류 코드')
    expect(html).toContain('PB-A1B2C3D4E5')
    expect(html).not.toContain('Database binding is missing')
  })

  it('자유게시판 목록은 제목, 댓글 수, 닉네임, 작성 시간, 조회수 순서로 표시한다', async () => {
    const html = String(
      await BoardListPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        board,
        posts: [post],
        hasMore: false,
      }),
    )

    const titlePosition = html.indexOf('1등!!')
    const commentPosition = html.indexOf('[3]')
    const nicknamePosition = html.indexOf('삼방장')
    const timePosition = html.indexOf('<time')
    const viewsPosition = html.indexOf('조회 17')

    expect(titlePosition).toBeGreaterThan(-1)
    expect(titlePosition).toBeLessThan(commentPosition)
    expect(commentPosition).toBeLessThan(nicknamePosition)
    expect(nicknamePosition).toBeLessThan(timePosition)
    expect(timePosition).toBeLessThan(viewsPosition)
  })

  it('관리자 작성자의 닉네임 오른쪽에 금색 별 아이콘을 표시한다', async () => {
    const html = String(
      await BoardListPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        board,
        posts: [{ ...post, author_role: 'admin' }],
        hasMore: false,
      }),
    )

    expect(html).toContain('class="admin-author-star"')
    expect(html).toContain('aria-label="관리자"')
    expect(html.indexOf('삼방장')).toBeLessThan(html.indexOf('class="admin-author-star"'))
  })

  it('비로그인 로그인 화면에는 인증 안내를 렌더링한다', async () => {
    const html = String(await LoginPage({ appName: 'Private Board', deployInfo }))
    expect(html).toContain('Google 계정으로 로그인')
    expect(html).toContain('손님 홈에서는 공용 게시판의 최근 글을 미리 볼 수 있습니다')
    expect(html).toContain('deploy 0d2e4a11')
    expect(html).toContain('2026. 07. 25. 17:28 KST')
    expect(html).not.toContain('data-ticket-board')
    expect(html).not.toContain('<img')
  })

  it('손님 홈에 자유게시판, 개발, 뉴스 최근 글을 지정한 순서로 표시한다', async () => {
    const html = String(
      await GuestHomePage({
        appName: 'Private Board',
        deployInfo,
        previews: [
          { slug: 'free', name: '자유게시판', posts: [post] },
          { slug: 'development', name: '개발', posts: [] },
          { slug: 'news', name: '뉴스', posts: [] },
        ],
      }),
    )

    const freePosition = html.indexOf('id="preview-free"')
    const developmentPosition = html.indexOf('id="preview-development"')
    const newsPosition = html.indexOf('id="preview-news"')

    expect(freePosition).toBeGreaterThan(-1)
    expect(freePosition).toBeLessThan(developmentPosition)
    expect(developmentPosition).toBeLessThan(newsPosition)
    expect(html).not.toContain('최근 게시글 5건')
    expect(html).not.toContain('게시판 보기')
    expect(html).toContain('href="/posts/1"')
    expect(html).not.toContain('@')
    expect(html).toContain('공개 개발일지는 바로 읽을 수 있으며, 다른 게시판 참여는 로그인 후 가능합니다.')
  })

  it('개발일지 편집기에 공개 범위와 커서 위치 이미지 도구를 표시한다', async () => {
    const developmentBoard: BoardRow = {
      ...board,
      id: 2,
      slug: 'development',
      name: '개발일지',
    }
    const html = String(
      await PostFormPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        board: developmentBoard,
        mode: 'create',
        imageServiceEnabled: true,
      }),
    )

    expect(html).toContain('data-devlog-editor-form')
    expect(html).toContain('contenteditable')
    expect(html).toContain('name="visibility" value="public"')
    expect(html).toContain('name="visibility" value="private" checked')
    expect(html).toContain('data-editor-image')
    expect(html).toContain('이미지는 현재 커서 위치에 삽입됩니다.')
  })

  it('공개 개발일지는 로그인 없이 리치 본문을 렌더링한다', async () => {
    const devlogPost: PostDetailRow = {
      ...post,
      board_id: 2,
      board_slug: 'development',
      board_name: '개발일지',
      body: '<h2>오늘 만든 것</h2><p>배포 자동화를 개선했습니다.</p>',
      body_format: 'rich',
      visibility: 'public',
    }
    const html = String(
      await DevlogPostPage({
        appName: 'Private Board',
        deployInfo,
        user: null,
        csrfToken: undefined,
        post: devlogPost,
      }),
    )

    expect(html).toContain('public-devlog-topbar')
    expect(html).toContain('<h2>오늘 만든 것</h2>')
    expect(html).toContain('href="/login"')
    expect(html).not.toContain('data-menu-toggle')
  })

  it('본인 개발일지 목록에는 비공개 배지와 새 기록 동작을 표시한다', async () => {
    const html = String(
      await UserDevlogPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        author: { id: user.id, nickname: user.nickname, role: user.role },
        posts: [
          {
            ...post,
            board_id: 2,
            board_slug: 'development',
            board_name: '개발일지',
            body: '<p>초안입니다.</p>',
            body_format: 'rich',
            visibility: 'private',
          },
        ],
        hasMore: false,
      }),
    )

    expect(html).toContain('href="/boards/development/new"')
    expect(html).toContain('visibility-badge">비공개')
    expect(html).toContain(`/devlogs/u/${user.id}/posts/${post.id}`)
  })

  it('인증 화면은 문맥형 탑바와 오른쪽 단일 메뉴 토글을 포함한다', async () => {
    const html = String(
      await TicketsPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        tickets: [ticket],
        creationRequestId: ticketCreationRequestId,
      }),
    )
    expect(html).toContain('topbar-title">내 작업')
    expect(html.match(/data-menu-toggle/g)).toHaveLength(1)
    expect(html).toContain('티켓 추가')
    expect(html).toContain('자유게시판')
    expect(html).toContain('문의')
    expect(html).toContain('문서 검토')
    expect(html).not.toContain('개인 이미지 저장')
    expect(html).not.toContain('관리자 설정')
    expect(html).not.toContain('<img')
  })

  it('기본 상태에서는 본인 이메일도 DOM에 렌더링하지 않고 패턴으로 가린다', async () => {
    const html = String(
      await AccountPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        themeLibrary,
      }),
    )

    expect(html).not.toContain(user.email)
    expect(html).toContain('data-email-hidden="true"')
    expect(html).toContain('private-email-mask')
    expect(html).toContain('이메일 정보 가림')
    expect(html).toContain('aria-checked="true"')
  })

  it('사용자가 가림을 끈 경우에만 본인 이메일을 렌더링한다', async () => {
    const html = String(
      await AccountPage({
        appName: 'Private Board',
        deployInfo,
        user: { ...user, emailHidden: false },
        csrfToken: 'csrf-test',
        themeLibrary,
      }),
    )

    expect(html).toContain(user.email)
    expect(html).not.toContain('data-email-hidden="true"')
    expect(html).toContain('aria-checked="false"')
  })

  it('개인 설정에서 내장·내 테마·공유 테마를 픽셀아트 태그로 구분한다', async () => {
    const html = String(
      await AccountPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        themeLibrary,
      }),
    )

    expect(html).toContain('색상 테마')
    expect(html).toContain('내장 기본제공')
    expect(html).toContain('내가 만든 테마')
    expect(html).toContain('공유받은 테마')
    expect(html).toContain('theme-pixel-icon')
    expect(html).toContain('복제하여 만들기')
    expect(html).toContain('THEME-0123ABCDEF45')
    expect(html).toContain('테마장인님의 원본 변경이 자동으로 반영됩니다.')
    expect(html).toContain('action="/account/themes/22/select-shared"')
  })

  it('원본이 삭제된 공유 테마의 기본 복귀 안내 팝업을 한 번 표시할 수 있다', async () => {
    const html = String(
      await TicketsPage({
        appName: 'Private Board',
        deployInfo,
        user: { ...user, themeOrphanNoticePending: true },
        csrfToken: 'csrf-test',
        tickets: [],
        creationRequestId: ticketCreationRequestId,
      }),
    )

    expect(html).toContain('data-auto-dialog')
    expect(html).toContain('공유 테마가 삭제되었습니다')
    expect(html).toContain('기본 테마로 자동 변경했습니다')
  })

  it('티켓 생성 폼에는 멱등성 요청값과 이중 제출 방지 표시가 있다', async () => {
    const html = String(
      await TicketsPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        tickets: [ticket],
        creationRequestId: ticketCreationRequestId,
      }),
    )

    expect(html).toContain(`name="creation_request_id" value="${ticketCreationRequestId}"`)
    expect(html).toContain('data-prevent-double-submit')
    expect(html).toContain('href="/tickets/trash"')
  })

  it('티켓 휴지통은 복원 기한과 영구 삭제 동작을 표시한다', async () => {
    const trashedTicket: TrashedTicketRow = {
      ...ticket,
      deleted_at: Date.UTC(2026, 6, 26, 0, 0),
      purge_after: Date.UTC(2026, 7, 9, 0, 0),
    }
    const html = String(
      await TicketTrashPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        tickets: [trashedTicket],
      }),
    )

    expect(html).toContain('14일 동안 복원')
    expect(html).toContain('action="/tickets/1/restore"')
    expect(html).toContain('action="/tickets/1/purge"')
    expect(html).toContain('이 작업은 되돌릴 수 없습니다')
  })

  it('개인 메모는 상세 페이지 없이 값과 조합된 링크를 목록에 표시한다', async () => {
    const html = String(
      await MemoBoardPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        memos,
        settings: memoSettings,
        patterns: memoPatterns,
      }),
    )

    expect(html).toContain('개인 전용')
    expect(html).toContain('상품 번호')
    expect(html).toContain('검색어')
    expect(html).toContain('https://example.com/items/00123?from=memo')
    expect(html).toContain('https://example.com/search?q=%ED%95%9C%EA%B8%80%20%EB%8B%A8%EC%96%B4&amp;from=memo')
    expect(html).toContain('https://shop.example.com/products/ABC-42?ref=memo')
    expect(html).toContain('자동 (숫자/문자 판별)')
    expect(html).toContain('상품 상세')
    expect(html).toContain('action="/memos/1/delete"')
    expect(html).not.toContain('/memos/1"')
  })

  it('개인 이미지 목록에 캐시 URL, 복사 버튼, 복사 이력 아이콘을 표시한다', async () => {
    const html = String(
      await PrivateImagesPage({
        appName: 'Private Board',
        deployInfo,
        user: { ...user, imageStorageEnabled: true },
        csrfToken: 'csrf-test',
        images: privateImages.map((image) => ({
          image,
          cacheUrl: `https://images.example.com/${image.object_key}`,
        })),
      }),
    )

    expect(html).toContain('개인 이미지 저장')
    expect(html).toContain('파일당 최대 5MiB')
    expect(html).toContain('data-image-file')
    expect(html).toContain('https://images.example.com/private-images/one.png')
    expect(html).toContain('data-image-copy')
    expect(html).toContain('>복사</button>')
    expect(html).toContain('복사 이력 있음')
    expect(html).toContain('data-image-id="11"')
  })

  it('관리자 설정에서 기본 비활성 이미지 기능을 수동 활성화할 수 있다', async () => {
    const html = String(
      await AdminPage({
        appName: 'Private Board',
        deployInfo,
        user: adminUser,
        csrfToken: 'csrf-test',
        imageStorageEnabled: false,
        r2Configured: false,
      }),
    )

    expect(html).toContain('관리자 전용')
    expect(html).toContain('관리자 설정')
    expect(html).toContain('>비활성</strong>')
    expect(html).toContain('name="enabled" value="true"')
    expect(html).toContain('이미지 기능 활성화')
    expect(html).toContain('미설정 · 활성화 후 업로드 시 오류 toast 표시')
    expect(html).not.toContain('href="/images"')
  })

  it('이미지 기능이 활성화되면 메뉴와 관리자 비활성화 동작을 표시한다', async () => {
    const html = String(
      await AdminPage({
        appName: 'Private Board',
        deployInfo,
        user: { ...adminUser, imageStorageEnabled: true },
        csrfToken: 'csrf-test',
        imageStorageEnabled: true,
        r2Configured: true,
      }),
    )

    expect(html).toContain('href="/images"')
    expect(html).toContain('>활성</strong>')
    expect(html).toContain('name="enabled" value="false"')
    expect(html).toContain('이미지 기능 비활성화')
    expect(html).toContain('>준비됨</dd>')
  })

  it('숫자와 문자 메모 값은 사용자별 URL 규칙으로 구분해 조합한다', () => {
    expect(composeMemoUrl('42', memoSettings)).toBe('https://example.com/items/42?from=memo')
    expect(composeMemoUrl('한글 단어', memoSettings)).toBe(
      'https://example.com/search?q=%ED%95%9C%EA%B8%80%20%EB%8B%A8%EC%96%B4&from=memo',
    )
    expect(composeMemoUrl('값', { ...memoSettings, text_prefix: '', text_suffix: '' })).toBeNull()
    expect(composeMemoUrl('ABC-42', memoSettings, memoPatterns[0]!)).toBe(
      'https://shop.example.com/products/ABC-42?ref=memo',
    )
    expect(composeMemoUrl('42', memoSettings, memoPatterns[0]!)).toBe(
      'https://shop.example.com/products/42?ref=memo',
    )
  })

  it('메모 설정에서 사용자 패턴을 추가·수정·삭제할 수 있다', async () => {
    const html = String(
      await MemoSettingsPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        settings: memoSettings,
        patterns: memoPatterns,
      }),
    )

    expect(html).toContain('숫자·문자 자동 판별')
    expect(html).toContain('내 패턴')
    expect(html).toContain('action="/memos/patterns"')
    expect(html).toContain('action="/memos/patterns/7/update"')
    expect(html).toContain('action="/memos/patterns/7/delete"')
    expect(html).toContain('상품 상세')
  })
})
