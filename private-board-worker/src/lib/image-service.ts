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
const IMAGE_SERVICE_HEALTH_TIMEOUT_MS = 5000
const MAX_DIAGNOSTIC_TEXT_LENGTH = 240

export interface ImageServiceDiagnostic {
  label: string
  value: string
}

export class ImageServiceVerificationError extends ValidationError {
  readonly diagnostics: ImageServiceDiagnostic[]

  constructor(message: string, diagnostics: ImageServiceDiagnostic[]) {
    super(message)
    this.name = 'ImageServiceVerificationError'
    this.diagnostics = diagnostics
  }
}

function diagnosticText(value: string): string {
  const normalized = value.replaceAll(/[\u0000-\u001f\u007f]+/gu, ' ').replaceAll(/\s+/gu, ' ').trim()
  if (!normalized) return '(내용 없음)'
  return normalized.slice(0, MAX_DIAGNOSTIC_TEXT_LENGTH)
}

function diagnosticError(error: unknown): string {
  if (!(error instanceof Error)) return diagnosticText(String(error))

  const ownMessage = `${error.name}: ${error.message}`
  const cause = 'cause' in error && error.cause instanceof Error ? ` · 원인: ${error.cause.message}` : ''
  return diagnosticText(`${ownMessage}${cause}`)
}

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
    throw new ImageServiceVerificationError('이미지 VPC Service ID를 먼저 Worker에 연결해 주세요.', [
      { label: 'VPC 바인딩 확인', value: '실패 · IMAGE_VAULT 바인딩 없음' },
      { label: '상태 확인 요청', value: '실행하지 않음' },
    ])
  }

  const startedAt = Date.now()
  let response: Response
  try {
    response = await imageServiceFetch(env, '/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(IMAGE_SERVICE_HEALTH_TIMEOUT_MS),
    })
  } catch (error) {
    const elapsedMs = Date.now() - startedAt
    const runtimeError = diagnosticError(error)
    console.warn('Image service VPC health check failed', {
      elapsedMs,
      error: runtimeError,
      path: '/health',
    })
    throw new ImageServiceVerificationError('VPC를 통해 이미지 서비스의 /health에 연결할 수 없습니다.', [
      { label: 'VPC 바인딩 확인', value: '성공 · IMAGE_VAULT 사용 가능' },
      {
        label: '상태 확인 요청 준비',
        value: `성공 · GET /health · 제한시간 ${IMAGE_SERVICE_HEALTH_TIMEOUT_MS / 1000}초`,
      },
      { label: 'VPC 요청 전송', value: `실패 · ${elapsedMs}ms 경과` },
      { label: 'Cloudflare 런타임 오류', value: runtimeError },
    ])
  }

  const elapsedMs = Date.now() - startedAt
  if (!response.ok) {
    let responseBody = '(읽을 수 없음)'
    try {
      responseBody = diagnosticText(await response.text())
    } catch {
      // The status and headers are still useful when the upstream body cannot be read.
    }
    throw new ImageServiceVerificationError(`이미지 서비스 상태 확인에 실패했습니다. (${response.status})`, [
      { label: 'VPC 바인딩 확인', value: '성공 · IMAGE_VAULT 사용 가능' },
      {
        label: '상태 확인 요청 준비',
        value: `성공 · GET /health · 제한시간 ${IMAGE_SERVICE_HEALTH_TIMEOUT_MS / 1000}초`,
      },
      { label: 'VPC 요청 전송', value: `성공 · ${elapsedMs}ms` },
      {
        label: 'HTTP 응답 확인',
        value: `실패 · ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
      },
      { label: '응답 Content-Type', value: response.headers.get('Content-Type') ?? '(없음)' },
      { label: '응답 본문', value: responseBody },
    ])
  }

  await response.body?.cancel()
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
