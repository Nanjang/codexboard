# Google OAuth 서비스 등록

이 애플리케이션은 Google의 Authorization Code 흐름과 OpenID Connect를 사용합니다. 요청 scope는 `openid email`이며 Google 비밀번호, 프로필 사진, Google API 접근용 refresh token은 저장하지 않습니다.

## 1. 프로젝트 준비

Google Cloud Console에서 새 프로젝트를 만들거나 전용 프로젝트를 선택합니다.

```text
https://console.cloud.google.com/
```

운영 서비스와 다른 실험용 프로젝트를 분리하면 비밀값 회전과 권한 관리가 쉬워집니다.

## 2. OAuth 동의 화면

Google Auth Platform 또는 OAuth consent screen 메뉴에서 다음을 설정합니다.

- 앱 이름
- 사용자 지원 이메일
- 개발자 연락처
- 앱 홈페이지 URL
- 개인정보처리방침 URL
- 이용약관 URL
- 대상 사용자: Internal 또는 External

이 저장소에서 공개 가능한 기본 URL은 다음과 같습니다.

```text
https://board.example.com/login
https://board.example.com/privacy
https://board.example.com/terms
```

`External` 앱을 테스트 상태로 유지하면 Google Console에 등록한 테스트 사용자만 로그인할 수 있습니다. 조직 전용 서비스이고 Google Workspace 정책이 허용한다면 `Internal`을 선택할 수 있습니다.

## 3. 데이터 접근 범위

앱은 다음 기본 OpenID Connect scope만 요청합니다.

```text
openid
email
```

Drive, Calendar, Gmail 등 추가 scope는 필요하지 않습니다. 소스의 scope를 임의로 넓히면 사용자 동의 및 검토 범위가 달라질 수 있습니다.

## 4. OAuth 클라이언트 생성

Clients 또는 Credentials 메뉴에서 OAuth Client를 만듭니다.

```text
Application type: Web application
```

승인된 리디렉션 URI를 등록합니다.

로컬:

```text
http://localhost:8787/auth/google/callback
```

운영:

```text
https://board.example.com/auth/google/callback
```

운영 도메인을 바꾸면 Google Console과 Cloudflare `BASE_URL`을 함께 바꿔야 합니다. 와일드카드나 비슷한 경로가 아니라 실제 callback URL을 정확히 등록하세요.

## 5. Client ID와 Client Secret 저장

로컬 개발에서는 Git에서 제외되는 `.dev.vars`에만 저장합니다.

```dotenv
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="..."
```

운영에서는 저장소나 GitHub Repository Variable에 넣지 않고 Cloudflare Worker Secrets에 등록합니다. 최초 배포는 [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md)의 `.env.production`과 `--secrets-file` 절차를 사용하고, 이후 회전할 때는 다음 명령을 사용합니다.

```bash
npx wrangler secret put GOOGLE_CLIENT_ID --config wrangler.jsonc
npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.jsonc
```

각 명령이 값을 물으면 붙여 넣습니다. 명령 인수에 비밀값을 직접 쓰지 않으면 셸 기록에 값이 남지 않습니다.

## 6. 앱 내부 검증

콜백에서 다음 항목을 서버 측으로 확인합니다.

- 서명 키와 JWT 알고리즘
- 발급자 `iss`
- 이 앱의 Client ID인 `aud`
- 만료시간 및 토큰 나이
- 로그인 요청별 `nonce`
- OAuth 요청별 `state`
- PKCE `code_verifier`
- 확인된 이메일 여부
- 사용자 고유 식별자 `sub`

회원 연결 키는 변경될 수 있는 이메일이 아니라 `provider=google`과 `sub` 조합입니다.

## 7. 가입 범위 설정

Google 인증 성공이 곧 서비스 이용 허용을 의미하지는 않습니다. Cloudflare 런타임 설정으로 별도 제한합니다.

### 누구나 가입

```text
REGISTRATION_MODE=open
```

### 지정 이메일만 가입

```text
REGISTRATION_MODE=allowlist
ALLOWED_EMAILS=one@example.com,two@example.com
```

### 지정 Google Workspace 도메인만 가입

```text
REGISTRATION_MODE=domain
ALLOWED_DOMAINS=example.com,subsidiary.example
```

도메인 모드는 이메일 문자열의 끝부분만 비교하지 않고 Google ID 토큰의 `hd` 클레임을 검사합니다. 일반 `@gmail.com` 계정에는 `hd`가 없으므로 허용되지 않습니다.

## 8. 비밀값 유출 시

1. Google Cloud Console에서 기존 Client Secret을 즉시 폐기하거나 회전합니다.
2. 새 값을 Cloudflare Worker Secret과 로컬 `.dev.vars`에 반영합니다.
3. Git 기록에서 지우기 전에 먼저 폐기해야 합니다. 기록을 다시 써도 이미 복제된 비밀값은 안전해지지 않습니다.
4. 관련 접속 로그와 비정상 로그인 시도를 확인합니다.

## 공식 문서

- OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
- OAuth 2.0 Web Server 흐름: https://developers.google.com/identity/protocols/oauth2/web-server
- OAuth 동의 화면과 scope: https://developers.google.com/workspace/guides/configure-oauth-consent
