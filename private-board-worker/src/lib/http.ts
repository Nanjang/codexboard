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
  'ticket-deleted': '작업 티켓을 휴지통으로 이동했습니다. 14일 후 영구 삭제됩니다.',
  'ticket-restored': '작업 티켓을 복원했습니다.',
  'ticket-purged': '작업 티켓을 영구 삭제했습니다.',
  'ticket-moved': '작업 상태를 변경했습니다.',
  'memo-created': '메모를 저장했습니다.',
  'memo-deleted': '메모를 삭제했습니다.',
  'memo-settings-updated': '메모 URL 설정을 저장했습니다.',
  'memo-pattern-created': '메모 패턴을 추가했습니다.',
  'memo-pattern-updated': '메모 패턴을 수정했습니다.',
  'memo-pattern-deleted': '메모 패턴을 삭제했습니다. 이 패턴을 사용하던 메모는 자동 판별로 전환되었습니다.',
  'nickname-updated': '닉네임을 변경했습니다.',
  'email-privacy-updated': '이메일 정보 가림 설정을 변경했습니다.',
  'theme-selected': '사용할 색상 테마를 변경했습니다.',
  'theme-created': '현재 테마를 복제해 개인 테마를 만들었습니다.',
  'theme-imported': '공유 테마를 가져와 적용했습니다.',
  'theme-updated': '개인 테마의 이름과 색상을 저장했습니다.',
  'theme-published': '테마를 공개했습니다. 표시된 공유 코드를 전달할 수 있습니다.',
  'theme-deleted': '개인 테마를 삭제했습니다.',
  'widget-added': '대시보드에 위젯을 추가했습니다.',
  'widget-removed': '대시보드에서 위젯을 제거했습니다.',
  'bookmark-added': '북마크를 추가했습니다.',
  'bookmark-updated': '북마크 정보를 저장했습니다.',
  'bookmark-icon-refreshed': '북마크 정보와 사이트 아이콘을 저장했습니다.',
  'bookmark-icon-unavailable': '북마크 정보는 저장했지만 사이트 아이콘을 가져오지 못했습니다.',
  'personal-bookmark-added': '개인 북마크를 추가했습니다.',
  'personal-bookmark-updated': '개인 북마크를 저장했습니다.',
  'personal-bookmark-deleted': '개인 북마크를 삭제했습니다.',
  'private-image-deleted': '보관함 기록을 삭제했습니다. 업로드된 원본 이미지는 유지됩니다.',
  'image-service-saved': '통합 이미지 서비스를 확인하고 활성화했습니다.',
  'image-service-enabled': '통합 이미지 서비스를 활성화했습니다.',
  'image-service-disabled': '통합 이미지 서비스를 비활성화했습니다.',
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
