import { describe, expect, it } from 'vitest'
import type { CurrentUser, DeployInfo, TicketRow } from '../src/types'
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

describe('핵심 화면', () => {
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
