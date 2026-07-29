# GitHub와 비밀정보 관리

이 프로젝트는 실제 인증정보가 저장소에 들어가지 않는 것을 기본 전제로 합니다. `.gitignore`만 믿지 말고 커밋 전 검사와 비밀값 저장 위치를 함께 지켜야 합니다.

## 비밀값 저장 위치

| 값 | 로컬 개발 | 운영 | GitHub 저장소 |
|---|---|---|---|
| Google Client ID | `.dev.vars` | Cloudflare Worker Secret | 금지 |
| Google Client Secret | `.dev.vars` | Cloudflare Worker Secret | 금지 |
| `SESSION_SECRET` | `.dev.vars` | Cloudflare Worker Secret | 금지 |
| Turnstile Secret | `.dev.vars` | Cloudflare Worker Secret | 금지 |
| Cloudflare API Token | Wrangler 로그인 | GitHub Actions Secret | 금지 |
| Cloudflare Account ID | 로컬 Wrangler | GitHub Actions Secret | 금지 |
| D1 database ID | 로컬 셸 `.env` | GitHub Repository Variable | 코드 커밋 대신 변수 권장 |
| Rate Limit namespace | 로컬 셸 `.env` | GitHub Repository Variable | 예시 값만 허용 |
| `BASE_URL` | `.dev.vars` | Cloudflare Worker 일반 변수 | 금지 |

GitHub Actions에는 Worker 배포 권한만 저장합니다. Google OAuth, 세션, Turnstile 비밀값은 Worker의 기존 Secret binding을 그대로 사용하며 GitHub에 중복 등록하지 않습니다.

Actions 배포는 `wrangler deploy --keep-vars`로 Cloudflare 대시보드에 설정한 일반 변수를 유지합니다. 운영 `BASE_URL`은 저장소나 GitHub Actions에 복제하지 않고 Cloudflare Worker의 일반 변수에서만 관리합니다. `APP_NAME`, `REGISTRATION_MODE` 등 배포 공통 기본값은 `wrangler.example.jsonc`에서 관리합니다.

`wrangler.example.jsonc`의 `secrets.required`에는 필수 Secret의 이름만 선언합니다. 값은 저장소나 Actions로 복사하지 않으며, 배포 시 Worker에 해당 Secret이 없으면 Wrangler가 배포를 중단합니다.

## Git에서 제외되는 파일

```text
.dev.vars
.dev.vars.*
.env
.env.*
wrangler.jsonc
.wrangler/
node_modules/
coverage/
*.sqlite
*.sqlite3
*.db
backups/
exports/
public/assets/app.js
```

예외로 `.dev.vars.example`과 `.env.example`만 커밋합니다. 예시 파일에는 실제 값과 비슷한 토큰도 넣지 마세요.

## 안전한 초기 설정

```bash
cp .dev.vars.example .dev.vars
cp .env.example .env
chmod 600 .dev.vars .env
```

최초 운영 배포에서만 로컬 Secret 묶음 파일이 필요할 경우 다음처럼 만듭니다.

```bash
cp .dev.vars.example .env.production
chmod 600 .env.production
```

`.env.production`은 `wrangler deploy --secrets-file .env.production` 입력에만 사용하고, 배포 후 암호화된 비밀 저장소로 이동하거나 안전하게 삭제합니다. GitHub Actions Secret으로 파일 전체를 복사하지 마세요.

Windows에서는 파일 ACL을 사용자 계정으로 제한하세요.

`wrangler.jsonc`는 다음처럼 생성하고 직접 커밋하지 않습니다.

```bash
set -a
. ./.env
set +a
npm run config:render
```

셸에 따라 `.env` 자동 로드는 동작이 다를 수 있으므로 값이 출력되지 않는지 확인하세요.

## 커밋 전 검사

```bash
npm run security:check
git status --short
git status --ignored --short
git diff --cached --check
git diff --cached
```

저장소 hook을 켭니다.

```bash
git config core.hooksPath .githooks
```

이후 `git commit` 전에 `npm run security:check`가 실행됩니다. 검사기는 Git이 추적하는 파일과 무시되지 않은 신규 파일을 대상으로 하므로, 무시 파일을 실수로 `git add -f`한 경우에도 알려진 인증정보 패턴을 차단합니다. 패턴 검사는 보조 장치이며 모든 형태의 비밀값을 찾는 보증은 아니므로 사람이 staged diff를 직접 확인해야 합니다.

