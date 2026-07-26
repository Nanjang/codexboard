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
  PrivateImageRow,
  TicketRow,
} from '../src/types'
import { BoardListPage } from '../src/views/boards'
import { DashboardPage } from '../src/views/dashboard'
import { PublicErrorPage } from '../src/views/errors'
import { LoginPage } from '../src/views/login'
import { PrivateImagesPage } from '../src/views/images'
import { composeMemoUrl, MemoBoardPage, MemoSettingsPage } from '../src/views/memos'
import { TicketsPage } from '../src/views/tickets'

const user: CurrentUser = {
  id: 'user-1',
  nickname: '테스트회원',
  role: 'user',
  status: 'active',
  email: 'member@example.com',
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
    sort_order: 1000,
    created_at: 1,
  },
  {
    id: 3,
    user_id: user.id,
    widget_type: 'rss',
    title: '개발 소식',
    url: 'https://example.com/feed.xml',
    sort_order: 3000,
    created_at: 1,
  },
  {
    id: 2,
    user_id: user.id,
    widget_type: 'bookmark',
    title: '내 문서',
    url: 'https://example.com/docs',
    sort_order: 2000,
    created_at: 1,
  },
]

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
    expect(html).toContain('현재 자유게시판 요약, URL 북마크, RSS 최신 글 위젯을 지원합니다.')
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

  it('비로그인 화면에는 로그인 요구 내용만 렌더링한다', async () => {
    const html = String(await LoginPage({ appName: 'Private Board', deployInfo }))
    expect(html).toContain('Google 계정으로 로그인')
    expect(html).toContain('로그인 전에는 서비스 내용이 공개되지 않습니다')
    expect(html).toContain('deploy 0d2e4a11')
    expect(html).toContain('2026. 07. 25. 17:28 KST')
    expect(html).not.toContain('data-ticket-board')
    expect(html).not.toContain('<img')
  })

  it('인증 화면은 문맥형 탑바와 오른쪽 단일 메뉴 토글을 포함한다', async () => {
    const html = String(
      await TicketsPage({
        appName: 'Private Board',
        deployInfo,
        user,
        csrfToken: 'csrf-test',
        tickets: [ticket],
      }),
    )
    expect(html).toContain('topbar-title">내 작업')
    expect(html.match(/data-menu-toggle/g)).toHaveLength(1)
    expect(html).toContain('티켓 추가')
    expect(html).toContain('자유게시판')
    expect(html).toContain('문의')
    expect(html).toContain('문서 검토')
    expect(html).not.toContain('<img')
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
        user,
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
