import { describe, expect, it } from 'vitest'
import type {
  AdminMemberActivityRow,
  AdminMemberRow,
  BoardRow,
  CurrentUser,
  DashboardWidgetRow,
  DeployInfo,
  DevlogImageCacheFileStatsRow,
  DevlogImageCacheRequestRow,
  MemoRow,
  MemoUrlPatternRow,
  MemoUrlSettings,
  PersonalBookmarkRow,
  PostListRow,
  PostDetailRow,
  PrivateImageRow,
  TicketRow,
  TrashedTicketRow,
  VisitorPageViewRow,
} from '../src/types'
import type { ThemeLibrary } from '../src/lib/themes'
import { BUILTIN_THEMES } from '../src/lib/themes'
import { AccountPage } from '../src/views/account'
import type { DatabaseUsageStats } from '../src/lib/database-usage'
import { AdminDatabasePage, AdminPage } from '../src/views/admin'
import { AdminMemberActivityPage, AdminMembersPage } from '../src/views/admin-members'
import { AdminVisitorLogsPage } from '../src/views/admin-visitors'
import { BoardListPage, PostDetailPage, PostFormPage } from '../src/views/boards'
import { DeployFooter } from '../src/views/components'
import { DevlogExportPage, DevlogPostPage, UserDevlogPage } from '../src/views/devlogs'
import { DashboardPage } from '../src/views/dashboard'
import { AppErrorPage, PublicErrorPage } from '../src/views/errors'
import { GuestHomePage } from '../src/views/home'
import { DevlogImageCacheFilesPage, DevlogImageCacheRequestsPage } from '../src/views/image-cache'
import { LoginPage } from '../src/views/login'
import { PrivateImagesPage } from '../src/views/images'
import { PersonalBookmarksPage } from '../src/views/personal-bookmarks'
import { composeMemoUrl, MemoBoardPage, MemoSettingsPage } from '../src/views/memos'
import { TicketTagsPage, TicketsPage, TicketTrashPage } from '../src/views/tickets'

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

const personalBookmark: PersonalBookmarkRow = {
  id: 41,
  user_id: user.id,
  content: '배포 체크리스트',
  url: 'https://example.com/deploy',
  icon_content_type: 'image/png',
  sort_order: 101000,
  created_at: 1,
  updated_at: 1,
}

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
    link_mode: 'auto',
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
    link_mode: 'auto',
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
    link_mode: 'custom',
    pattern_id: memoPatterns[0]!.id,
    pattern_name: memoPatterns[0]!.name,
    pattern_prefix: memoPatterns[0]!.prefix,
    pattern_suffix: memoPatterns[0]!.suffix,
    created_at: 3,
    updated_at: 3,
  },
  {
    id: 4,
    owner_id: user.id,
    memo: '링크 없는 메모',
    value: '본문만 저장',
    link_mode: 'none',
    pattern_id: null,
    pattern_name: null,
    pattern_prefix: null,
    pattern_suffix: null,
    created_at: 4,
    updated_at: 4,
  },
  {
    id: 5,
    owner_id: user.id,
    memo: '직접 링크',
    value: 'https://example.com/direct-link',
    link_mode: 'link',
    pattern_id: null,
    pattern_name: null,
    pattern_prefix: null,
    pattern_suffix: null,
    created_at: 5,
    updated_at: 5,
  },
]

