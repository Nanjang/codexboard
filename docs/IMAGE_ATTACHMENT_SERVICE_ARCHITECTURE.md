# 이미지 첨부 서비스 아키텍처

CodexBoard의 자유게시판·개발일지 첨부 이미지와 개인 이미지 저장소는 하나의 통합 이미지 경로를 사용합니다. Cloudflare Worker를 공개 진입점으로 사용하고, Workers VPC와 Cloudflare Tunnel을 통해 Raspberry Pi의 외장 SSD에 저장합니다. 파일명은 원본 바이트의 SHA-256 해시이므로 동일 URL의 내용은 바뀌지 않습니다.

## 전체 구성

```mermaid
flowchart LR
    browser["사용자 브라우저"]
    admin["관리자 브라우저"]

    subgraph cloudflare["Cloudflare"]
        gateway["기본 Worker 진입점<br/>Hono 라우터 · 캐시 비활성"]
        cachedEntry["DevlogImageCache<br/>named Worker 진입점"]
        edgeCache[("Workers Edge Cache<br/>1년 · immutable")]
        d1[("D1<br/>설정 · 이미지 메타데이터 · 캐시 통계")]
        vpc["Workers VPC Service<br/>IMAGE_VAULT 바인딩"]
    end

    tunnel["cloudflared<br/>Named Tunnel"]

    subgraph raspberry["Raspberry Pi"]
        imageService["Node.js 이미지 서비스<br/>127.0.0.1:8085"]
        ssd[("외장 SSD<br/>SHA-256 객체 저장소")]
        journal["systemd journal<br/>image_access 로그"]
    end

    browser -->|"업로드 POST<br/>/api/devlog/images 또는 /api/images"| gateway
    browser -->|"조회 GET 또는 HEAD<br/>/i/hash.ext"| gateway
    gateway -->|"ctx.exports.fetch"| edgeCache
    edgeCache -->|"MISS일 때 실행"| cachedEntry
    edgeCache -->|"HIT 응답"| gateway
    cachedEntry --> vpc
    gateway -->|"업로드 · 상태 확인"| vpc
    vpc --> tunnel
    tunnel --> imageService
    imageService --> ssd
    imageService --> journal
    cachedEntry -->|"200 응답을 캐시에 저장"| edgeCache
    gateway -.->|"waitUntil 비동기 기록"| d1
    admin -->|"/admin/image-cache/requests<br/>/admin/image-cache/files"| gateway
    gateway -->|"관리자 통계 조회"| d1
```

## 업로드 흐름

```mermaid
sequenceDiagram
    autonumber
    participant B as 브라우저
    participant W as 기본 Worker 진입점
    participant D as D1
    participant V as Workers VPC
    participant P as Raspberry Pi 서비스
    participant S as 외장 SSD

    B->>W: POST /api/devlog/images 또는 /api/images + 이미지 바이트
    W->>W: 로그인 · CSRF · 요청 제한 · MIME · 크기 검증
    W->>D: 암호화된 이미지 서비스 토큰 조회
    W->>V: POST /upload + Bearer token
    V->>P: Tunnel을 통해 localhost:8085 전달
    P->>P: 실제 이미지 형식 · 픽셀 수 · 메타데이터 검증
    P->>P: 원본 바이트 SHA-256 계산
    P->>S: hash 기반 경로에 저장 또는 중복 제거
    P-->>W: hash · 확장자 · MIME · 크기
    W-->>B: 공개 immutable /i/hash.ext URL
```

업로드 API는 인증된 사용자만 호출할 수 있습니다. 브라우저는 Raspberry Pi의 주소나 서비스 토큰을 알지 못하며, Worker가 D1에 암호화해 둔 토큰을 복호화하여 VPC 내부 요청에만 사용합니다.

## 이미지 조회와 캐시 흐름

