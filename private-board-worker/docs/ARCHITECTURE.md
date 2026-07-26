# 구조와 접근 제어

## 요청 흐름

```text
브라우저
  ├─ /login, /privacy, /terms, /assets/*
  │      └─ 공개 경로
  │
  └─ 나머지 모든 경로
         └─ Worker 보안 미들웨어
              ├─ 세션 쿠키 해시 → D1 세션 조회
              ├─ 계정 상태 확인
              ├─ CSRF / Same-Origin / Rate Limit
              └─ Hono 라우트와 JSX 응답
```

`assets.run_worker_first=true`이므로 정적 자산 요청도 Worker를 먼저 통과합니다. 공개 자산에는 게시글이나 티켓 데이터가 들어 있지 않습니다.

## 주요 경로

| 구분 | 경로 | 공개 여부 |
|---|---|---|
| 로그인 | `/login` | 공개 |
| OAuth 시작·콜백 | `/auth/google/start`, `/auth/google/callback` | 공개 |
| 법적 문서 | `/privacy`, `/terms` | 공개 |
| 상태 확인 | `/health` | 공개 |
| 공용 게시판 | `/boards/free`, `/boards/development`, `/boards/news`, `/boards/inquiry` | 인증 필요 |
| 손님용 홈 | `/` | 인증 불필요, 자유게시판·개발·뉴스 최근 글 5건 미리보기 |
| 게시글·댓글 | `/posts/*`, `/comments/*` | 인증 필요 |
| 개인 메모 | `/memos`, `/memos/settings` | 인증 필요, 소유자 제한 |
| 개인 티켓 | `/tickets`, `/api/tickets/order` | 인증 필요, 소유자 제한 |
| 개인 이미지 | `/images`, `/api/images/*` | 인증 필요, 소유자 제한 |
| 관리자 설정 | `/admin`, `/admin/features/*` | 관리자만 |
| 계정 | `/account` | 인증 필요 |

## 데이터 모델

```text
users
  ├─ auth_accounts
  ├─ sessions
  ├─ custom_themes
  ├─ user_shared_themes
  ├─ user_theme_preferences
  ├─ posts ── comments
  ├─ private_memos
  ├─ user_memo_settings
  ├─ memo_url_patterns
  ├─ tickets
  └─ private_images

boards
  └─ posts

feature_settings
  └─ private_images (기본 비활성)
```

`boards`에는 마이그레이션에서 `free`, `development`, `news`, `inquiry` 네 행을 고정 등록합니다.

## 인증과 세션

1. OAuth 요청마다 `state`, `nonce`, PKCE verifier를 생성합니다.
2. 값은 10분짜리 서명된 HttpOnly 쿠키에 저장합니다.
3. Google callback에서 state와 nonce를 검증하고 code를 교환합니다.
4. ID 토큰 서명, issuer, audience, 만료, 이메일 확인 여부를 검증합니다.
5. Google `sub`로 회원을 찾거나 생성합니다.
6. 무작위 게시판 세션 토큰을 발급합니다.
7. 브라우저에는 원문을, D1에는 SHA-256 해시만 저장합니다.
8. CSRF 토큰은 세션 토큰과 서버 비밀값의 HMAC으로 파생합니다.

운영 HTTPS에서는 `__Host-session`, 로컬 HTTP에서는 `dev-session` 쿠키를 사용합니다.

## 이메일 개인정보 경계

이메일은 OAuth 계정 식별, 가입 허용 정책과 본인 계정 화면에만 사용합니다. 게시글·댓글·공유 테마 쿼리는 작성자의 닉네임과 역할만 선택하고 이메일을 선택하지 않습니다. 공개 응답과 타인용 데이터 타입에도 이메일 필드가 없습니다.

`users.email_hidden`은 기본값 `1`입니다. 가림 상태에서는 서버 렌더링 단계에서 이메일 문자열을 출력하지 않고 대각선 패턴 자리표시자만 렌더링합니다. 사용자는 CSRF 검증된 본인 계정 설정 요청으로만 이 값을 변경할 수 있습니다.

## 공용 리소스 권한

게시글과 댓글은 로그인 회원 모두 읽을 수 있습니다. 수정·삭제는 다음 조건입니다.

```text
작성자 본인 OR role=admin
```

사용자 입력은 Prepared Statement의 bind 값으로만 SQL에 전달됩니다. 화면 출력은 Hono JSX가 이스케이프하며 사용자 HTML을 해석하지 않습니다.

## 개인 티켓 권한

클라이언트는 `owner_id`를 보내지 않습니다. 모든 쿼리는 서버의 인증 컨텍스트에서 얻은 ID를 추가합니다.

