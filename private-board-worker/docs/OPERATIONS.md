# 운영 및 데이터 관리

## 런타임 설정 변경

설정은 Cloudflare Worker Secrets로 관리합니다. 변경 예:

```bash
npx wrangler secret put REGISTRATION_MODE --config wrangler.jsonc
npx wrangler secret put ALLOWED_EMAILS --config wrangler.jsonc
npx wrangler secret put ADMIN_EMAILS --config wrangler.jsonc
```

변경 후 새 배포가 필요하지 않은 경우에도 Cloudflare가 새 Secret 버전을 적용하는지 Dashboard에서 확인하고 로그인 테스트를 수행하세요.

## 관리자 지정

`ADMIN_EMAILS`에 Google 이메일을 쉼표로 구분해 입력합니다. 해당 이메일로 다음 로그인할 때 역할이 `admin`으로 승격됩니다.

```text
admin-one@example.com,admin-two@example.com
```

안전을 위해 코드가 기존 관리자를 자동 강등하지는 않습니다. 관리자 권한을 제거할 때는 `ADMIN_EMAILS`에서 삭제한 뒤 D1에서 역할을 명시적으로 변경합니다.

```bash
npx wrangler d1 execute DB --remote --config wrangler.jsonc --command \
"UPDATE users SET role='user', updated_at=strftime('%s','now')*1000
 WHERE id=(SELECT user_id FROM auth_accounts
           WHERE provider='google' AND email='former-admin@example.com');"
```

## 개인 이미지 기능 활성화

개인 이미지 저장 기능은 최초 배포 시 비활성입니다. 관리자 계정으로 로그인한 뒤 메뉴의 `관리자 설정`에서 `이미지 기능 활성화`를 누르면 모든 로그인 회원에게 메뉴와 API가 열립니다.

활성화 전에 [R2 개인 이미지 저장소 설정](R2_IMAGE_STORAGE_SETUP.md)에 따라 버킷, CORS, Custom Domain, Worker Secrets를 준비하는 것을 권장합니다. R2 설정 없이 활성화해도 다른 기능은 동작하지만 이미지 업로드는 설정 오류 toast로 거절됩니다.

기능을 다시 비활성화하면 이미지 메뉴와 애플리케이션 API 접근은 닫히지만, 이전에 복사된 공개 캐시 URL은 계속 접근할 수 있습니다. 공개 URL 회수가 필요하면 R2에서 해당 객체를 정확히 식별해 삭제하고 필요한 경우 캐시를 purge해야 합니다.

## 계정 차단과 해제

차단:

```bash
npx wrangler d1 execute DB --remote --config wrangler.jsonc --command \
"UPDATE users SET status='blocked', updated_at=strftime('%s','now')*1000
 WHERE id=(SELECT user_id FROM auth_accounts
           WHERE provider='google' AND email='member@example.com');
 DELETE FROM sessions
 WHERE user_id=(SELECT user_id FROM auth_accounts
                WHERE provider='google' AND email='member@example.com');"
```

해제:

```bash
npx wrangler d1 execute DB --remote --config wrangler.jsonc --command \
"UPDATE users SET status='active', updated_at=strftime('%s','now')*1000
 WHERE id=(SELECT user_id FROM auth_accounts
           WHERE provider='google' AND email='member@example.com');"
```

명령을 실행하기 전에 이메일과 대상 DB가 맞는지 확인하세요.

## 계정과 데이터 삭제

`users` 레코드를 삭제하면 외래 키 `ON DELETE CASCADE`에 따라 인증 계정, 세션, 개인 티켓이 삭제됩니다. 공용 게시글·댓글은 작성자 외래 키 때문에 먼저 별도 보존·익명화·삭제 정책을 결정해야 합니다.

운영 정책과 법적 보존 의무를 검토한 뒤 트랜잭션 또는 별도 마이그레이션으로 처리하세요. 즉석 운영 명령으로 대량 삭제하지 않는 것을 권장합니다.

## D1 백업

수동 export 파일에는 사용자 이메일과 게시물 내용이 포함됩니다. 암호화된 제한 접근 위치에만 저장하고 Git에 올리지 마세요.

```bash
mkdir -p backups
npx wrangler d1 export DB --remote --config wrangler.jsonc \
  --output "backups/private-board-$(date +%Y%m%d-%H%M%S).sql"
```

`backups/`는 `.gitignore`에 포함되어 있습니다. 보존기간이 끝나면 안전하게 삭제하세요. Cloudflare D1 Time Travel과 자동 백업 정책도 현재 플랜과 공식 문서에서 확인하세요.

## 마이그레이션 추가

```bash
npx wrangler d1 migrations create DB add_feature --config wrangler.jsonc
```

생성된 SQL을 검토한 뒤 순서대로 확인합니다.

```bash
npm run db:migrate:local
npm run check
npm run db:migrations:list:remote
npm run db:migrate:remote
npm run deploy
```

스키마 변경과 애플리케이션 배포의 호환 순서를 고려하세요. 큰 테이블 변경은 별도 단계로 나누는 편이 안전합니다.

## 로그와 점검

```bash
npx wrangler tail --config wrangler.jsonc
```

정기적으로 다음을 확인합니다.

- 로그인·쓰기 Rate Limit 증가
- OAuth 실패 급증
- D1 오류와 느린 쿼리
- 예상치 못한 관리자 변경
- 허용 목록 외 계정의 반복 로그인 시도
- D1 저장 공간과 읽기·쓰기 사용량

로그를 외부에 전달할 때 이메일, OAuth callback query, 쿠키, 토큰을 제거하세요.

## 세션 전체 무효화

세션 유출이 의심되면 `SESSION_SECRET`을 회전하고 D1의 모든 세션을 삭제합니다.

```bash
npx wrangler secret put SESSION_SECRET --config wrangler.jsonc
npx wrangler d1 execute DB --remote --config wrangler.jsonc \
  --command "DELETE FROM sessions;"
```

모든 사용자가 다시 로그인해야 합니다.

## 문의 게시판의 공개 범위

현재 `문의`는 로그인 회원 전체가 보는 공용 게시판입니다. 작성자와 관리자만 보는 비공개 문의로 변경하려면 단순 문구 변경만으로는 부족합니다. 목록, 상세, 댓글, 검색, 관리자 접근 규칙 전체에 별도 권한 모델과 테스트를 추가해야 합니다.

## 법적 문서

`src/views/legal.tsx`의 개인정보처리방침과 이용약관은 예시입니다. 운영 전 다음을 확정하세요.

- 운영 주체와 연락처
- 수집 항목과 처리 목적
- 보유기간과 삭제 절차
- 데이터 처리 위치와 외부 처리자
- 회원 신고와 게시물 운영 정책
- 관할 법령과 연령 제한
