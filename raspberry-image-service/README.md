# Raspberry Pi image service

CodexBoard 개발일지 이미지를 라즈베리파이의 외장 SSD에 저장하는 독립 서비스입니다. 외부 요청은 단일 게시판 Worker가 받고, Workers VPC를 통해 이 서비스로 전달합니다.

이 디렉터리는 저장소 최상위에 있으며 GitHub Actions의 Worker 배포 대상인 `private-board-worker/**` 밖에 있습니다. 이 서비스의 변경은 `Private Board Worker` 워크플로를 실행하지 않으며 Wrangler 배포에도 포함되지 않습니다.

## 동작

- 내부 주소: `http://127.0.0.1:8085`
- 외부 주소: `https://<게시판-Worker>/devlog-images/i/{sha256}.webp`
- Worker 내부 조회: `GET /i/{sha256}.webp`
- Worker 내부 업로드: `POST /upload`
- 관리용 내부 삭제: `DELETE /i/{sha256}.webp`
- 상태 확인: `GET /health`

업로드 파일은 Sharp로 디코딩하고 방향을 보정한 뒤 WebP로 다시 인코딩합니다. 이 과정에서 EXIF 등 원본 메타데이터는 유지하지 않습니다. 변환 결과의 SHA-256을 계산하여 다음처럼 외장 SSD에 분산 저장합니다.

```text
/srv/codexboard-images/objects/sha256/ab/cd/abcdef...1234.webp
```

동일한 변환 결과는 같은 해시를 사용하므로 중복 저장되지 않습니다. 애니메이션 이미지는 받지 않습니다.

## 요구 사항

- 64비트 Raspberry Pi OS 권장
- Node.js 22 이상
- 외장 SSD
- Cloudflare 계정
- `cloudflared`

## 설치 구조

Git 저장소는 로그인 사용자의 홈에 둡니다.

```text
/home/pi/github/codexboard           Git 저장소와 개발 파일
/opt/codexboard-image-service       실제 서비스 런타임만 배치
/etc/codexboard-image-service.env   서비스 환경 설정
/srv/codexboard-images              외장 SSD 이미지 저장소
```

`/opt/codexboard-image-service`에는 이미지 서비스의 `package.json`, `package-lock.json`, `src/`,
운영 의존성만 들어갑니다. 게시판 Worker, Git 이력, 문서와 테스트 파일은 복사하지 않습니다.

## 저장소 준비

```bash
mkdir -p /home/pi/github
git clone https://github.com/Nanjang/codexboard.git /home/pi/github/codexboard
cd /home/pi/github/codexboard/raspberry-image-service
npm ci
npm test
```

서비스 사용자와 이미지 저장 경로를 준비합니다.

```bash
sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin codex-images
sudo mkdir -p /srv/codexboard-images
sudo chown -R codex-images:codex-images /srv/codexboard-images
sudo chmod 750 /srv/codexboard-images
```

실제 외장 SSD 마운트 지점을 `/srv/codexboard-images`로 사용할 경우 `/etc/fstab`에 UUID 기반 마운트를 먼저 구성합니다. 서비스 시작 전에 `findmnt /srv/codexboard-images`로 SSD가 올바르게 마운트되었는지 확인해야 합니다. 제공된 systemd unit은 `RequiresMountsFor=/srv/codexboard-images`를 사용하므로 해당 마운트가 준비되지 않으면 이미지 서비스를 시작하지 않습니다.

환경 설정 파일을 만듭니다.

```bash
cd /home/pi/github/codexboard/raspberry-image-service
sudo cp .env.example /etc/codexboard-image-service.env
sudo chmod 600 /etc/codexboard-image-service.env
sudo editor /etc/codexboard-image-service.env
```

토큰은 충분히 긴 난수로 생성합니다.

```bash
openssl rand -hex 32
```

`IMAGE_SERVICE_TOKEN`은 게시판의 관리자 설정 화면에도 같은 값으로 등록합니다. 브라우저에는 이 값을
전달하지 않으며, 게시판 Worker가 암호화하여 D1에 저장합니다.

전용 설치 스크립트로 이미지 서비스 런타임과 systemd 유닛만 `/opt`에 설치합니다.

```bash
cd /home/pi/github/codexboard/raspberry-image-service
sudo bash ./deploy/install-service.sh
sudo systemctl enable --now codexboard-image-service
sudo systemctl status codexboard-image-service
```

로컬 상태 확인:

```bash
curl http://127.0.0.1:8085/health
```

## 업데이트

홈 디렉터리의 저장소를 갱신하고 테스트한 다음 서비스 파일만 다시 배포합니다.

```bash
cd /home/pi/github/codexboard
git pull --ff-only

cd raspberry-image-service
npm ci
npm test
sudo bash ./deploy/install-service.sh
sudo systemctl restart codexboard-image-service
sudo systemctl status codexboard-image-service
```

## Cloudflare Tunnel과 Workers VPC

터널에 공개 Route나 도메인을 추가하지 않습니다. `cloudflared`가 연결된 Named Tunnel을 Workers VPC Service의 내부 원본으로만 사용합니다.