```sql
SELECT ... FROM tickets
WHERE owner_id = ?;

UPDATE tickets SET ...
WHERE id = ? AND owner_id = ?;

DELETE FROM tickets
WHERE id = ? AND owner_id = ?;
```

드래그 정렬 API는 전송된 모든 티켓 ID가 현재 사용자의 전체 티켓 집합과 정확히 일치하는지 확인한 뒤 D1 batch로 순서를 갱신합니다.

개인 메모와 URL 설정도 동일하게 클라이언트의 사용자 ID를 받지 않고 인증 컨텍스트의 ID로만 조회·변경합니다. URL 설정은 숫자와 문자 유형별 자동 패턴을 사용자마다 한 행으로 저장하고, 추가 사용자 패턴은 `memo_url_patterns`에 저장합니다. 메모의 `pattern_id`가 비어 있으면 숫자·문자를 자동 판별하며, 값이 있으면 반드시 현재 사용자가 소유한 패턴인지 확인한 뒤 저장합니다. 완성된 주소는 `http` 또는 `https` 프로토콜인지 다시 검증합니다.

## 개인 색상 테마

내장 테마는 Worker 코드에 읽기 전용 프리셋으로 포함됩니다. 사용자가 개인 테마를 만들면 현재 선택된 팔레트를 `custom_themes`에 복제하고, 선택 상태는 `user_theme_preferences`에 저장합니다.

공유 코드로 가져온 테마는 복사본을 만들지 않고 `user_shared_themes`에서 원본 `custom_themes.id`를 참조합니다. 따라서 원소유자의 수정이 다음 테마 CSS 요청부터 그대로 적용됩니다. 원본 삭제 전 트리거는 해당 테마를 사용 중인 다른 회원을 기본 테마로 전환하고 `orphan_notice_pending`을 설정합니다. 다음 문서 요청 하나가 이 값을 원자적으로 소비하여 안내 팝업을 한 번만 표시합니다.

사용자 팔레트는 인라인 스타일 대신 인증된 `/account/theme.css` 응답으로 전달합니다. 이 경로는 기존 `style-src 'self'` CSP를 유지하면서 CSS 사용자 정의 속성만 출력합니다.

## 개인 이미지 흐름

```text
브라우저 ── 업로드 메타데이터 ──> Worker ── presigned PUT URL
브라우저 ── 이미지 본문 ───────> R2 S3 API
브라우저 <─ 공개 캐시 URL ───── R2 Custom Domain + Cloudflare Cache
```

Worker는 세션 소유자를 기준으로 D1의 `private_images` 행을 만들고, 5분짜리 presigned URL을 반환합니다. 브라우저 업로드가 끝나면 Worker가 R2 `HEAD` 요청으로 MIME과 크기를 다시 확인한 뒤 `ready` 상태로 바꿉니다. 이미지 목록·완료·취소·복사 이력 쿼리는 모두 `owner_id`를 현재 세션 ID와 함께 조건으로 사용합니다.

객체 키는 사용자 ID를 직접 노출하지 않는 무작위 불변 키입니다. 목록은 본인 전용이지만 Custom Domain URL은 공개 읽기 경로이며, 복사 이력 아이콘은 권한 전환이 아니라 공유 여부를 알려 주는 기록입니다.

`feature_settings.private_images`는 마이그레이션에서 `0`으로 생성됩니다. 인증 요청마다 현재 값을 읽어 비활성 상태에서는 메뉴를 숨기고 `/images`와 모든 `/api/images/*` 요청을 거절합니다. 관리자만 CSRF 검증을 거쳐 `/admin`에서 이 값을 변경할 수 있습니다. 기능 비활성화는 새 조회·업로드 경로를 닫는 동작이며 이미 공유된 공개 R2 URL을 폐기하지는 않습니다.

## 보안 헤더

- `Content-Security-Policy`
- R2 미설정 시 `img-src 'none'`, 설정 시 정확한 R2 공개 origin만 허용
- `frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cache-Control: private, no-store` for HTML/API
- `Strict-Transport-Security` for HTTPS
- `X-Robots-Tag: noindex`

Turnstile을 켠 경우에만 Cloudflare challenge origin을 script, connect, frame source에 추가합니다.

## 의도적으로 제외한 기능

- 게시글·댓글의 이미지와 첨부파일
- 외부 Markdown HTML
- 실시간 협업과 WebSocket
- 티켓 담당자, 댓글, 체크리스트, 파일, 반복 일정
- 공개 검색과 검색엔진 인덱싱
- 비공개 문의 권한 모델
- 계정 비밀번호와 이메일 발송

이 범위를 유지하면 Worker와 D1 한 개로 운영 복잡도를 낮출 수 있습니다.