const privateImages: PrivateImageRow[] = [
  {
    id: 10,
    owner_id: user.id,
    object_key: 'private-images/one.png',
    image_hash: 'a'.repeat(64),
    extension: 'png',
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
    image_hash: 'b'.repeat(64),
    extension: 'webp',
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
  it('개인 북마크를 한 줄 메모장 목록과 페이지 이동 영역으로 표시한다', async () => {
    const html = String(
      await PersonalBookmarksPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        bookmarks: {
          items: [personalBookmark],
          page: 2,
          pageSize: 100,
          totalItems: 101,
          totalPages: 2,
        },
        creationRequestId: ticketCreationRequestId,
      }),
    )

    expect(html).toContain('개인 북마크')
    expect(html).toContain('나만 보는 링크 메모장')
    expect(html).toContain('data-personal-bookmarks')
    expect(html).toContain('data-page="2"')
    expect(html).toContain('data-personal-bookmark-list')
    expect(html).toContain('data-personal-bookmark-id="41"')
    expect(html).toContain('id="personal-bookmark-41"')
    expect(html).toContain('배포 체크리스트')
    expect(html).toContain('href="https://example.com/deploy"')
    expect(html).toContain('src="/personal-bookmarks/41/icon"')
    expect(html).toContain('personal-bookmark-drag-handle')
    expect(html).toContain('앞 페이지로 보내기')
    expect(html).toContain('data-personal-bookmark-previous-drop')
    expect(html).toContain('2 / 2페이지')
    expect(html).toContain('href="/personal-bookmarks?page=1"')
    expect(html).toContain('enctype="multipart/form-data"')
    expect(html).toContain('accept="image/png,image/jpeg,image/webp,image/gif,image/avif"')
    expect(html).not.toContain('아이콘 URL')
  })

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

    expect(html).toContain('class="eyebrow dashboard-home-title"')
    expect(html).toContain('테스트회원님의 개인 홈')
    expect(html).toContain('aria-describedby="dashboard-home-description"')
    expect(html).toContain('id="dashboard-home-description"')
    expect(html).toContain('role="tooltip"')
    expect(html).toContain('자주 확인하는 정보를 위젯으로 구성하는 나만의 첫 화면입니다.')
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
    expect(html).toContain('class="button button-secondary dashboard-bookmark-add-button"')
    expect(html).toContain('aria-label="북마크 추가"')
    expect(html).toContain('title="북마크 추가"')
    expect(html).toContain('<span aria-hidden="true">+</span>')
    expect(html).not.toContain('북마크끼리 순서를 바꿀 수 있습니다.')
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
    expect(html).toContain('class="gear-icon dashboard-edit-icon"')
    expect(html).toContain('src="/assets/gear-tilted.png"')
    expect(html).toContain('aria-label="대시보드 편집"')
    expect(html).toContain('title="대시보드 편집"')
    expect(html).not.toContain('data-dashboard-edit-label')
    expect(html).not.toContain('>대시보드 편집</span>')
    expect(html).toContain('data-dashboard-save-status')
    expect(html).toContain('data-dashboard-widget-id="1"')
    expect(html).toContain('data-dashboard-widget-id="2"')
    expect(html).toContain('data-dashboard-widget-id="3"')
    expect(html).toContain('data-dashboard-move="-1"')
    expect(html).toContain('data-dashboard-move="1"')
    expect(html).toContain('class="dashboard-remove-icon"')
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

  it('출처 검사 상세 정보는 관리자 오류 화면에만 표시한다', async () => {
    const props = {
      appName: 'Private Board',
      deployInfo,
      title: '접근할 수 없습니다',
      message: '허용되지 않은 요청 출처입니다.',
      status: 403,
      csrfToken: 'csrf-test',
      adminDetails: [
        { label: '실패한 검사', value: '요청 URL Origin' },
        { label: '설정된 BASE_URL Origin', value: 'https://board.oc7.workers.dev' },
      ],
    }
    const adminHtml = String(await AppErrorPage({ ...props, user: adminUser }))
    const userHtml = String(await AppErrorPage({ ...props, user }))

    expect(adminHtml).toContain('관리자용 오류 상세')
    expect(adminHtml).toContain('https://board.oc7.workers.dev')
    expect(adminHtml).toContain('쿠키, 세션, CSRF 및 업로드 토큰 원문은 보안상 표시하지 않습니다.')
    expect(userHtml).not.toContain('관리자용 오류 상세')
    expect(userHtml).not.toContain('https://board.oc7.workers.dev')
  })

  it('북마크 아이콘 실패 사유는 관리자 오류 화면에만 표시한다', async () => {
    const props = {
      appName: 'Private Board',
      deployInfo,
      title: '요청을 확인해 주세요',
      message: '아이콘 URL에서 지원하는 이미지를 가져오지 못했습니다.',
      status: 400,
      csrfToken: 'csrf-test',
      adminDetails: [
        { label: '실패 단계', value: '응답 검증' },
        { label: '실패 사유', value: '지원하지 않는 Content-Type' },
        { label: 'HTTP 상태', value: '200' },
        { label: 'Content-Type', value: 'text/html' },
      ],
    }
    const adminHtml = String(await AppErrorPage({ ...props, user: adminUser }))
    const userHtml = String(await AppErrorPage({ ...props, user }))

    expect(adminHtml).toContain('관리자용 오류 상세')
    expect(adminHtml).toContain('지원하지 않는 Content-Type')
    expect(adminHtml).toContain('text/html')
    expect(userHtml).toContain(props.message)
    expect(userHtml).not.toContain('관리자용 오류 상세')
    expect(userHtml).not.toContain('지원하지 않는 Content-Type')
    expect(userHtml).not.toContain('text/html')
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
    expect(html).toContain('data-database-usage')
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

  it('개발일지 편집기에 간결한 공개 여부와 커서 위치 이미지 도구를 표시한다', async () => {
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
        imageUploadEnabled: true,
      }),
    )

    expect(html).toContain('data-devlog-editor-form')
    expect(html).toContain('data-image-upload-url="/api/devlog/images"')
    expect(html).toContain('contenteditable')
    expect(html).toContain('role="radiogroup" aria-labelledby="visibility-label"')
    expect(html).toContain('공개 여부')
    expect(html).toContain('name="visibility" value="public"')
    expect(html).toContain('name="visibility" value="private" checked')
    expect(html).toContain('name="title" aria-label="제목"')
    expect(html).not.toContain('<span>제목</span>')
    expect(html).not.toContain('<span class="field-label">내용</span>')
    expect(html).not.toContain('로그인하지 않은 방문자도 읽을 수 있습니다.')
    expect(html).not.toContain('작성자와 관리자만 읽을 수 있습니다.')
    expect(html).toContain('data-editor-image')
    expect(html).toContain('이미지는 현재 커서 위치에 삽입됩니다.')
    expect(html).toContain('2MiB 미만 클립보드 이미지는 바로 붙여넣을 수 있습니다.')
    expect(html).toContain('accept="image/jpeg,image/png,image/webp,image/gif,image/avif"')
    expect(html).not.toContain('data-preview-image-reset')
  })

  it('renders the fixed preview reset submit control only for an editable fixed preview', async () => {
    const previewImageUrl = `/devlog-images/i/${'a'.repeat(64)}.png`
    const currentFirstImageUrl = `/devlog-images/i/${'b'.repeat(64)}.gif`
    const developmentBoard: BoardRow = {
      ...board,
      id: 2,
      slug: 'development',
      name: '개발일지',
    }
    const editPost: PostDetailRow = {
      ...post,
      board_id: developmentBoard.id,
      board_slug: developmentBoard.slug,
      board_name: developmentBoard.name,
      body: `<p>수정 중입니다.</p><img src="${currentFirstImageUrl}">`,
      body_format: 'rich',
      visibility: 'private',
      preview_image_url: previewImageUrl,
    }
    const html = String(
      await PostFormPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        board: developmentBoard,
        mode: 'edit',
        post: editPost,
        imageUploadEnabled: true,
      }),
    )

    expect(html).toContain('data-preview-image-reset')
    expect(html).toContain(`data-fixed-preview-image="${previewImageUrl}"`)
    expect(html).toContain('name="previewImageAction" value="reset-current"')
    expect(html).toContain('hidden')
    expect(html).toContain('미리보기 이미지 재설정')
  })

  it('자유게시판도 이미지 붙여넣기를 지원하는 리치 편집기를 표시한다', async () => {
    const html = String(
      await PostFormPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        board,
        mode: 'create',
        imageUploadEnabled: true,
      }),
    )

    expect(html).toContain('data-rich-editor-form')
    expect(html).toContain('data-image-upload-url="/api/images"')
    expect(html).toContain('data-rich-editor')
    expect(html).toContain('data-editor-image')
    expect(html).toContain('클립보드 이미지는 바로 붙여넣을 수 있습니다.')
    expect(html).not.toContain('name="visibility"')
  })

  it('자유게시판의 정제된 리치 본문을 HTML로 렌더링한다', async () => {
    const richPost: PostDetailRow = {
      ...post,
      body: `<p>원하는 위치입니다.</p><figure class="devlog-image"><img src="/i/${'a'.repeat(64)}.png"></figure>`,
      body_format: 'rich',
      visibility: 'public',
      preview_image_url: null,
    }
    const html = String(
      await PostDetailPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        post: richPost,
        comments: [],
      }),
    )

    expect(html).toContain('<p>원하는 위치입니다.</p>')
    expect(html).toContain(`src="/i/${'a'.repeat(64)}.png"`)
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
      preview_image_url: null,
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

  it('관리 가능한 개발일지는 수정 정보 오른쪽 톱니바퀴에 개별 내보내기를 접는다', async () => {
    const html = String(
      await DevlogPostPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        post: {
          ...post,
          board_id: 2,
          board_slug: 'development',
          board_name: '개발일지',
          body: '<p>수정된 기록입니다.</p>',
          body_format: 'rich',
          visibility: 'private',
          preview_image_url: null,
          updated_at: post.created_at + 1_000,
        },
      }),
    )

    const updatedPosition = html.indexOf('수정됨')
    const togglePosition = html.indexOf('class="icon-button devlog-archive-toggle devlog-post-export-toggle"')
    expect(updatedPosition).toBeGreaterThan(-1)
    expect(togglePosition).toBeGreaterThan(updatedPosition)
    expect(html).toContain('aria-controls="devlog-post-export-panel"')
    expect(html).toContain('data-toggle-label="개별 Markdown 내보내기"')
    expect(html).toContain('class="gear-icon" src="/assets/gear-tilted.png"')
    expect(html).toContain('id="devlog-post-export-panel"')
    expect(html).toContain('개별 Markdown 보관')
    expect(html).toContain(`/devlogs/u/${user.id}/posts/${post.id}/export.md`)
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
            body: `<p>초안입니다.</p><img src="/devlog-images/i/${'a'.repeat(64)}.webp">`,
            body_format: 'rich',
            visibility: 'private',
            preview_image_url: `/devlog-images/i/${'b'.repeat(64)}.gif`,
          },
          {
            ...post,
            id: 2,
            board_id: 2,
            board_slug: 'development',
            board_name: '개발일지',
            body: `<p>기존 글입니다.</p><img src="/devlog-images/i/${'c'.repeat(64)}.avif">`,
            body_format: 'rich',
            visibility: 'public',
            preview_image_url: null,
          },
        ],
        hasMore: false,
      }),
    )

    expect(html).toContain('href="/boards/development/new"')
    expect(html).toContain('visibility-badge">비공개')
    expect(html).toContain(`/devlogs/u/${user.id}/posts/${post.id}`)
    expect(html).toContain(`class="devlog-post-card-preview"`)
    expect(html).toContain(`src="/devlog-images/i/${'b'.repeat(64)}.gif"`)
    expect(html).toContain(`src="/devlog-images/i/${'c'.repeat(64)}.avif"`)
    expect(html).toContain(`href="/devlogs/u/${user.id}/export"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('data-devlog-archive-toggle')
    expect(html).toContain('aria-controls="devlog-archive-panel"')
    expect(html).toContain('class="gear-icon" src="/assets/gear-tilted.png"')
    expect(html).toContain('data-devlog-archive-panel')
    expect(html).toContain('개발일지 전체 보관')
    expect(html).toContain('Markdown ZIP 내보내기')
    expect(html).not.toContain('class="devlog-archive-export"')
  })

  it('공개 개발일지 목록에서는 전체 ZIP 내보내기를 노출하지 않는다', async () => {
    const html = String(
      await UserDevlogPage({
        appName: 'Private Board',
        deployInfo,
        user: undefined,
        csrfToken: undefined,
        author: { id: user.id, nickname: user.nickname, role: user.role },
        posts: [
          {
            ...post,
            board_id: 2,
            board_slug: 'development',
            board_name: '개발일지',
            body: '<p>공개 기록입니다.</p>',
            body_format: 'rich',
            visibility: 'public',
            preview_image_url: null,
          },
        ],
        hasMore: false,
      }),
    )

    expect(html).not.toContain(`/devlogs/u/${user.id}/export`)
    expect(html).not.toContain('data-devlog-archive-toggle')
    expect(html).not.toContain('data-devlog-archive-panel')
  })

  it('개발일지 내보내기 화면에는 개수 진행률만 표시한다', async () => {
    const html = String(
      await DevlogExportPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        author: { id: user.id, nickname: user.nickname, role: user.role },
        totalCount: 124,
        snapshotMaxId: 321,
        archiveFilename: 'user-1-devlog-markdown.zip',
      }),
    )

    expect(html).toContain('data-devlog-export')
    expect(html).toContain('data-total-count="124"')
    expect(html).toContain('data-snapshot-max-id="321"')
    expect(html).toContain('data-archive-filename="user-1-devlog-markdown.zip"')
    expect(html).toContain('0 / 124')
    expect(html).toContain('게시물 내용은 이 화면에 표시하지 않습니다.')
    expect(html).not.toContain('<ul')
    expect(html).not.toContain('<ol')
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
    expect(html).toContain('개인 북마크')
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
        tickets: [
          {
            ...ticket,
            tags: [
              {
                id: 7,
                owner_id: user.id,
                name: '긴급',
                color: 'coral',
                created_at: 1,
                updated_at: 1,
              },
            ],
          },
        ],
        availableTags: [
          {
            id: 7,
            owner_id: user.id,
            name: '긴급',
            color: 'coral',
            created_at: 1,
            updated_at: 1,
          },
        ],
        creationRequestId: ticketCreationRequestId,
      }),
    )

    expect(html).toContain(`name="creation_request_id" value="${ticketCreationRequestId}"`)
    expect(html).toContain('data-prevent-double-submit')
    expect(html).toContain('href="/tickets/trash"')
    expect(html).toContain('href="/tickets/tags"')
    expect(html).toContain('class="ticket-tag ticket-tag-color-coral"')
    expect(html).toContain('data-ticket-tag-ids="7"')
    expect(html).toContain('class="ticket-drop-zone"')
    expect(html).toContain('name="tag_ids"')
    expect(html).toContain('aria-label="문서 검토 수정"')
    expect(html).not.toContain('>열기</a>')
    expect(html).not.toContain('ticket-card-footer')
    expect(html).not.toContain('ticket-move-actions')
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

  it('개인 티켓 태그 관리 화면은 생성·삭제 폼과 색상 토큰을 표시한다', async () => {
    const html = String(
      await TicketTagsPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        tags: [
          {
            id: 7,
            owner_id: user.id,
            name: '긴급',
            color: 'coral',
            created_at: 1,
            updated_at: 1,
          },
        ],
      }),
    )

    expect(html).toContain('action="/tickets/tags"')
    expect(html).toContain('name="color"')
    expect(html).toContain('value="coral"')
    expect(html).toContain('class="ticket-tag ticket-tag-color-coral"')
    expect(html).toContain('action="/tickets/tags/7/delete"')
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
    expect(html).toContain('href="https://example.com/direct-link"')
    expect(html).toContain('>링크</span>')
    expect(html).toMatch(/<option value="none" selected[^>]*>없음<\/option>/u)
    expect(html).toContain('자동 (숫자/문자 판별)')
    const bodyOnlyMemoMarker = html.indexOf('링크 없는 메모')
    const bodyOnlyMemoStart = html.lastIndexOf('<article class="memo-row"', bodyOnlyMemoMarker)
    const bodyOnlyMemoEnd = html.indexOf('</article>', bodyOnlyMemoMarker)
    const bodyOnlyMemo = html.slice(bodyOnlyMemoStart, bodyOnlyMemoEnd + '</article>'.length)
    expect(bodyOnlyMemo).toContain('본문만 저장')
    expect(bodyOnlyMemo).toContain('없음')
    expect(bodyOnlyMemo).not.toContain('memo-value-link')
    expect(bodyOnlyMemo).toContain('memo-value-dialog-trigger')
    expect(bodyOnlyMemo).toContain('data-dialog-open="memo-value-dialog-4"')
    expect(html).toContain('id="memo-value-dialog-4"')
    expect(html).toContain('class="memo-value-dialog-value">본문만 저장')
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
    expect(html).toContain('action="/images/11/delete"')
    expect(html).toContain('보관함에서 삭제')
    expect(html).toContain('원본 이미지는 삭제되지 않습니다')
  })

  it('관리자 설정에서 통합 이미지 서비스의 VPC 연결 상태를 표시한다', async () => {
    const html = String(
      await AdminPage({
        appName: 'Private Board',
        deployInfo,
        user: adminUser,
        csrfToken: 'csrf-test',
        imageServiceBound: false,
      }),
    )

    expect(html).toContain('관리자 전용')
    expect(html).toContain('관리자 설정')
    expect(html).toContain('통합 이미지 서비스')
    expect(html).toContain('VPC 미연결')
    expect(html).toContain('IMAGE_VAULT 바인딩 필요')
    expect(html).toContain('href="/admin/image-cache/requests"')
    expect(html).toContain('href="/admin/image-cache/files"')
    expect(html).not.toContain('href="/images"')
  })

  it('통합 이미지 서비스가 활성화되면 메뉴와 통합 비활성화 동작을 표시한다', async () => {
    const html = String(
      await AdminPage({
        appName: 'Private Board',
        deployInfo,
        user: { ...adminUser, imageStorageEnabled: true },
        csrfToken: 'csrf-test',
        imageServiceBound: true,
        imageService: { configured: true, enabled: true, updatedAt: Date.now() },
      }),
    )

    expect(html).toContain('href="/images"')
    expect(html).toContain('>활성</strong>')
    expect(html).toContain('name="enabled" value="false"')
    expect(html).toContain('통합 이미지 서비스 비활성화')
    expect(html).toContain('>준비됨</dd>')
    expect(html).toContain('aria-label="통합 이미지 캐시 통계"')
    expect(html.match(/최근 캐시 요청/g)).toHaveLength(1)
    expect(html.match(/파일별 캐시 통계/g)).toHaveLength(1)
  })

  it('관리자 설정에서 회원 정보 조회 화면으로 이동할 수 있다', async () => {
    const html = String(
      await AdminPage({
        appName: 'Private Board',
        deployInfo,
        user: adminUser,
        csrfToken: 'csrf-test',
      }),
    )

    expect(html).toContain('D1 · 조회 전용')
    expect(html).toContain('회원 정보 보기')
    expect(html).toContain('href="/admin/members"')
  })

  it('관리자 설정에는 DB 사용량 요약만 표시하고 상세 화면으로 연결한다', async () => {
    const databaseUsage: DatabaseUsageStats = {
      databaseSizeBytes: 925_700,
      databaseLimitBytes: 500_000_000,
      databasePercent: 0.18514,
      totalRows: 9,
      tables: [
        { name: 'posts', rowCount: 7 },
        { name: 'users', rowCount: 2 },
      ],
      measuredAt: Date.UTC(2026, 7, 4),
      account: {
        usedBytes: 3_180_000,
        limitBytes: 5_000_000_000,
        percent: 0.0636,
        databaseCount: 4,
        measuredAt: Date.UTC(2026, 7, 4),
      },
      accountStatus: 'available',
    }

    const html = String(
      await AdminPage({
        appName: 'Private Board',
        deployInfo,
        user: adminUser,
        csrfToken: 'csrf-test',
        databaseUsage,
      }),
    )

    expect(html).toContain('925.7 KB / 500.00 MB (0.19%)')
    expect(html).toContain('href="/admin/database"')
    expect(html).not.toContain('계정 D1 저장 용량')
    expect(html).not.toContain('전체 행 수')
  })

  it('DB 사용량 상세 화면에서 계정 전체와 테이블별 통계를 표시한다', async () => {
    const databaseUsage: DatabaseUsageStats = {
      databaseSizeBytes: 925_700,
      databaseLimitBytes: 500_000_000,
      databasePercent: 0.18514,
      totalRows: 9,
      tables: [
        { name: 'posts', rowCount: 7 },
        { name: 'users', rowCount: 2 },
      ],
      measuredAt: Date.UTC(2026, 7, 4),
      account: {
        usedBytes: 3_180_000,
        limitBytes: 5_000_000_000,
        percent: 0.0636,
        databaseCount: 4,
        measuredAt: Date.UTC(2026, 7, 4),
      },
      accountStatus: 'available',
    }

    const html = String(
      await AdminDatabasePage({
        appName: 'Private Board',
        deployInfo,
        user: adminUser,
        csrfToken: 'csrf-test',
        databaseUsage,
      }),
    )

    expect(html).toContain('DB 사용량 상세')
    expect(html).toContain('계정 D1 저장 용량')
    expect(html).toContain('3.18 MB 사용 / 5.00 GB 한도 · 4/10개 데이터베이스')
    expect(html).toContain('posts')
    expect(html).not.toContain('이 게시판 DB가 계정 전체에서 차지하는 비율')
    expect(html).toContain('href="/admin"')
  })

  it('공통 푸터에 오늘과 누적 방문자 카운터 자리를 표시한다', async () => {
    const html = String(await DeployFooter({ deployInfo }))

    expect(html).toContain('class="visitor-footer"')
    expect(html).toContain('data-visitor-today')
    expect(html).toContain('data-visitor-total')
    expect(html).toContain('data-database-usage')
    expect(html).toContain('data-database-usage-bar')
    expect(html).toContain('data-database-usage-tooltip')
    expect(html).toContain('title="사용량 확인 중"')
    expect(html).not.toContain('style=')
    expect(html.indexOf('data-database-usage')).toBeGreaterThan(html.indexOf(deployInfo.displayTimestamp))
    expect(html).toContain('오늘')
    expect(html).toContain('누적')
    expect(html).not.toContain('aria-hidden="true" class="deploy-footer"')
  })

  it('관리자 설정에서 방문자 접속 기록으로 이동할 수 있다', async () => {
    const html = String(
      await AdminPage({
        appName: 'Private Board',
        deployInfo,
        user: adminUser,
        csrfToken: 'csrf-test',
      }),
    )

    expect(html).toContain('방문자 접속 기록')
    expect(html).toContain('href="/admin/visitors"')
    expect(html).toContain('접속 기록 보기')
  })

  it('관리자에게 IP와 Referer 전체가 포함된 접속 기록을 표시한다', async () => {
    const log: VisitorPageViewRow = {
      id: 91,
      visit_day: '2026-07-30',
      visited_at: Date.UTC(2026, 6, 30, 3),
      ip_address: '2001:db8::91',
      referer: 'https://search.example.com/results?q=전체+원문&token=visible-to-admin',
      user_agent: 'Visitor Browser/2.0',
      path: '/devlogs?page=2',
      user_id: null,
      response_status: 200,
    }
    const html = String(
      await AdminVisitorLogsPage({
        appName: 'Private Board',
        deployInfo,
        user: adminUser,
        csrfToken: 'csrf-test',
        chart: {
          range: 'week',
          periodLabel: '2026. 07. 23. 13:00 ~ 2026. 07. 30. 12:59',
          bucketLabel: '1시간',
          peakCount: 3,
          buckets: Array.from({ length: 168 }, (_, index) => ({
            startAt: Date.UTC(2026, 6, 23, 4) + index * 3_600_000,
            label: `7. ${23 + Math.floor(index / 24)}. ${String(index % 24).padStart(2, '0')}시`,
            count: index === 167 ? 3 : 0,
          })),
        },
        logs: {
          items: [log],
          page: 1,
          pageSize: 50,
          totalItems: 51,
          totalPages: 2,
        },
      }),
    )

    expect(html).toContain('2001:db8::91')
    expect(html).toContain('search.example.com/results?q=전체+원문&amp;token=visible-to-admin')
    expect(html).toContain('Visitor Browser/2.0')
    expect(html).toContain('>비회원</td>')
    expect(html).toContain('유니크 방문자')
    expect(html).toContain('한 칸 1시간')
    expect(html).toContain('aria-current="page">주간</a>')
    expect(html.match(/class="visitor-series-bar/g)?.length).toBe(168)
    expect(html).not.toContain('style=')
    expect(html).toContain('href="/admin/visitors?range=week&amp;page=2"')
  })

  it('회원 DB 정보와 각 회원의 최근 활동 링크를 표시한다', async () => {
    const member: AdminMemberRow = {
      id: 'member/one',
      nickname: '첫회원',
      email: 'first@example.com',
      email_hidden: 1,
      role: 'user',
      status: 'active',
      created_at: Date.UTC(2026, 6, 1, 1),
      updated_at: Date.UTC(2026, 6, 20, 2),
      post_count: 12,
      comment_count: 34,
      last_seen_at: Date.UTC(2026, 6, 29, 3),
      last_activity_at: Date.UTC(2026, 6, 28, 4),
    }
    const html = String(
      await AdminMembersPage({
        appName: 'Private Board',
        deployInfo,
        user: adminUser,
        csrfToken: 'csrf-test',
        members: {
          items: [member],
          page: 2,
          pageSize: 50,
          totalItems: 51,
          totalPages: 2,
        },
      }),
    )

    expect(html).toContain('D1에 저장된 계정 정보')
    expect(html).toContain('first@example.com')
    expect(html).toContain('프로필 비공개')
    expect(html).toContain('>12 / 34</td>')
    expect(html).toContain('href="/admin/members/member%2Fone/activity"')
    expect(html).toContain('href="/admin/members?page=1"')
  })

  it('회원의 게시글과 댓글 활동을 최신 활동 페이지에 표시한다', async () => {
    const member: AdminMemberRow = {
      id: 'member-1',
      nickname: '활동회원',
      email: 'activity@example.com',
      email_hidden: 0,
      role: 'user',
      status: 'active',
      created_at: Date.UTC(2026, 5, 1),
      updated_at: Date.UTC(2026, 6, 1),
      post_count: 1,
      comment_count: 1,
      last_seen_at: null,
      last_activity_at: Date.UTC(2026, 6, 29),
    }
    const activities: AdminMemberActivityRow[] = [
      {
        kind: 'comment',
        activity_id: 81,
        post_id: 7,
        post_author_id: 'author-1',
        board_slug: 'free',
        post_title: '자유게시판 글',
        body: '최근 댓글 본문',
        status: 'published',
        visibility: 'private',
        created_at: Date.UTC(2026, 6, 29),
        updated_at: Date.UTC(2026, 6, 29),
      },
      {
        kind: 'post',
        activity_id: 6,
        post_id: 6,
        post_author_id: member.id,
        board_slug: 'development',
        post_title: '비공개 개발 기록',
        body: '개발 기록 본문',
        status: 'published',
        visibility: 'private',
        created_at: Date.UTC(2026, 6, 28),
        updated_at: Date.UTC(2026, 6, 28),
      },
    ]
    const html = String(
      await AdminMemberActivityPage({
        appName: 'Private Board',
        deployInfo,
        user: adminUser,
        csrfToken: 'csrf-test',
        member,
        activities: {
          items: activities,
          page: 1,
          pageSize: 50,
          totalItems: 2,
          totalPages: 1,
        },
      }),
    )

    expect(html).toContain('회원 활동 히스토리')
    expect(html).toContain('최근 댓글 본문')
    expect(html).toContain('href="/posts/7#comment-81"')
    expect(html).toContain('href="/devlogs/u/member-1/posts/6"')
    expect(html).toContain('>비공개</span>')
    expect(html).toContain('총 2건 · 1/1페이지')
  })

  it('최근 개발일지 이미지 요청의 캐시 결과와 페이지 이동을 표시한다', async () => {
    const requests: DevlogImageCacheRequestRow[] = [
      {
        id: 1000,
        image_hash: 'a1b4093f8da2e457974b57ab9f069cbc2282d25de2126bf51b7d1c93e4bb508f',
        extension: 'png',
        method: 'GET',
        cache_status: 'HIT',
        response_status: 200,
        duration_ms: 4,
        colo: 'ICN',
        created_at: Date.UTC(2026, 6, 29, 10, 0),
      },
      {
        id: 999,
        image_hash: 'aad479229ef2485e45b4654c60ad4c539d792cfc18e187f76fe62655654d30c4',
        extension: 'png',
        method: 'HEAD',
        cache_status: 'MISS',
        response_status: 404,
        duration_ms: 18,
        colo: null,
        created_at: Date.UTC(2026, 6, 29, 9, 59),
      },
    ]

    const html = String(
      await DevlogImageCacheRequestsPage({
        appName: 'Private Board',
        deployInfo,
        user: adminUser,
        csrfToken: 'csrf-test',
        requests: {
          items: requests,
          page: 2,
          pageSize: 50,
          totalItems: 125,
          totalPages: 3,
        },
      }),
    )

    expect(html).toContain('최근 캐시 요청')
    expect(html).toContain('a1b4093f8da2e457974b57ab9f069cbc2282d25de2126bf51b7d1c93e4bb508f.png')
    expect(html).toContain('cache-status-hit')
    expect(html).toContain('>HIT</strong>')
    expect(html).toContain('cache-status-miss')
    expect(html).toContain('>MISS</strong>')
    expect(html).toContain('>ICN</td>')
    expect(html).toContain('href="/admin/image-cache/requests?page=1"')
    expect(html).toContain('href="/admin/image-cache/requests?page=3"')
    expect(html).toContain('총 125건 · 2/3페이지')
  })

  it('개발일지 이미지 파일별 히트율과 페이지 이동을 표시한다', async () => {
    const files: DevlogImageCacheFileStatsRow[] = [
      {
        image_hash: 'a1b4093f8da2e457974b57ab9f069cbc2282d25de2126bf51b7d1c93e4bb508f',
        extension: 'png',
        hit_count: 9,
        miss_count: 1,
        request_count: 10,
        last_cache_status: 'HIT',
        last_response_status: 200,
        last_accessed_at: Date.UTC(2026, 6, 29, 10, 0),
      },
    ]

    const html = String(
      await DevlogImageCacheFilesPage({
        appName: 'Private Board',
        deployInfo,
        user: adminUser,
        csrfToken: 'csrf-test',
        files: {
          items: files,
          page: 1,
          pageSize: 50,
          totalItems: 51,
          totalPages: 2,
        },
      }),
    )

    expect(html).toContain('파일별 캐시 통계')
    expect(html).toContain('>10</td>')
    expect(html).toContain('>9</td>')
    expect(html).toContain('>1</td>')
    expect(html).toContain('>90.0%</td>')
    expect(html).toContain('>HIT</strong>')
    expect(html).toContain('href="/admin/image-cache/files?page=2"')
    expect(html).toContain('총 51건 · 1/2페이지')
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
