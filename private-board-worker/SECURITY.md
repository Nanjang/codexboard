# Security Policy

## 보안 문제 제보

실제 토큰, 쿠키, 사용자 이메일, D1 export를 공개 GitHub Issue에 첨부하지 마세요. 저장소의 Private Vulnerability Reporting 기능 또는 운영자가 지정한 비공개 연락 채널을 사용하세요.

제보에는 비밀값 원문 없이 다음을 포함해 주세요.

- 영향받는 커밋 또는 배포 버전
- 재현 경로와 필요한 최소 권한
- 기대 동작과 실제 동작
- 개인정보 노출 여부
- 공격자가 얻을 수 있는 권한 범위

## 기본 보안 설계

- Google Authorization Code + PKCE, state, nonce
- 서버 측 ID 토큰 서명과 claim 검증
- D1에는 세션 토큰 해시만 저장
- HttpOnly, Secure, SameSite 쿠키
- 세션 기반 CSRF와 Same-Origin 검사
- Prepared Statement와 입력 길이 제한
- 사용자별 쓰기 Rate Limit
- 개인 티켓 소유자 조건 강제
- 이미지와 사용자 HTML 차단
- CSP 및 `no-store` 응답
- 운영 Secret을 저장소 밖에서 관리

## 운영자가 해야 할 일

- 폐쇄 서비스에는 allowlist 또는 domain 가입 모드 사용
- Cloudflare와 Google 계정에 다중 인증 적용
- API Token 최소 권한과 정기 회전
- D1 백업의 암호화·접근 제한·보존기간 설정
- `/privacy`, `/terms`를 실제 운영 정책에 맞게 수정
- 종속성 업데이트 전에 `npm run check`와 배포 드라이런 실행

## 비밀값 유출

값을 Git 기록에서 제거하기 전에 먼저 발급처에서 폐기하세요. Google Client Secret, Cloudflare API Token, Turnstile Secret을 각각 회전하고, 세션 유출 가능성이 있으면 `SESSION_SECRET` 교체와 `DELETE FROM sessions`를 함께 수행합니다.

자세한 절차는 [docs/SECRETS_AND_GITHUB.md](docs/SECRETS_AND_GITHUB.md)를 확인하세요.
