# R2 개인 이미지 저장소 설정

이 문서는 개인 이미지 저장 기능이 사용하는 Cloudflare R2 버킷, 공개 캐시 도메인, 브라우저 직접 업로드용 CORS, R2 API 자격증명과 Worker 설정을 준비하는 절차입니다.

애플리케이션에서 이미지 목록은 로그인한 본인에게만 보이지만, 이미지의 캐시 URL은 공개 URL입니다. 사용자가 `[복사]`를 눌러 주소를 공유하면 그 주소를 아는 사람은 로그인 없이 이미지를 열 수 있습니다. 버킷의 객체 목록 자체를 공개 게시판처럼 제공하지는 않습니다.

이미지 파일은 Worker를 통과하지 않습니다. 로그인과 소유권을 확인한 Worker가 짧게 유효한 presigned `PUT` URL을 만들고, 브라우저가 그 URL로 R2에 직접 업로드합니다. 조회할 때는 R2에 연결한 Custom Domain의 캐시 URL을 사용합니다.

## 1. R2 활성화와 무료 사용량 확인

Cloudflare Dashboard에서 다음 메뉴를 엽니다.

```text
Storage & databases > R2 > Overview
```

R2를 처음 사용하는 계정은 R2 구독을 활성화하는 checkout 절차가 표시될 수 있습니다. R2에는 무료 월간 포함량이 있지만 사용량 기반 상품이므로, 계정 상태에 따라 결제 수단 등록이나 결제 프로필 활성화가 요구될 수 있습니다. 무료 포함량을 넘으면 초과 사용량이 청구될 수 있으므로 Billing 알림과 R2 사용량을 함께 확인하세요.

2026년 7월 기준 R2 Standard 저장 등급의 월간 무료 포함량은 다음과 같습니다.

| 항목 | 무료 포함량 |
|---|---:|
| 저장 공간 | 10 GB-month |
| Class A 작업 | 100만 회 |
| Class B 작업 | 1,000만 회 |
| 인터넷 egress | 무료 |

무료 포함량은 Standard 저장 등급에만 적용됩니다. 현재 요금과 포함량은 배포 전에 [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)에서 다시 확인하세요.

## 2. 전용 버킷 생성

R2 Overview에서 `Create bucket`을 선택합니다.

1. 이 서비스의 이미지에만 사용할 새 버킷 이름을 입력합니다.
2. 저장 등급은 무료 포함량이 적용되는 `Standard`를 선택합니다.
3. 특별한 데이터 관할 요구가 없다면 기본 위치 설정을 사용합니다.
4. 생성한 버킷 이름을 기록합니다. 이 값이 `R2_BUCKET_NAME`입니다.

실제 버킷 이름은 이 문서나 소스 코드에 하드코딩하지 않습니다. 버킷은 이미지 서비스 전용으로 분리해야 API 토큰 권한을 해당 버킷 하나로 제한할 수 있습니다.

## 3. 공개 Custom Domain과 캐시 연결

캐시 URL로 이미지를 제공하려면 R2 버킷에 본인이 관리하는 Cloudflare 도메인의 하위 도메인을 연결합니다. Cloudflare가 제공하는 `r2.dev` 개발 URL은 캐시, WAF, Bot Management를 지원하지 않으므로 운영 주소로 사용하지 않습니다.

1. R2 Overview에서 생성한 버킷을 선택합니다.
2. `Settings`를 엽니다.
3. `Public access > Custom Domains`에서 `Connect Domain`을 선택합니다.
4. 이미지 전용으로 사용할 실제 하위 도메인을 입력합니다.
5. 생성될 DNS 레코드를 검토하고 연결합니다.
6. 상태가 `Active`가 될 때까지 기다립니다.

연결된 origin만 `R2_PUBLIC_BASE_URL`로 설정합니다.

```text
R2_PUBLIC_BASE_URL=https://<R2_CUSTOM_DOMAIN>
```

값에는 객체 경로, query string, 마지막 `/`를 넣지 않습니다. 예시의 placeholder를 그대로 사용하거나 실제 도메인을 Git 문서에 기록하지 마세요.

Custom Domain은 공개 읽기 경로입니다. 앱은 추측하기 어려운 고유 객체 키를 사용하고 같은 키를 덮어쓰지 않아야 합니다. 주소를 복사한 적이 있다는 아이콘은 공유 이력 표시일 뿐, 복사 이후 URL 접근을 인증하거나 취소하는 기능은 아닙니다.

### 캐시 규칙

