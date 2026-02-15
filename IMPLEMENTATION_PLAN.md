# 구현 계획서 (IMPLEMENTATION_PLAN)

## 1. 목표
- 단일 사이트에서 동작하는 멀티 게시판 서비스를 구축한다.
- 게시판 정책은 그누보드 동작과 최대한 동일하게 맞춘다.
- 기술 스택은 `NestJS + Next.js SSR + MariaDB + Prisma + Redis + Local Storage`를 사용한다.

## 2. 범위
### 포함
- 회원/세션 로그인
- 그룹/게시판/권한 레벨
- 목록/읽기/쓰기/수정/삭제
- 답글/댓글/댓글답글
- 비밀글/비밀번호 확인
- 추천/비추천
- 첨부 업로드/다운로드
- 포인트 적립/차감/롤백
- 공지/카테고리/검색

### 제외
- 멀티테넌시(다중 사이트 분리)
- 쇼핑몰/SNS 연동
- 기존 그누보드 DB 이관(1차 범위 제외)

## 3. 아키텍처
- 웹: `Next.js`가 SSR 페이지와 폼 UI를 담당
- API: `NestJS`가 도메인 로직/정책 검증을 담당
- 세션: `HttpOnly Cookie + Redis Session`
- DB: `MariaDB + Prisma`
- 파일: 로컬 파일시스템 저장
  - 저장 경로: `uploads/{board_id}/{yy}/{mm}/{dd}/{stored_filename}`
  - 저장 파일명: `UUIDv7`
  - 무결성 해시: `SHA-256`

## 4. 데이터 모델 원칙
- 공통 게시물은 `posts` 단일 테이블에 저장
- 파일 메타는 `board_files`에 분리 저장
- 포인트 이력은 `points`에서 `rel_table + rel_id + rel_action`으로 중복 방지
- 특수 게시판 확장은 다음 2가지로 처리
  - `posts.custom_fields (JSON)`
  - `board_field_schemas`(게시판별 동적 필드 스키마)

## 5. 정책 매핑(그누보드 호환)
- 비밀글: `bo_use_secret` + 세션키(`ss_secret_*`) 기반 접근 제어
- 답글: 깊이/분기(A-Z) 제한 및 `bo_reply_order` 반영
- 댓글: 깊이/분기(A-Z) 제한
- 추천/비추천: 본인 글 금지, 회원당 1회
- 다운로드: 조회 세션 없는 다운로드 차단, 포인트 차감 1회 처리
- 검색: `bo_use_search=1` 게시판만 포함하고 권한/그룹 접근 필터 반영

## 6. 공개 라우트
- `GET /bbs/board`
- `GET /bbs/write`
- `POST /bbs/write_token`
- `POST /bbs/write_update`
- `POST /bbs/write_comment_update`
- `GET /bbs/download`
- `POST /bbs/good`
- `POST /bbs/delete`
- `POST /bbs/delete_comment`
- `GET /bbs/password`
- `POST /bbs/password_check`
- `GET /bbs/search`

## 7. 구현 단계
1. 프로젝트 부트스트랩 및 공통 설정
2. Prisma 스키마/마이그레이션
3. 인증/세션
4. 게시판 조회(목록/읽기)
5. 글쓰기/수정/답글
6. 댓글/대댓글
7. 첨부/다운로드
8. 추천/비추천/스크랩
9. 관리자(그룹/게시판 정책)
10. 검색
11. 호환 URL + canonical
12. 문서/배포

## 8. 테스트 시나리오
- 권한 매트릭스(guest/member/admin/super)
- 비밀글 접근(본인/관리자/세션 인증/타인)
- 답글/댓글 트리 한도 및 정렬
- 수정/삭제 제한 임계치
- 포인트 적립/차감/롤백 정합성
- 추천/비추천 중복/자기글 금지
- 파일 메타/물리 파일 정합성
- 검색 대상 게시판/권한 필터 정확성

## 9. 현재 구현 현황
- [x] 모노레포 구조(`apps/api`, `apps/web`)
- [x] Prisma 핵심 스키마 및 인덱스 반영
- [x] 세션 로그인/로그아웃/내정보 API
- [x] BBS 호환 라우트 기본 구현
- [x] UUIDv7 + SHA-256 파일 저장 정책 반영
- [x] 관리자 그룹/게시판 정책 API 기본 구현
- [x] Next.js SSR 게시판/검색/글쓰기/로그인 화면 기본 구현
- [x] `docker-compose.yml`, 운영 문서 작성

## 10. 잔여 보강 항목
- [ ] CAPTCHA/실명인증(`bo_use_cert`) 정책 상세화
- [ ] canonical 리다이렉트 정책 고도화
- [ ] 권한 우회/포인트 정합성 E2E 자동화 테스트
- [ ] 썸네일 생성/정리 배치 처리
- [ ] FULLTEXT 검색 튜닝
