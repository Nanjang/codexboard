# Cloudflare 등록 및 운영 배포

이 문서는 D1 생성, 운영 Secret 등록, 최초 배포, Custom Domain, Workers VPC 이미지 서비스, GitHub Actions 연결 순서까지 다룹니다.

개인 이미지 저장 기능을 사용할 때 필요한 R2 버킷·CORS·Custom Domain·자격증명 설정은 [R2 개인 이미지 저장소 설정](R2_IMAGE_STORAGE_SETUP.md)을 함께 진행하세요. R2 Secret이 없어도 Worker는 배포되지만 이미지 업로드만 설정 오류 toast로 거절됩니다.

## 1. 운영 주소 결정

Google OAuth를 등록하기 전에 운영 `BASE_URL`을 정합니다.

Workers 개발 도메인을 먼저 사용할 때:

```text
https://private-board-worker.<YOUR_WORKERS_SUBDOMAIN>.workers.dev
```

Custom Domain을 사용할 때:

```text
https://board.example.com
```

`BASE_URL`에는 경로와 마지막 슬래시를 넣지 않습니다. Google callback은 항상 다음 형식입니다.

```text
<BASE_URL>/auth/google/callback
```

처음에는 `workers.dev` 주소로 배포·검증한 뒤 Custom Domain으로 전환해도 됩니다.

## 2. Cloudflare 인증과 D1 생성

```bash
npx wrangler login
npx wrangler whoami
npx wrangler d1 create private-board-db
```

출력된 D1 UUID를 사용해, Git에서 제외되는 실제 `wrangler.jsonc`를 생성합니다.

```bash
D1_DATABASE_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
WORKER_NAME="private-board-worker" \
D1_DATABASE_NAME="private-board-db" \
AUTH_RATE_LIMIT_NAMESPACE="41001" \
WRITE_RATE_LIMIT_NAMESPACE="41002" \
IMAGE_VAULT_VPC_SERVICE_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
npm run config:render
```

Rate Limiting namespace ID는 Cloudflare 계정 안에서 고유한 양의 정수 문자열이어야 하며 두 바인딩은 서로 다른 값을 사용해야 합니다.
자체 이미지 서비스를 아직 연결하지 않았다면 `IMAGE_VAULT_VPC_SERVICE_ID`는 생략합니다.

## 3. Google OAuth 운영 URL 등록

[GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md)의 절차에 따라 Web application OAuth Client를 만들고 승인된 리디렉션 URI를 추가합니다.

```text
https://board.example.com/auth/google/callback
```

`workers.dev` 주소를 먼저 사용한다면 그 주소의 callback도 별도로 등록합니다. 동의 화면의 홈페이지, 개인정보처리방침, 이용약관 URL 역시 실제 운영 주소로 입력합니다.

## 4. 최초 배포용 Secret 파일 준비

최초 배포는 코드와 Worker Secret을 한 번에 올리는 방식을 권장합니다. 저장소에서 무시되는 `.env.production`을 만듭니다.

```bash
cp .dev.vars.example .env.production
chmod 600 .env.production
```

`.env.production`을 운영 값으로 편집합니다.

```dotenv
BASE_URL="https://board.example.com"
GOOGLE_CLIENT_ID="발급받은-클라이언트-ID"
GOOGLE_CLIENT_SECRET="발급받은-클라이언트-보안-비밀"
SESSION_SECRET="충분히-긴-무작위-값"

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

`SESSION_SECRET`은 최소 32자이며 48바이트 이상의 무작위 값을 권장합니다.

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

폐쇄형 서비스라면 최초 배포부터 `REGISTRATION_MODE="allowlist"` 또는 `domain`을 사용하세요. `open`은 Google 계정이 있는 모든 사용자의 가입을 허용합니다.

> `.env.production`은 `.gitignore`의 `.env.*` 규칙으로 제외됩니다. `git add -f`로 추가하거나 메신저·이슈·CI 로그에 내용을 붙여 넣지 마세요.

## 5. 검사, 운영 D1 마이그레이션, 최초 배포

먼저 소스와 Cloudflare 번들 설정을 검사합니다.

```bash
npm run check
npm run deploy:dry
```

운영 D1에 적용될 마이그레이션을 확인한 뒤 적용합니다.

```bash
npm run db:migrations:list:remote
npm run db:migrate:remote
```

코드와 `.env.production`의 값을 Cloudflare Worker Secrets로 함께 배포합니다.

```bash
npx wrangler deploy \
  --config wrangler.jsonc \
  --secrets-file .env.production
