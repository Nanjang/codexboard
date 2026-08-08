# 설치 및 로컬 실행

이 문서는 새 개발 환경에서 저장소를 설치하고 Google 로그인까지 로컬에서 확인하는 절차입니다. 운영 배포는 [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md)를 따릅니다.

## 1. 준비 사항

- Node.js 22 이상
- npm 10 이상 권장
- Cloudflare 계정
- Google Cloud 프로젝트를 만들 수 있는 계정
- Git

버전을 확인합니다.

```bash
node --version
npm --version
git --version
```

## 2. 저장소 설치

```bash
git clone <YOUR_REPOSITORY_URL>
cd private-board-worker
npm ci
```

커밋 직전에 비밀정보 검사와 정적 자산 manifest 갱신·검증을 자동 실행하려면 저장소 전용 Git hook을 활성화합니다.

```bash
git config core.hooksPath private-board-worker/.githooks
```

## 3. Cloudflare 로그인과 D1 생성

```bash
npx wrangler login
npx wrangler whoami
npx wrangler d1 create private-board-db
```

출력에서 다음 값을 기록합니다.

```text
database_name = private-board-db
database_id   = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

`database_id`를 사용해 실제 Wrangler 설정을 생성합니다.

```bash
D1_DATABASE_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
WORKER_NAME="private-board-worker" \
D1_DATABASE_NAME="private-board-db" \
AUTH_RATE_LIMIT_NAMESPACE="41001" \
WRITE_RATE_LIMIT_NAMESPACE="41002" \
npm run config:render
```

두 Rate Limiting namespace는 Cloudflare 계정 안에서 사용하는 서로 다른 양의 정수 문자열입니다. 다른 Worker에서 같은 번호를 이미 사용한다면 다른 번호를 선택하세요.

생성되는 `wrangler.jsonc`는 권한 `0600`으로 기록되고 `.gitignore`에 포함됩니다.

## 4. Google OAuth 로컬 클라이언트 등록

[GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md)의 절차로 `Web application` OAuth 클라이언트를 만듭니다. 로컬 리디렉션 URI는 정확히 다음 값입니다.

```text
http://localhost:8787/auth/google/callback
```

운영 URL은 나중에 별도로 추가할 수 있습니다.

## 5. 로컬 환경 파일

예시를 복사합니다.

```bash
cp .dev.vars.example .dev.vars
```

세션 비밀값을 생성합니다. 출력값을 터미널이나 메신저에 공유하지 마세요.

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

`.dev.vars`를 편집합니다.

```dotenv
BASE_URL="http://localhost:8787"
GOOGLE_CLIENT_ID="발급받은-클라이언트-ID"
GOOGLE_CLIENT_SECRET="발급받은-클라이언트-보안-비밀"
SESSION_SECRET="방금-생성한-무작위-값"

APP_NAME="Private Board"
REGISTRATION_MODE="allowlist"
ALLOWED_EMAILS="your-account@example.com"
ALLOWED_DOMAINS=""
ADMIN_EMAILS="your-account@example.com"
SESSION_DAYS="14"
CONTACT_EMAIL="operator@example.com"

TURNSTILE_SITE_KEY=""
TURNSTILE_SECRET_KEY=""
```

초기 테스트라도 외부 사용자가 접속하지 못하게 하려면 `REGISTRATION_MODE="allowlist"`와 본인의 이메일을 사용하는 편이 안전합니다.

`.dev.vars`는 절대로 `git add -f`로 추가하지 마세요.

## 6. 로컬 데이터베이스 생성

```bash
npm run db:migrate:local
npm run db:migrations:list:local
```

마이그레이션은 `.wrangler/` 아래의 로컬 D1에 적용됩니다. 이 디렉터리도 Git에서 제외됩니다.

## 7. 실행

```bash
npm run dev
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:8787
```

비로그인 상태에서는 손님용 루트의 자유게시판·개발·뉴스 최근 글 미리보기와 로그인, 법적 문서를 볼 수 있습니다. 게시판과 게시글 상세는 Google 인증 후 열립니다.

## 8. 개발 중 검사

```bash
npm run check
npm run deploy:dry
```

`npm run check`는 다음을 순서대로 수행합니다.

1. 비밀정보 의심 패턴 검사
2. SortableJS를 포함한 브라우저 스크립트 번들
3. `public` 정적 자산 manifest 최신 상태 검사
4. TypeScript 엄격 타입 검사
5. Vitest 테스트

## 9. 초기화

로컬 D1 데이터를 완전히 지우고 처음부터 시작하려면 개발 서버를 중지한 뒤 `.wrangler/`를 삭제하고 마이그레이션을 다시 적용합니다.

```bash
rm -rf .wrangler
npm run db:migrate:local
```

Windows PowerShell에서는 다음을 사용합니다.

```powershell
Remove-Item -Recurse -Force .wrangler
npm run db:migrate:local
```

운영 D1에는 이 명령을 적용하지 마세요.

## 문제 해결

### `redirect_uri_mismatch`

Google Cloud의 승인된 리디렉션 URI와 `BASE_URL + /auth/google/callback`이 문자 단위로 일치해야 합니다. 포트, HTTP/HTTPS, 마지막 경로를 확인하세요.

### `D1_DATABASE_ID가 없거나 UUID 형식이 아닙니다`

`wrangler d1 create` 출력의 ID를 `D1_DATABASE_ID`로 전달해 `npm run config:render`를 다시 실행하세요.

### 로그인 후 허용 대상이 아니라는 메시지

`REGISTRATION_MODE`, `ALLOWED_EMAILS`, `ALLOWED_DOMAINS`를 확인하세요. 이메일은 쉼표로 구분하며 대소문자는 구분하지 않습니다.

### 로컬에서 쿠키가 보이지 않음

로컬에서는 `dev-session` 쿠키를 사용합니다. 운영 HTTPS에서는 `__Host-session`으로 자동 전환됩니다. `BASE_URL`을 실제 접속 주소와 동일하게 유지하세요.