1. Cloudflare Dashboard에서 Named Tunnel `imgvault`가 `Healthy`인지 확인합니다.
2. **Workers VPC → Services → Create service**에서 다음 값으로 서비스를 만듭니다.
   - Tunnel: `imgvault`
   - Type: `HTTP`
   - Host: `localhost`
   - Port: `8085`
3. 생성된 VPC Service의 UUID를 복사합니다.
4. GitHub 저장소의 `production` Environment 변수 `IMAGE_VAULT_VPC_SERVICE_ID`에 UUID를 등록합니다.
5. Worker를 다시 배포합니다.

Worker에는 `IMAGE_VAULT` Fetcher 바인딩이 생성되고, 게시판의 업로드와 이미지 조회 요청이 이 바인딩을 통해 `http://localhost:8085`로 전달됩니다. 공유기 포트포워딩, 공개 Tunnel Route, Custom Domain, Quick Tunnel은 필요하지 않습니다.

라즈베리파이의 `/etc/codexboard-image-service.env`에는 실제 게시판 Worker 주소를 넣습니다.

```dotenv
HOST=127.0.0.1
PORT=8085
PUBLIC_BASE_URL=https://private-board-worker.<YOUR_WORKERS_SUBDOMAIN>.workers.dev/devlog-images
```

`cloudflared`는 2025.7.0 이상이어야 하며 `auto` 또는 QUIC 프로토콜로 실행해야 합니다. 현재 화면에 보인 2026.7.3은 이 조건을 충족합니다.

## API

### 이미지 업로드

외부 브라우저는 게시판 Worker의 `/api/devlog/images`로 업로드합니다. 아래 명령은 라즈베리파이에서 원본 서비스를 직접 점검할 때만 사용합니다. 요청 본문에 이미지 파일 바이트를 그대로 보내며 `multipart/form-data`는 사용하지 않습니다.

```bash
curl \
  --request POST \
  --header "Authorization: Bearer $IMAGE_SERVICE_TOKEN" \
  --header "Content-Type: image/png" \
  --data-binary @screenshot.png \
  http://127.0.0.1:8085/upload
```

성공 응답:

```json
{
  "hash": "abcdef...",
  "url": "https://private-board-worker.example.workers.dev/devlog-images/i/abcdef....webp",
  "contentType": "image/webp",
  "sizeBytes": 123456,
  "width": 1920,
  "height": 1080,
  "deduplicated": false
}
```

### 이미지 조회

```bash
curl --output image.webp \
  https://private-board-worker.example.workers.dev/devlog-images/i/<sha256>.webp
```

조회 응답에는 다음 캐시 정책이 적용됩니다.

```http
Cache-Control: public, max-age=31536000, immutable
ETag: "sha256-<hash>"
```

### 이미지 삭제

```bash
curl \
  --request DELETE \
  --header "Authorization: Bearer $IMAGE_SERVICE_TOKEN" \
  http://127.0.0.1:8085/i/<sha256>.webp
```

같은 해시를 여러 게시글에서 참조할 수 있으므로 게시글 삭제와 동시에 이미지 파일을 자동 삭제하지 않는 것을 권장합니다.

## 설정

| 변수 | 기본값 | 설명 |
|---|---:|---|
| `HOST` | `127.0.0.1` | 내부 수신 주소 |
| `PORT` | `8085` | 내부 수신 포트 |
| `IMAGE_STORAGE_ROOT` | 필수 | 외장 SSD의 절대 경로 |
| `PUBLIC_BASE_URL` | 필수 | 게시판 Worker의 `<origin>/devlog-images` 주소 |
| `IMAGE_SERVICE_TOKEN` | 필수 | 32바이트 이상의 업로드·삭제 토큰 |
| `MAX_UPLOAD_BYTES` | `10485760` | 입력 파일 최대 크기 |
| `MAX_IMAGE_WIDTH` | `4096` | 변환 결과 최대 너비 |
| `MAX_IMAGE_HEIGHT` | `4096` | 변환 결과 최대 높이 |
| `MAX_INPUT_PIXELS` | `40000000` | 디코딩할 최대 픽셀 수 |
| `WEBP_QUALITY` | `82` | WebP 품질 |

## 게시판 Worker 연동

브라우저가 게시판의 업로드 API로 원본 바이트를 보내면 Worker가 로그인과 CSRF를 확인한 다음 Workers VPC로 이미지 서비스에 전달합니다. 게시판 관리자 설정의 **개발일지 이미지 서비스**에는 `IMAGE_SERVICE_TOKEN`만 입력합니다. Worker가 VPC를 통해 `/health`를 확인한 뒤 기능을 활성화합니다.

이미지 본문에는 `https://<게시판-Worker>/devlog-images/i/<sha256>.webp`가 저장됩니다. 이미지 조회도 같은 Worker가 VPC로 전달하므로 사용자에게 라즈베리파이 주소나 별도 Tunnel 주소가 노출되지 않습니다.

## 테스트

```bash
npm ci
npm test
```