```

Cloudflare는 `--secrets-file`에 포함되지 않은 기존 Secret을 보존합니다. 최초 배포가 완료된 뒤에는 `.env.production`을 암호화된 비밀 저장소에 이동하거나 안전하게 삭제하세요. 이 파일은 GitHub Actions에 올리지 않습니다.

현재 Secret 이름을 확인할 수 있으며 값은 출력되지 않습니다.

```bash
npx wrangler secret list --config wrangler.jsonc
```

배포 후 다음 경로를 확인합니다.

```text
/health
/login
/privacy
/terms
```

비로그인 상태에서 `/`에 자유게시판·개발·뉴스 최근 글 미리보기가 표시되고, `/boards/free`, `/boards/development`, `/boards/news`, `/boards/inquiry`, `/tickets`, `/account`가 `/login`으로 이동하는지도 확인합니다.

## 6. 이후 Secret 변경과 회전

이미 Worker가 만들어진 뒤에는 값을 명령 인수에 넣지 말고 `wrangler secret put`의 입력 프롬프트를 사용합니다.

```bash
npx wrangler secret put GOOGLE_CLIENT_ID --config wrangler.jsonc
npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.jsonc
npx wrangler secret put SESSION_SECRET --config wrangler.jsonc
```

`BASE_URL`은 Cloudflare Dashboard의 Worker **Variables and Secrets**에서 일반 평문 변수로 설정합니다. 저장소의 Wrangler 템플릿에는 넣지 않으며, Actions 배포의 `--keep-vars`가 기존 값을 유지합니다.

선택 설정도 공개 평문 설정 대신 Worker Secret으로 관리할 수 있습니다.

```bash
npx wrangler secret put APP_NAME --config wrangler.jsonc
npx wrangler secret put REGISTRATION_MODE --config wrangler.jsonc
npx wrangler secret put ALLOWED_EMAILS --config wrangler.jsonc
npx wrangler secret put ALLOWED_DOMAINS --config wrangler.jsonc
npx wrangler secret put ADMIN_EMAILS --config wrangler.jsonc
npx wrangler secret put SESSION_DAYS --config wrangler.jsonc
npx wrangler secret put CONTACT_EMAIL --config wrangler.jsonc
```

Turnstile을 사용할 때만 두 값을 모두 등록합니다.

```bash
npx wrangler secret put TURNSTILE_SITE_KEY --config wrangler.jsonc
npx wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.jsonc
```

`wrangler secret put`은 새 Worker 버전을 만들고 즉시 배포합니다. `SESSION_SECRET`을 바꾸면 기존 세션 쿠키는 더 이상 검증되지 않아 모든 사용자가 다시 로그인해야 합니다.

## 7. Custom Domain 연결

Cloudflare Dashboard의 Worker 설정에서 Custom Domain을 연결합니다. 연결 후 다음 값을 같은 도메인으로 맞춥니다.

1. Cloudflare Worker 일반 변수 `BASE_URL`
2. Google 승인된 리디렉션 URI
3. Google 동의 화면의 홈페이지·정책 URL

예를 들어 `https://board.example.com`으로 전환했다면:

```text
BASE_URL=https://board.example.com
redirect URI=https://board.example.com/auth/google/callback
```

도메인을 변경하면 기존 도메인의 세션 쿠키는 새 도메인으로 이전되지 않으므로 사용자는 다시 로그인합니다.

## 8. 로그 확인

```bash
npx wrangler tail --config wrangler.jsonc
```

OAuth code, ID token, 세션 쿠키, 사용자 이메일 전체가 포함된 요청을 이슈나 채팅에 복사하지 마세요. 애플리케이션 오류 로그는 인증 토큰 원문을 의도적으로 출력하지 않습니다.

## 9. 자체 이미지 서비스를 Workers VPC로 연결

라즈베리파이 이미지 서비스를 사용할 때만 진행합니다. Named Tunnel에는 공개 Route나 도메인을 추가하지 않아도 됩니다.

1. 라즈베리파이의 `cloudflared` 터널이 `Healthy`인지 확인합니다.
2. Cloudflare Dashboard의 **Workers VPC → Services**에서 HTTP VPC Service를 만듭니다.
3. Tunnel은 라즈베리파이에 설치한 Named Tunnel, Host는 `localhost`, HTTP Port는 `8085`로 설정합니다.
4. 생성된 Service ID를 복사합니다.
5. 아래 GitHub Environment 변수에 Service ID를 등록하고 Worker를 다시 배포합니다.

