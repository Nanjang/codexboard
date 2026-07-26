import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const templatePath = resolve(root, 'wrangler.example.jsonc')
const outputPath = resolve(root, 'wrangler.jsonc')

const values = {
  __D1_DATABASE_ID__: process.env.D1_DATABASE_ID ?? '',
  __WORKER_NAME__: process.env.WORKER_NAME ?? 'private-board-worker',
  __D1_DATABASE_NAME__: process.env.D1_DATABASE_NAME ?? 'private-board-db',
  __AUTH_RATE_LIMIT_NAMESPACE__: process.env.AUTH_RATE_LIMIT_NAMESPACE ?? '41001',
  __WRITE_RATE_LIMIT_NAMESPACE__: process.env.WRITE_RATE_LIMIT_NAMESPACE ?? '41002',
  __R2_ACCOUNT_ID__: process.env.R2_ACCOUNT_ID ?? '',
  __R2_BUCKET_NAME__: process.env.R2_BUCKET_NAME ?? '',
  __R2_PUBLIC_BASE_URL__: process.env.R2_PUBLIC_BASE_URL ?? '',
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5]?[0-9a-f]{3}-[89ab]?[0-9a-f]{3}-[0-9a-f]{12}$/i
const namePattern = /^[a-z0-9][a-z0-9-]{0,62}$/
const bucketNamePattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/
const namespacePattern = /^[1-9][0-9]*$/
const accountIdPattern = /^[0-9a-f]{32}$/i

if (!uuidPattern.test(values.__D1_DATABASE_ID__)) {
  console.error('D1_DATABASE_ID가 없거나 UUID 형식이 아닙니다.')
  console.error('예: D1_DATABASE_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" npm run config:render')
  process.exit(1)
}

if (!namePattern.test(values.__WORKER_NAME__)) {
  console.error('WORKER_NAME은 소문자, 숫자, 하이픈만 사용하고 1~63자여야 합니다.')
  process.exit(1)
}

if (!namePattern.test(values.__D1_DATABASE_NAME__)) {
  console.error('D1_DATABASE_NAME은 소문자, 숫자, 하이픈만 사용하고 1~63자여야 합니다.')
  process.exit(1)
}

if (!namespacePattern.test(values.__AUTH_RATE_LIMIT_NAMESPACE__)) {
  console.error('AUTH_RATE_LIMIT_NAMESPACE는 양의 정수 문자열이어야 합니다.')
  process.exit(1)
}

if (!namespacePattern.test(values.__WRITE_RATE_LIMIT_NAMESPACE__)) {
  console.error('WRITE_RATE_LIMIT_NAMESPACE는 양의 정수 문자열이어야 합니다.')
  process.exit(1)
}

if (values.__AUTH_RATE_LIMIT_NAMESPACE__ === values.__WRITE_RATE_LIMIT_NAMESPACE__) {
  console.error('두 Rate Limiting namespace_id는 서로 달라야 합니다.')
  process.exit(1)
}

if (values.__R2_ACCOUNT_ID__ && !accountIdPattern.test(values.__R2_ACCOUNT_ID__)) {
  console.error('R2_ACCOUNT_ID는 32자리 Cloudflare 계정 ID여야 합니다.')
  process.exit(1)
}

if (values.__R2_BUCKET_NAME__ && !bucketNamePattern.test(values.__R2_BUCKET_NAME__)) {
  console.error('R2_BUCKET_NAME은 소문자, 숫자, 하이픈을 사용한 3~63자 이름이어야 합니다.')
  process.exit(1)
}

if (values.__R2_PUBLIC_BASE_URL__) {
  let publicUrl
  try {
    publicUrl = new URL(values.__R2_PUBLIC_BASE_URL__)
  } catch {
    console.error('R2_PUBLIC_BASE_URL은 올바른 HTTPS URL이어야 합니다.')
    process.exit(1)
  }
  if (
    publicUrl.protocol !== 'https:' ||
    publicUrl.username ||
    publicUrl.password ||
    publicUrl.pathname !== '/' ||
    publicUrl.search ||
    publicUrl.hash
  ) {
    console.error('R2_PUBLIC_BASE_URL은 경로, 인증정보, 쿼리, 해시가 없는 HTTPS origin이어야 합니다.')
    process.exit(1)
  }
}

let template = await readFile(templatePath, 'utf8')
for (const [placeholder, value] of Object.entries(values)) {
  template = template.replaceAll(placeholder, value)
}

await writeFile(outputPath, template, { mode: 0o600 })
console.log(`생성 완료: ${outputPath}`)
console.log('이 파일은 .gitignore에 포함되어 저장소에 커밋되지 않습니다.')
