import { describe, expect, it } from 'vitest'
import type {
  BoardRow,
  CurrentUser,
  DashboardWidgetRow,
  DeployInfo,
  PostListRow,
  TicketRow,
} from '../src/types'
import { BoardListPage } from '../src/views/boards'
import { DashboardPage } from '../src/views/dashboard'
import { PublicErrorPage } from '../src/views/errors'
import { LoginPage } from '../src/views/login'
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
    id: 2,
    user_id: user.id,
    widget_type: 'bookmark',
    title: '내 문서',
    url: 'https://example.com/docs',
    sort_order: 2000,
    created_at: 1,
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
      }),
    )

    expect(html).toContain('테스트회원님의 대시보드')
    expect(html).toContain('자유게시판 요약')
    expect(html).toContain('내 문서')
    expect(html).toContain('https://example.com/docs')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('data-dialog-open="widget-add-dialog"')
    expect(html).toContain('현재 자유게시판 요약과 URL 북마크 위젯을 지원합니다.')
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
})