Custom Domain을 연결하면 R2 객체 요청이 Cloudflare Cache를 통과합니다. 기본 캐시 대상 파일 형식만으로 충분하지 않거나 모든 이미지 MIME 형식을 확실히 캐시하려면 해당 이미지 hostname에만 적용되는 Cache Rule을 만듭니다.

```text
조건: Hostname equals <R2_CUSTOM_DOMAIN>
동작: Cache eligibility = Eligible for cache
```

업로드 요청의 `Cache-Control`은 애플리케이션이 발급한 presigned URL의 서명 조건과 정확히 일치해야 합니다. 객체 키가 매번 고유하므로 긴 캐시 수명을 사용해도 기존 URL의 내용이 바뀌지 않는 구조입니다. 같은 객체 키를 덮어쓰면 이전 응답이 캐시에 남을 수 있으므로 새 업로드에는 항상 새 키를 사용하세요.

## 4. 브라우저 직접 업로드용 CORS

게시판 origin과 R2 S3 API origin이 다르므로 브라우저의 presigned `PUT`에는 버킷 CORS 정책이 필요합니다.

버킷의 `Settings > CORS Policy > Add CORS policy`에서 JSON 탭에 다음 정책을 입력합니다. `<BOARD_ORIGIN>`은 실제 게시판 origin으로 바꾸고, 경로나 마지막 `/`를 포함하지 않습니다.

```json
[
  {
    "AllowedOrigins": [
      "https://<BOARD_ORIGIN>"
    ],
    "AllowedMethods": [
      "PUT"
    ],
    "AllowedHeaders": [
      "Content-Type",
      "Cache-Control"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

로컬 브라우저에서도 R2에 직접 업로드해야 한다면 개발 중에만 정확한 로컬 origin을 추가합니다.

```json
"AllowedOrigins": [
  "https://<BOARD_ORIGIN>",
  "http://localhost:8787"
]
```

`*` origin을 사용하지 마세요. `AllowedHeaders`에는 브라우저가 실제로 보내는 `Content-Type`과 `Cache-Control`이 모두 있어야 합니다. 이후 업로드 요청에 다른 header를 추가한다면 CORS 정책과 presigned URL 서명 조건을 함께 갱신해야 합니다.

CORS 변경은 전파에 시간이 걸릴 수 있습니다. 이미 Custom Domain으로 캐시된 응답이 있다면 CORS 변경 뒤 해당 hostname의 캐시를 purge해야 새 CORS 응답 header가 반영됩니다.

## 5. 버킷 한정 R2 API 토큰 발급

이 자격증명은 일반 Cloudflare API Token이나 GitHub Actions 배포 토큰과 다릅니다. Worker가 S3 호환 API의 presigned URL을 만드는 용도로만 사용합니다.

1. R2 Overview의 `Account Details`에서 `API Tokens` 옆 `Manage`를 선택합니다.
2. 운영 서비스용이면 `Create Account API token`을 선택합니다. 이 메뉴는 계정의 Super Administrator만 보거나 생성할 수 있습니다. 개인 사용자에 종속된 토큰을 사용해야 한다면 계정에서 사용자가 제거될 때 토큰도 비활성화될 수 있음을 고려하세요.
3. 권한은 `Object Read & Write`를 선택합니다.
4. 범위는 `Apply to specific buckets only`를 선택합니다.
5. 2단계에서 만든 이미지 버킷 하나만 선택합니다.
6. 토큰을 생성하고 다음 두 값을 안전한 비밀 저장소에 즉시 기록합니다.

```text
Access Key ID
Secret Access Key
```

`Secret Access Key`는 생성 화면을 닫으면 다시 조회할 수 없습니다. 잃어버렸다면 기존 토큰을 폐기하고 새로 발급해야 합니다.

다음 값은 절대로 채팅, 이슈, 문서, `.env.example`, `wrangler.example.jsonc`, GitHub Repository Variable 또는 Git 커밋에 넣지 않습니다.

```text
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

## 6. Cloudflare Worker Secrets 등록

R2 자격증명은 GitHub Actions Secret이 아니라 Cloudflare Worker Secrets에 직접 등록합니다. 명령 인수에 값을 쓰지 말고 Wrangler의 입력 prompt가 나타났을 때 붙여 넣습니다.

```bash
npx wrangler secret put R2_ACCESS_KEY_ID --config wrangler.jsonc
npx wrangler secret put R2_SECRET_ACCESS_KEY --config wrangler.jsonc
```

등록된 이름만 확인합니다. 이 명령은 실제 값을 출력하지 않습니다.

```bash
npx wrangler secret list --config wrangler.jsonc
```

