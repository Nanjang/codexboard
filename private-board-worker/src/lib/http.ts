import type { AppContext } from '../types'

const NOTICE_MESSAGES: Record<string, string> = {
  'post-created': '게시글을 등록했습니다.',
  'post-updated': '게시글을 수정했습니다.',
  'post-deleted': '게시글을 삭제했습니다.',
  'comment-created': '댓글을 등록했습니다.',
  'comment-updated': '댓글을 수정했습니다.',
  'comment-deleted': '댓글을 삭제했습니다.',
  'ticket-created': '작업 티켓을 추가했습니다.',
  'ticket-updated': '작업 티켓을 수정했습니다.',
  'ticket-deleted': '작업 티켓을 삭제했습니다.',
  'ticket-moved': '작업 상태를 변경했습니다.',
  'memo-created': '메모를 저장했습니다.',
  'memo-deleted': '메모를 삭제했습니다.',
  'memo-settings-updated': '메모 URL 설정을 저장했습니다.',
  'memo-pattern-created': '메모 패턴을 추가했습니다.',
  'memo-pattern-updated': '메모 패턴을 수정했습니다.',
  'memo-pattern-deleted': '메모 패턴을 삭제했습니다. 이 패턴을 사용하던 메모는 자동 판별로 전환되었습니다.',
  'nickname-updated': '닉네임을 변경했습니다.',
  'widget-added': '대시보드에 위젯을 추가했습니다.',
  'widget-removed': '대시보드에서 위젯을 제거했습니다.',
  'image-storage-enabled': '개인 이미지 저장 기능을 활성화했습니다.',
  'image-storage-disabled': '개인 이미지 저장 기능을 비활성화했습니다.',
  'logged-out': '로그아웃했습니다.',
}

export function noticeFromRequest(c: AppContext): string | null {
  const notice = c.req.query('notice')
  return notice ? NOTICE_MESSAGES[notice] ?? null : null
}

export function redirectWithNotice(c: AppContext, path: string, notice: keyof typeof NOTICE_MESSAGES): Response {
  const url = new URL(path, c.req.url)
  url.searchParams.set('notice', notice)
  return c.redirect(`${url.pathname}${url.search}`, 303)
}

export function acceptsJson(c: AppContext): boolean {
  return c.req.path.startsWith('/api/') || c.req.header('Accept')?.includes('application/json') === true
}