```text
IMAGE_VAULT_VPC_SERVICE_ID=<VPC-Service-UUID>
```

배포 후 Worker 설정에 `IMAGE_VAULT` VPC Service 바인딩이 표시되어야 합니다. `/admin`의 **개발일지 이미지 서비스**에 라즈베리파이와 동일한 `IMAGE_SERVICE_TOKEN`을 입력하면 Worker가 VPC를 통해 `/health`를 검사하고 기능을 활성화합니다.

외부 브라우저는 게시판 Worker만 호출합니다.

```text
업로드:     POST https://<게시판-Worker>/api/devlog/images
이미지 조회: GET https://<게시판-Worker>/devlog-images/i/<sha256>.webp
내부 전달:  IMAGE_VAULT binding → http://localhost:8085
```

GitHub Actions용 Cloudflare API Token의 소유 사용자에게는 기존 VPC Service를 Worker에 연결할 수 있는 `Connectivity Directory Bind` 역할이 필요합니다. VPC Service 자체를 만들거나 수정하는 계정에는 `Connectivity Directory Admin` 역할이 필요합니다.

라즈베리파이 설치와 환경 변수는 [Raspberry Pi image service](../../raspberry-image-service/README.md)를 참고하세요.

## 10. GitHub Actions 배포

저장소의 `.github/workflows/private-board-worker.yml`은 `main` 브랜치의 Worker 관련 변경을 push하는 즉시 검사, D1 마이그레이션, Worker 배포를 수행합니다. Pull Request에서는 검사만 수행합니다. 먼저 위의 수동 최초 배포로 Cloudflare Worker Secrets를 등록한 뒤 GitHub 배포를 연결하세요.

### Repository Secrets

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

### Repository Variables

```text
D1_DATABASE_ID
WORKER_NAME
D1_DATABASE_NAME
AUTH_RATE_LIMIT_NAMESPACE
WRITE_RATE_LIMIT_NAMESPACE
R2_BUCKET_NAME
R2_PUBLIC_BASE_URL
IMAGE_VAULT_VPC_SERVICE_ID
```

`IMAGE_VAULT_VPC_SERVICE_ID`는 자체 이미지 서비스를 사용할 때만 설정합니다. 값이 없으면 `IMAGE_VAULT` 바인딩 없이 기존 Worker가 정상 배포됩니다.

Google Client ID/Secret, `SESSION_SECRET`, Turnstile Secret, 허용 이메일 목록, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `IMAGE_SERVICE_TOKEN`은 GitHub에 넣지 않습니다. 기존 Cloudflare Worker Secrets 또는 관리자 설정의 암호화된 D1 값으로 유지하며 GitHub Actions는 저장소 코드와 비밀이 아닌 바인딩 설정만 배포합니다.

Cloudflare API Token에는 대상 계정의 Worker 배포와 D1 마이그레이션에 필요한 최소 권한만 부여하고 만료·회전 정책을 적용하세요. GitHub의 `production` Environment에 승인 규칙을 설정하면 운영 배포를 추가로 보호할 수 있습니다.

## 11. 운영 배포 체크리스트

- [ ] `/privacy`, `/terms`, 운영자 연락처를 실제 정책에 맞게 수정
- [ ] `REGISTRATION_MODE`가 의도한 값인지 확인
- [ ] 관리자 이메일과 허용 이메일·도메인 확인
- [ ] Google callback URL과 `BASE_URL`의 문자 단위 일치 확인
- [ ] 운영 D1 마이그레이션 전 백업·변경 내용 검토
- [ ] 비로그인 보호 경로 점검
- [ ] 서로 다른 두 계정으로 개인 티켓 격리 점검
- [ ] R2를 사용한다면 개인 이미지 격리, 직접 업로드, 공개 캐시 URL 점검
- [ ] 자체 이미지 서비스를 사용한다면 VPC Service ID, `IMAGE_VAULT` 바인딩, Worker 경유 이미지 조회 점검
- [ ] `.env.production`, `.dev.vars`, `wrangler.jsonc`가 Git에서 제외되는지 확인
- [ ] GitHub Actions용 Cloudflare Token 최소 권한 확인

## 공식 문서

- Workers 배포: https://developers.cloudflare.com/workers/get-started/guide/
- D1 Wrangler 명령: https://developers.cloudflare.com/d1/wrangler-commands/
- Worker Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Rate Limiting 바인딩: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- GitHub Actions: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- Workers VPC 시작하기: https://developers.cloudflare.com/workers-vpc/get-started/
- Workers VPC Service 바인딩: https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/