GitHub Actions에는 Worker 배포용 `CLOUDFLARE_API_TOKEN`과 `CLOUDFLARE_ACCOUNT_ID`만 기존 배포 절차에 따라 둡니다. R2의 `Access Key ID`와 `Secret Access Key`를 GitHub에 중복 저장하거나 workflow의 `env`로 전달하지 않습니다. 코드 배포 시에는 기존 Cloudflare Worker Secrets가 유지되어야 합니다.

R2 Secret 등록을 나중으로 미뤄도 Worker 자체는 배포할 수 있습니다. 두 값 중 하나라도 없으면 presigned URL을 발급하지 않고, 이미지 업로드 화면에는 설정이 필요하다는 오류 toast가 표시됩니다. 빈 문자열을 Secret으로 등록하지 말고 둘 다 준비될 때까지 미등록 상태로 두세요.

## 7. 비밀값이 아닌 R2 설정

다음 세 값은 비밀정보가 아니며 Worker의 일반 runtime 변수로 설정합니다.

| 변수 | 값 |
|---|---|
| `R2_ACCOUNT_ID` | R2 버킷이 속한 Cloudflare Account ID |
| `R2_BUCKET_NAME` | 생성한 이미지 전용 버킷 이름 |
| `R2_PUBLIC_BASE_URL` | 버킷에 연결한 `https://` Custom Domain origin |

프로젝트의 `wrangler.jsonc` 생성 절차 또는 Cloudflare Dashboard의 Worker 변수 설정을 사용합니다. 값의 형태는 다음과 같습니다.

```json
{
  "vars": {
    "R2_ACCOUNT_ID": "<CLOUDFLARE_ACCOUNT_ID>",
    "R2_BUCKET_NAME": "<R2_BUCKET_NAME>",
    "R2_PUBLIC_BASE_URL": "https://<R2_CUSTOM_DOMAIN>"
  }
}
```

실제 `wrangler.jsonc`는 Git에서 제외됩니다. 저장소에 포함된 예시 설정에는 placeholder만 유지합니다. Dashboard에서 설정할 경우 `R2_ACCESS_KEY_ID`와 `R2_SECRET_ACCESS_KEY`는 반드시 `Secret`으로, 위 세 값은 일반 text 변수로 구분하세요.

## 8. 배포와 검증

설정을 마친 뒤 애플리케이션 검사를 실행하고 배포합니다.

```bash
npm run check
npm run deploy:dry
npm run deploy
```

배포 후 다음 순서로 확인합니다.

- [ ] 관리자 설정에서 개인 이미지 저장 기능을 수동 활성화
- [ ] R2 버킷의 저장 등급이 `Standard`인지 확인
- [ ] R2 Custom Domain 상태가 `Active`인지 확인
- [ ] 운영 게시판 origin과 CORS `AllowedOrigins`가 문자 단위로 일치하는지 확인
- [ ] CORS가 `PUT`, `Content-Type`, `Cache-Control`을 허용하는지 확인
- [ ] R2 API 토큰 권한이 `Object Read & Write`이고 이미지 버킷 하나로 제한되었는지 확인
- [ ] `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`가 Cloudflare Worker Secrets에만 있는지 확인
- [ ] `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`이 운영 Worker 변수에 설정되었는지 확인
- [ ] 5 MiB 이하의 허용 이미지가 브라우저에서 R2로 직접 업로드되는지 확인
- [ ] 5 MiB를 초과한 파일이 네트워크 요청 전에 브라우저에서 거절되는지 확인
- [ ] 다른 로그인 계정에서 본인의 이미지 목록이 보이지 않는지 확인
- [ ] 이미지 아래 캐시 URL과 `[복사]` 버튼의 높이와 배치가 정상인지 확인
- [ ] `[복사]` 뒤 클립보드 값이 캐시 URL과 같고 우측의 복사 이력 아이콘이 유지되는지 확인
- [ ] 복사한 공개 URL을 로그아웃 창에서 열 수 있는지 확인
- [ ] R2 Secret을 미등록한 테스트 환경에서 업로드 시 오류 toast만 표시되고 페이지가 깨지지 않는지 확인

캐시 상태는 업로드한 테스트 이미지의 공개 URL로 확인합니다.

```bash
curl -I "https://<R2_CUSTOM_DOMAIN>/<OBJECT_KEY>"
curl -I "https://<R2_CUSTOM_DOMAIN>/<OBJECT_KEY>"
```

응답의 `CF-Cache-Status`를 확인합니다. 첫 요청은 `MISS`일 수 있고 이후 요청은 `HIT`이 될 수 있습니다. `Cache-Control`과 `Age` header도 함께 확인하세요.

