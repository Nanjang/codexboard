import { AwsClient } from 'aws4fetch'
import type { Bindings } from '../types'
import { isAllowedImageType, MAX_IMAGE_BYTES, type AllowedImageType } from '../shared/images'

export { MAX_IMAGE_BYTES }
export const IMAGE_CACHE_CONTROL = 'public, max-age=604800, immutable'

const IMAGE_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

interface R2Config {
  accountId: string
  bucketName: string
  publicBaseUrl: URL
  accessKeyId: string
  secretAccessKey: string
}

export interface UploadedObjectMetadata {
  contentType: string
  sizeBytes: number
}

export class R2ConfigurationError extends Error {
  constructor() {
    super('R2 업로드 설정이 필요합니다. 관리자에게 문의하세요.')
    this.name = 'R2ConfigurationError'
  }
}

function validAccountId(value: string): boolean {
  return /^[0-9a-f]{32}$/iu.test(value)
}

function validBucketName(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u.test(value)
}

function parsePublicBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim().replace(/\/+$/u, ''))
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null
    }
    return url
  } catch {
    return null
  }
}

function r2Config(env: Bindings): R2Config | null {
  const accountId = env.R2_ACCOUNT_ID?.trim() ?? ''
  const bucketName = env.R2_BUCKET_NAME?.trim() ?? ''
  const publicBaseUrl = parsePublicBaseUrl(env.R2_PUBLIC_BASE_URL ?? '')
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim() ?? ''
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() ?? ''

  if (
    !validAccountId(accountId) ||
    !validBucketName(bucketName) ||
    !publicBaseUrl ||
    !accessKeyId ||
    !secretAccessKey
  ) {
    return null
  }

  return { accountId, bucketName, publicBaseUrl, accessKeyId, secretAccessKey }
}

export function imageContentType(value: unknown): AllowedImageType | null {
  return isAllowedImageType(value) ? value : null
}

export function imageObjectKey(contentType: AllowedImageType): string {
  return `private-images/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[contentType]}`
}

export function imagePublicUrl(env: Bindings, objectKey: string): string | null {
  const publicBaseUrl = parsePublicBaseUrl(env.R2_PUBLIC_BASE_URL ?? '')
  if (!publicBaseUrl) return null
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/')
  return `${publicBaseUrl.origin}${publicBaseUrl.pathname.replace(/\/$/u, '')}/${encodedKey}`
}

export function r2ImageOrigins(env: Bindings): { apiOrigin: string; publicOrigin: string } | null {
  const accountId = env.R2_ACCOUNT_ID?.trim() ?? ''
  const publicBaseUrl = parsePublicBaseUrl(env.R2_PUBLIC_BASE_URL ?? '')
  if (!validAccountId(accountId) || !publicBaseUrl) return null
  return {
    apiOrigin: `https://${accountId}.r2.cloudflarestorage.com`,
    publicOrigin: publicBaseUrl.origin,
  }
}

function requireR2Config(env: Bindings): R2Config {
  const config = r2Config(env)
  if (!config) throw new R2ConfigurationError()
  return config
}

function objectApiUrl(config: R2Config, objectKey: string): URL {
  const encodedBucket = encodeURIComponent(config.bucketName)
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/')
  return new URL(`https://${config.accountId}.r2.cloudflarestorage.com/${encodedBucket}/${encodedKey}`)
}

function r2Client(config: R2Config): AwsClient {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: 'auto',
  })
}

export async function createImageUploadUrl(
  env: Bindings,
  objectKey: string,
  contentType: string,
): Promise<string> {
  const config = requireR2Config(env)
  const url = objectApiUrl(config, objectKey)
  url.searchParams.set('X-Amz-Expires', '300')
  const signed = await r2Client(config).sign(
    new Request(url, {
      method: 'PUT',
      headers: {
        'Cache-Control': IMAGE_CACHE_CONTROL,
        'Content-Type': contentType,
      },
    }),
    { aws: { signQuery: true } },
  )
  return signed.url
}

export async function inspectUploadedImage(env: Bindings, objectKey: string): Promise<UploadedObjectMetadata | null> {
  const config = requireR2Config(env)
  const response = await r2Client(config).fetch(objectApiUrl(config, objectKey), { method: 'HEAD' })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`R2 업로드 확인 실패 (${response.status})`)

  const sizeBytes = Number.parseInt(response.headers.get('Content-Length') ?? '', 10)
  const contentType = response.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    throw new Error('R2 객체 크기를 확인할 수 없습니다.')
  }
  return { contentType, sizeBytes }
}

export async function removeR2Object(env: Bindings, objectKey: string): Promise<void> {
  const config = requireR2Config(env)
  const response = await r2Client(config).fetch(objectApiUrl(config, objectKey), { method: 'DELETE' })
  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 객체 정리 실패 (${response.status})`)
  }
}
