import { isAbsolute, resolve } from 'node:path'

function integerSetting(env, name, fallback, minimum, maximum) {
  const raw = env[name]?.trim()
  if (!raw) return fallback

  const value = Number.parseInt(raw, 10)
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`)
  }
  return value
}

function publicBaseUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('PUBLIC_BASE_URL must be a valid absolute URL.')
  }

  const localDevelopment =
    url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  if (url.protocol !== 'https:' && !localDevelopment) {
    throw new Error('PUBLIC_BASE_URL must use HTTPS outside local development.')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('PUBLIC_BASE_URL must not contain credentials, a query, or a fragment.')
  }

  url.pathname = url.pathname.replace(/\/+$/u, '')
  return url.toString().replace(/\/+$/u, '')
}

export function loadConfig(env = process.env) {
  const token = env.IMAGE_SERVICE_TOKEN?.trim() ?? ''
  if (Buffer.byteLength(token) < 32) {
    throw new Error('IMAGE_SERVICE_TOKEN must contain at least 32 bytes.')
  }

  const storageValue = env.IMAGE_STORAGE_ROOT?.trim() ?? ''
  if (!storageValue) throw new Error('IMAGE_STORAGE_ROOT is required.')
  if (!isAbsolute(storageValue)) throw new Error('IMAGE_STORAGE_ROOT must be an absolute path.')
  const storageRoot = resolve(storageValue)

  const baseUrlValue = env.PUBLIC_BASE_URL?.trim() ?? ''
  if (!baseUrlValue) throw new Error('PUBLIC_BASE_URL is required.')

  return {
    host: env.HOST?.trim() || '127.0.0.1',
    port: integerSetting(env, 'PORT', 8085, 1, 65535),
    storageRoot,
    publicBaseUrl: publicBaseUrl(baseUrlValue),
    serviceToken: token,
    maxUploadBytes: integerSetting(env, 'MAX_UPLOAD_BYTES', 10 * 1024 * 1024, 1024, 100 * 1024 * 1024),
    maxImageWidth: integerSetting(env, 'MAX_IMAGE_WIDTH', 4096, 64, 20000),
    maxImageHeight: integerSetting(env, 'MAX_IMAGE_HEIGHT', 4096, 64, 20000),
    maxInputPixels: integerSetting(env, 'MAX_INPUT_PIXELS', 40_000_000, 4096, 200_000_000),
    webpQuality: integerSetting(env, 'WEBP_QUALITY', 82, 1, 100),
  }
}
