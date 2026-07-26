# Private Board Worker

Google 로그인을 통과한 사용자에게 공용 게시판과 개인 작업·이미지 보드를 제공하는 서비스입니다.

- 회원 공개 `자유게시판`, `개발`, `뉴스`, `문의` 게시판
- 비로그인 손님용 루트 페이지의 자유게시판·개발·뉴스 최근 글 5건 미리보기
- 회원 본인만 볼 수 있는 3열 작업 티켓 보드: `할 일`, `진행 중`, `완료`
- R2에 직접 업로드하고 Custom Domain 캐시 URL로 조회하는 개인 이미지 저장소
- 현재 화면에 맞춰 제목과 주요 동작이 바뀌는 고정 탑바
- 탑바 오른쪽의 메뉴 아이콘 하나에 전체 이동 메뉴 수납
- 게시글·댓글은 일반 텍스트만 지원하고 외부 폰트는 사용하지 않음
- Google OpenID Connect, PKCE, state, nonce 검증
- D1 해시 세션, 세션 기반 CSRF, 사용자별 쓰기 제한
- 이메일 허용 목록 또는 Google Workspace 도메인 제한 선택 가능

## 기술 구성

| 영역 | 구성 |
|---|---|
| 런타임 | Cloudflare Workers Static Assets |
| 서버 | TypeScript, Hono, Hono JSX |
| 데이터 | Cloudflare D1 |
| 이미지 저장 | Cloudflare R2, presigned PUT, Custom Domain cache |
| 로그인 | Google OAuth 2.0 / OpenID Connect |
| 토큰 검증 | `jose` |
| 작업 카드 정렬 | SortableJS |
| 운영 도구 | Wrangler, D1 migrations, Workers Logs |
| 자동 검사 | TypeScript, Vitest, 비밀정보 패턴 검사, GitHub Actions |

## 시작 순서

1. [설치 및 로컬 실행](docs/INSTALLATION.md)
2. [Google OAuth 서비스 등록](docs/GOOGLE_OAUTH_SETUP.md)
3. [Cloudflare 등록 및 운영 배포](docs/CLOUDFLARE_DEPLOYMENT.md)
4. [R2 개인 이미지 저장소 설정](docs/R2_IMAGE_STORAGE_SETUP.md)
5. [GitHub와 비밀정보 관리](docs/SECRETS_AND_GITHUB.md)
6. [사용 방법](docs/USER_GUIDE.md)
7. [운영 및 데이터 관리](docs/OPERATIONS.md)
8. [구조와 접근 제어](docs/ARCHITECTURE.md)

## 빠른 로컬 실행

아래는 전체 문서를 읽기 전 흐름을 확인하기 위한 요약입니다.

```bash
npm ci
npx wrangler login
npx wrangler d1 create private-board-db
```

D1 생성 결과의 `database_id`로 Git에서 제외되는 `wrangler.jsonc`를 만듭니다.

```bash
D1_DATABASE_ID="발급된-D1-UUID" npm run config:render
cp .dev.vars.example .dev.vars
```

`.dev.vars`에 로컬용 Google OAuth 값과 무작위 `SESSION_SECRET`을 입력한 뒤 실행합니다.

```bash
npm run db:migrate:local
npm run dev
```

로컬 주소는 기본적으로 `http://localhost:8787`이며 Google 승인된 리디렉션 URI는 다음과 정확히 일치해야 합니다.

```text
http://localhost:8787/auth/google/callback
```

## 주요 명령

```bash
npm run dev                    # 로컬 개발 서버
npm run check                  # 보안 검사, 브라우저 빌드, 타입 검사, 테스트
npm run deploy:dry             # Cloudflare 번들·바인딩 드라이런
npm run db:migrate:local       # 로컬 D1 마이그레이션
npm run db:migrate:remote      # 운영 D1 마이그레이션
npm run deploy                 # 전체 검사 후 운영 배포
npm run security:check         # 커밋 파일의 비밀정보 의심 패턴 검사
```

## 가입 정책

런타임 설정 `REGISTRATION_MODE`로 로그인 대상을 정합니다.

| 값 | 동작 |
|---|---|
| `open` | Google 계정이면 가입 가능 |
| `allowlist` | `ALLOWED_EMAILS`에 등록된 이메일만 가능 |
| `domain` | ID 토큰의 `hd`가 `ALLOWED_DOMAINS`에 포함된 Google Workspace 계정만 가능 |

폐쇄형 서비스라면 `allowlist` 또는 `domain`을 권장합니다. `ADMIN_EMAILS`에 등록된 계정은 관리자로 처리되며 다른 회원의 공용 게시글·댓글도 수정·삭제할 수 있습니다. 개인 티켓은 관리자에게도 노출되지 않도록 모든 쿼리가 소유자 세션 ID로 제한됩니다.

## 저장소에 포함되지 않는 파일

다음 파일과 데이터는 `.gitignore`로 제외됩니다.

```text
.dev.vars
.env
.env.production
wrangler.jsonc
.wrangler/
node_modules/
*.sqlite, *.db
backups/, exports/
public/assets/app.js
```

예시 파일에는 실제 인증정보를 넣지 마세요. 운영용 Google Client Secret과 세션 키는 Cloudflare Worker Secrets에 직접 등록합니다. 자세한 커밋 전 점검 절차는 [GitHub와 비밀정보 관리](docs/SECRETS_AND_GITHUB.md)를 따르세요.

## 배포 전 필수 수정

`/privacy`와 `/terms`는 배포를 돕기 위한 예시 문서입니다. 실제 서비스 명칭, 운영자 연락처, 보유기간, 삭제 정책, 적용 법령에 맞게 반드시 검토해야 합니다. 이 저장소의 문서는 법률 자문을 대신하지 않습니다.

## 공식 참고 문서

- Cloudflare Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Wrangler 명령: https://developers.cloudflare.com/workers/wrangler/commands/
- Google OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect

## 라이선스

MIT. 자세한 내용은 [LICENSE](LICENSE)를 확인하세요.
