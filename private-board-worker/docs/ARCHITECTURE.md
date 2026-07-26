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
| 공용 게시판 | `/boards/free`, `/boards/inquiry` | 인증 필요 |
| 게시글·댓글 | `/posts/*`, `/comments/*` | 인증 필요 |
| 개인 메모 | `/memos`, `/memos/settings` | 인증 필요, 소유자 제한 |
| 개인 티켓 | `/tickets`, `/api/tickets/order` | 인증 필요, 소유자 제한 |
| 계정 | `/account` | 인증 필요 |

## 데이터 모델

```text
users
  ├─ auth_accounts
  ├─ sessions
  ├─ posts ── comments
  ├─ private_memos
  ├─ user_memo_settings
  └─ tickets

boards
  └─ posts
```

`boards`에는 마이그레이션에서 `free`, `inquiry` 두 행을 고정 등록합니다.

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

개인 메모와 URL 설정도 동일하게 클라이언트의 사용자 ID를 받지 않고 인증 컨텍스트의 ID로만 조회·변경합니다. URL 설정은 숫자와 문자 유형별 앞부분·뒷부분을 사용자마다 한 행으로 저장하며, 완성된 주소는 `http` 또는 `https` 프로토콜인지 다시 검증합니다.

## 보안 헤더

- `Content-Security-Policy`
- `img-src 'none'`
- `frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cache-Control: private, no-store` for HTML/API
- `Strict-Transport-Security` for HTTPS
- `X-Robots-Tag: noindex`

Turnstile을 켠 경우에만 Cloudflare challenge origin을 script, connect, frame source에 추가합니다.

## 의도적으로 제외한 기능

- 이미지와 첨부파일
- 외부 Markdown HTML
- 실시간 협업과 WebSocket
- 티켓 담당자, 댓글, 체크리스트, 파일, 반복 일정
- 공개 검색과 검색엔진 인덱싱
- 비공개 문의 권한 모델
- 계정 비밀번호와 이메일 발송

이 범위를 유지하면 Worker와 D1 한 개로 운영 복잡도를 낮출 수 있습니다.
