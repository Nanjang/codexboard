# 기여 안내

## 개발 준비

```bash
npm ci
git config core.hooksPath .githooks
npm run check
```

로컬 실행에는 Git에서 제외되는 `wrangler.jsonc`, `.dev.vars`, 로컬 D1 마이그레이션이 필요합니다. [docs/INSTALLATION.md](docs/INSTALLATION.md)를 따르세요.

## 변경 원칙

- 사용자 입력을 SQL 문자열에 직접 보간하지 않습니다.
- 개인 티켓 쿼리에는 항상 인증 세션의 `owner_id` 조건을 둡니다.
- 새 POST, PUT, PATCH, DELETE 경로에는 CSRF와 쓰기 제한을 적용합니다.
- 사용자 HTML, 이미지, 첨부파일 기능을 추가하려면 별도 보안 검토가 필요합니다.
- 데이터베이스 변경은 새 D1 migration으로 추가합니다. 기존 적용 migration을 수정하지 않습니다.
- UI는 문맥형 탑바와 오른쪽 단일 메뉴 구조를 유지합니다.
- 드래그 기능 외에도 링크·폼 기반 대체 조작을 유지합니다.

## Pull Request 전

```bash
npm run check
npm run deploy:dry
git diff --check
git status --ignored --short
```

비밀값, DB export, 로그, 쿠키, OAuth callback URL이 포함되지 않았는지 staged diff를 직접 확인하세요.