## 커밋 금지 예시

```dotenv
GOOGLE_CLIENT_SECRET="실제 값"
SESSION_SECRET="실제 값"
CLOUDFLARE_API_TOKEN="실제 값"
```

다음 자료도 인증정보가 없더라도 개인정보와 운영 데이터를 포함할 수 있으므로 금지합니다.

- D1 export 또는 SQLite 파일
- 접속 로그와 오류 전체 덤프
- 브라우저 쿠키
- Google ID 토큰과 OAuth callback URL
- 사용자 이메일 목록
- 프로덕션 환경 캡처

## ZIP을 새 GitHub 저장소에 올리기

이 ZIP은 `git archive`로 만들었기 때문에 기존 `.git` 기록이나 로컬 비밀 파일이 포함되지 않습니다. 압축을 푼 뒤 새 저장소에서 다음 순서로 시작합니다.

```bash
cd private-board-worker
git init -b main
git config core.hooksPath .githooks
npm ci
npm run check
git add .
git status --short
git diff --cached --check
git commit -m "Initial private board service"
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

최초 push 전에는 GitHub 저장소를 비공개로 만들고 설정과 법적 문서를 검토하는 편이 안전합니다. `git status --ignored --short`에서 `.dev.vars`, `.env.production`, `wrangler.jsonc`, `.wrangler/`, `node_modules/`가 `!!`로 표시되는지 확인하세요.

이미 실제 비밀값을 파일에 입력했다면 `git add .` 직후 `npm run security:check`와 staged diff를 다시 확인합니다. 어떤 비밀값이 한 번이라도 원격 저장소에 push되었다면 파일 삭제만 하지 말고 해당 발급처에서 먼저 폐기·재발급하세요.

## GitHub Actions

`main` 브랜치에 `private-board-worker/**` 또는 workflow 변경을 push하면 검사, D1 마이그레이션, Worker 배포가 자동으로 실행됩니다. Pull Request에서는 검사만 실행하고 배포 Secret을 사용하지 않습니다.

배포 workflow에는 Cloudflare 배포용 두 값만 GitHub Actions의 Repository Secret으로 둡니다.

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

애플리케이션의 Google OAuth, 세션, Turnstile 비밀값은 기존 Cloudflare Worker Secrets에 그대로 유지합니다. GitHub Actions Secret으로 복사하거나 workflow의 `env` 또는 `secrets` 입력으로 전달하지 않습니다.

Repository Variable에는 비밀이 아닌 Wrangler 설정 렌더링 값만 등록합니다.

```text
D1_DATABASE_ID
WORKER_NAME
D1_DATABASE_NAME
AUTH_RATE_LIMIT_NAMESPACE
WRITE_RATE_LIMIT_NAMESPACE
```

GitHub의 `production` Environment에 승인 규칙을 설정하면 push 후 실제 운영 배포 전에 수동 승인을 요구할 수 있습니다. 즉시 자동 배포하려면 필수 승인 규칙을 두지 않습니다.

## 유출을 발견했을 때

Git 기록을 지우기 전에 먼저 비밀값을 폐기합니다.

1. Google Client Secret을 재발급하고 이전 값을 폐기합니다.
2. Cloudflare API Token을 폐기하고 최소 권한으로 새로 만듭니다.
3. `SESSION_SECRET`을 회전합니다. 기존 세션은 모두 무효가 됩니다.
4. Turnstile Secret을 회전합니다.
5. GitHub Secret과 Cloudflare Worker Secret을 새 값으로 갱신합니다.
6. 저장소가 공개되었거나 이미 push했다면 GitHub 보안 안내에 따라 `git filter-repo` 등의 도구로 기록을 정리합니다.
7. 모든 협업자에게 새로 clone하도록 안내하고 관련 로그를 조사합니다.

기록에서 삭제하는 것만으로는 이미 복제되거나 캐시된 비밀값을 보호할 수 없습니다.

## ZIP 배포본 점검

저장소를 공유할 때는 임의로 폴더 전체를 압축하지 말고 Git이 추적하는 파일만 아카이브합니다.

```bash
git archive --format=zip --output=private-board-worker.zip HEAD
```

이 방식은 `.dev.vars`, `.env`, `.env.production`, `wrangler.jsonc`, `.wrangler`, 로컬 DB와 `node_modules`를 자동으로 제외합니다. 압축 전에 `git status --ignored --short`로 실제 제외 상태를 다시 확인하세요.