테스트 중 생성한 이미지가 필요 없다면 R2 Dashboard에서 정확한 테스트 객체만 삭제합니다.

## 문제 해결

### 업로드를 누르면 설정 오류 toast가 표시됨

`R2_ACCESS_KEY_ID`와 `R2_SECRET_ACCESS_KEY` 중 하나 이상이 Worker Secret에 없습니다. `wrangler secret list`로 이름을 확인한 뒤 두 값을 모두 등록합니다. 일반 text 변수로 등록하거나 빈 문자열로 등록하지 마세요.

### 브라우저에서 CORS 또는 preflight 오류가 발생함

- `AllowedOrigins`가 실제 브라우저 주소의 `scheme://host[:port]`와 정확히 일치하는지 확인합니다.
- origin에 경로나 마지막 `/`가 들어가지 않았는지 확인합니다.
- `PUT`, `Content-Type`, `Cache-Control`이 CORS 정책에 모두 포함되었는지 확인합니다.
- 정책 저장 후 전파를 잠시 기다리고, Custom Domain에 기존 캐시가 있다면 purge합니다.

### `403 SignatureDoesNotMatch`

- Worker가 서명한 `Content-Type`과 브라우저가 전송한 값이 같은지 확인합니다.
- 서명에 포함된 `Cache-Control`과 실제 요청 header가 같은지 확인합니다.
- `R2_ACCOUNT_ID`, 버킷 이름과 R2 자격증명이 같은 Cloudflare 계정과 버킷을 가리키는지 확인합니다.
- presigned URL이 만료되지 않았는지, URL이 복사 과정에서 변경되지 않았는지 확인합니다.

### `InvalidAccessKeyId`, `AccessDenied` 또는 토큰 권한 오류

R2 API 토큰이 폐기되지 않았는지 확인하고 `Object Read & Write` 범위에 현재 버킷이 포함되어 있는지 확인합니다. 일반 Cloudflare API Token 값을 `R2_ACCESS_KEY_ID`로 잘못 등록하지 않았는지도 확인합니다.

### 공개 URL이 `404` 또는 연결 오류를 반환함

Custom Domain 상태가 `Active`인지, `R2_PUBLIC_BASE_URL`이 정확한 `https://` origin인지 확인합니다. `r2.dev` 주소나 버킷 이름을 URL에 임의로 덧붙이지 마세요. 업로드 완료 전에 공개 URL을 조회하고 있지 않은지도 확인합니다.

### `CF-Cache-Status`가 계속 `DYNAMIC` 또는 `BYPASS`

요청이 `r2.dev`가 아니라 Custom Domain으로 가는지 확인합니다. 이미지 hostname에 적용되는 Cache Rule, 객체의 `Cache-Control`, Cloudflare Development Mode 또는 우회 규칙을 확인합니다. 테스트할 때마다 query string을 바꾸면 서로 다른 캐시 키가 될 수 있습니다.

### 새 CORS 정책이 공개 응답에 보이지 않음

CORS 응답 header는 유효한 `Origin` 요청 header가 있는 cross-origin 요청에만 나타납니다. 명령줄에서 확인하려면 origin을 명시합니다.

```bash
curl -I \
  -H "Origin: https://<BOARD_ORIGIN>" \
  "https://<R2_CUSTOM_DOMAIN>/<OBJECT_KEY>"
```

이미 캐시된 객체라면 CORS 정책 변경 후 해당 hostname의 캐시를 purge하고 다시 확인합니다.

### Secret Access Key를 잃어버림

기존 Secret을 다시 표시할 수 없습니다. 기존 R2 API 토큰을 폐기하고 같은 최소 권한으로 새 토큰을 만든 뒤 두 Worker Secret을 모두 갱신합니다. 폐기 전후로 업로드 실패 시간이 생길 수 있으므로 짧은 점검 시간에 회전하세요.

## 공식 문서

- R2 시작하기: https://developers.cloudflare.com/r2/get-started/
- R2 버킷 만들기: https://developers.cloudflare.com/r2/buckets/create-buckets/
- R2 요금과 무료 포함량: https://developers.cloudflare.com/r2/pricing/
- R2 API 토큰: https://developers.cloudflare.com/r2/api/tokens/
- Presigned URL: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- R2 CORS: https://developers.cloudflare.com/r2/buckets/cors/
- R2 공개 버킷과 Custom Domain: https://developers.cloudflare.com/r2/buckets/public-buckets/
- R2 Cache 활성화: https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
- Worker Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