```mermaid
sequenceDiagram
    autonumber
    participant B as 브라우저
    participant G as 기본 Worker 진입점
    participant C as Workers Edge Cache
    participant E as DevlogImageCache
    participant V as Workers VPC
    participant P as Raspberry Pi 서비스
    participant D as D1 통계

    B->>G: GET 또는 HEAD /i/hash.ext
    G->>G: 경로 검증 · query 제거 · cache key 정규화
    G->>C: named entrypoint fetch
    alt 캐시 HIT
        C-->>G: 캐시된 이미지
    else 캐시 MISS
        C->>E: named Worker 진입점 실행
        E->>V: GET 또는 HEAD /i/hash.ext
        V->>P: Tunnel 내부 전달
        P-->>E: 이미지 + ETag + immutable Cache-Control
        E-->>C: 응답 저장
        C-->>G: MISS 응답
    end
    G-->>B: 이미지 + X-Devlog-Image-Cache
    G-->>D: waitUntil로 요청 및 파일별 통계 기록
```

- 기본 Worker 진입점은 캐시하지 않으므로 모든 이미지 요청에서 라우팅과 통계 기록이 실행됩니다.
- `DevlogImageCache` named 진입점만 캐시합니다. HIT이면 Raspberry Pi와 VPC를 호출하지 않습니다.
- 기존 `/devlog-images/i/<hash>.<ext>` 주소는 `/i/<hash>.<ext>`로 308 리다이렉트됩니다.
- 캐시 키에서 query string을 제거하므로 같은 해시 파일은 하나의 캐시 항목을 공유합니다.
- 응답은 `Cache-Control: public, max-age=31536000, immutable`과 해시 기반 `ETag`를 사용합니다.
- `cross_version_cache`가 활성화되어 Worker를 다시 배포해도 유효한 이미지 캐시를 재사용합니다.
- 404, 405, 503 응답은 `no-store`로 반환하여 오류 응답이 캐시에 남지 않게 합니다.
- `If-None-Match`는 바깥 진입점에서 처리하므로 콜드 캐시도 Raspberry Pi의 304 응답만 받고 끝나지 않고 전체 본문을 채울 수 있습니다.

## 통계와 운영 확인

기본 Worker는 이미지 응답과 별개로 D1 기록을 `waitUntil()`에 맡깁니다. 통계 저장 장애가 이미지 표시를 막지는 않지만, 장애 중 일부 기록은 빠질 수 있는 best-effort 통계입니다.

| 화면 또는 로그 | 내용 |
|---|---|
| `/admin/image-cache/requests` | 최근 통합 이미지 요청 최대 1,000건의 시간, GET/HEAD, HIT/MISS, 응답 상태, 처리 시간, Colo |
| `/admin/image-cache/files` | 파일별 누적 요청, HIT, MISS, 히트율, 최근 결과 |
| 응답 `X-Devlog-Image-Cache` | 바깥 Worker가 기록한 `HIT` 또는 `MISS` |
| 응답 `Cf-Cache-Status` | Cloudflare가 반환한 원본 캐시 상태 |
| Raspberry Pi journal | 실제 Pi까지 도달한 `image_access` 요청 |

Raspberry Pi에서 실제 원본 조회를 실시간으로 확인하려면 다음 명령을 사용합니다.

```bash
sudo journalctl -u codexboard-image-service -f -o cat \
  | grep --line-buffered '"event":"image_access"'
```

## 보안 경계

- Raspberry Pi 서비스는 `127.0.0.1:8085`에서만 수신합니다.
- Tunnel에는 공개 hostname이나 공개 route가 필요하지 않습니다.
- 업로드와 삭제는 Bearer token을 요구하며, 공개 이미지 조회만 GET/HEAD를 허용합니다.
- 브라우저 업로드는 Worker의 로그인, CSRF, rate limit 검사를 통과해야 합니다.
- Worker는 허용된 이미지 MIME, 확장자, 크기를 검사하고 Pi 서비스는 실제 파일 형식을 다시 검증합니다.
