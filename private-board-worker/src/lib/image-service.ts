import { HTTPException } from 'hono/http-exception'
import type { Bindings } from '../types'
import { decryptSecret } from './secret-box'
import { getImageServiceRecord } from './db'
import { ValidationError } from './validation'

export const DEVLOG_IMAGE_MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

export function normalizeImageServiceBaseUrl(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') throw new ValidationError('이미지 서비스 주소를 입력해 주세요.')

  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new ValidationError('올바른 이미지 서비스 URL을 입력해 주세요.')
  }

  const hostname = url.hostname.toLowerCase()
  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    !hostname.includes('.') ||
    /^\[?[0-9a-f:.]+\]?$/iu.test(hostname)
  ) {
    throw new ValidationError('이미지 서비스는 표준 HTTPS 공개 도메인을 사용해야 합니다.')
  }

  url.pathname = url.pathname.replace(/\/+$/u, '')
  return url.toString().replace(/\/+$/u, '')
}

export function imageUploadContentType(value: string | undefined): string {
  const contentType = ((value ?? '').split(';', 1)[0] ?? '').trim().toLowerCase()
  if (!ACCEPTED_IMAGE_TYPES.has(contentType)) {
    throw new ValidationError('JPEG, PNG, WebP, GIF, AVIF 이미지만 업로드할 수 있습니다.')
  }
  return contentType
}

export async function verifyImageService(baseUrl: string): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new ValidationError('이미지 서비스의 /health에 연결할 수 없습니다.')
  }

  await response.body?.cancel()
  if (!response.ok) throw new ValidationError(`이미지 서비스 상태 확인에 실패했습니다. (${response.status})`)
}

export async function imageServiceCredentials(env: Bindings): Promise<{ baseUrl: string; token: string }> {
  const record = await getImageServiceRecord(env.DB)
  if (!record || record.enabled !== 1) {
    throw new HTTPException(503, { message: '개발일지 이미지 서비스가 활성화되지 않았습니다.' })
  }

  return {
    baseUrl: record.base_url,
    token: await decryptSecret(record.token_ciphertext, env.SESSION_SECRET),
  }
}
