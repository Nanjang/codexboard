import { HTTPException } from 'hono/http-exception'
import type { Bindings } from '../types'
import { decryptSecret } from './secret-box'
import { getImageServiceRecord } from './db'
import { ValidationError } from './validation'
import { isAllowedImageType, MAX_DEVLOG_IMAGE_BYTES } from '../shared/images'

export const DEVLOG_IMAGE_MAX_BYTES = MAX_DEVLOG_IMAGE_BYTES
export const DEVLOG_IMAGE_PUBLIC_PREFIX = '/devlog-images'
export const DEVLOG_IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const DEVLOG_IMAGE_HASH_PATTERN = /^[a-f0-9]{64}$/u
const IMAGE_SERVICE_ORIGIN = 'http://localhost:8085'

export function imageServiceBindingConfigured(env: Bindings): boolean {
  return env.IMAGE_VAULT !== undefined
}

export function imageUploadContentType(value: string | undefined): string {
  const contentType = ((value ?? '').split(';', 1)[0] ?? '').trim().toLowerCase()
  if (!isAllowedImageType(contentType)) {
    throw new ValidationError('JPEG, PNG, WebP, GIF, AVIF 이미지만 업로드할 수 있습니다.')
  }
  return contentType
}

function imageServiceUrl(path: string): URL {
  return new URL(path, IMAGE_SERVICE_ORIGIN)
}

export function devlogImagePublicUrl(requestUrl: string, hash: string): string {
  if (!DEVLOG_IMAGE_HASH_PATTERN.test(hash)) throw new Error('올바르지 않은 이미지 해시입니다.')
  return new URL(`${DEVLOG_IMAGE_PUBLIC_PREFIX}/i/${hash}.webp`, requestUrl).toString()
}

export async function imageServiceFetch(
  env: Bindings,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!env.IMAGE_VAULT) {
    throw new HTTPException(503, { message: '이미지 VPC 서비스가 Worker에 연결되지 않았습니다.' })
  }

  return env.IMAGE_VAULT.fetch(
    new Request(imageServiceUrl(path), {
      ...init,
      redirect: 'error',
    }),
  )
}

export async function verifyImageService(env: Bindings): Promise<void> {
  if (!imageServiceBindingConfigured(env)) {
    throw new ValidationError('이미지 VPC Service ID를 먼저 Worker에 연결해 주세요.')
  }

  let response: Response
  try {
    response = await imageServiceFetch(env, '/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new ValidationError('VPC를 통해 이미지 서비스의 /health에 연결할 수 없습니다.')
  }

  await response.body?.cancel()
  if (!response.ok) throw new ValidationError(`이미지 서비스 상태 확인에 실패했습니다. (${response.status})`)
}

export async function imageServiceCredentials(env: Bindings): Promise<{ token: string }> {
  if (!imageServiceBindingConfigured(env)) {
    throw new HTTPException(503, { message: '이미지 VPC 서비스가 Worker에 연결되지 않았습니다.' })
  }

  const record = await getImageServiceRecord(env.DB)
  if (!record || record.enabled !== 1) {
    throw new HTTPException(503, { message: '개발일지 이미지 서비스가 활성화되지 않았습니다.' })
  }

  return {
    token: await decryptSecret(record.token_ciphertext, env.SESSION_SECRET),
  }
}
