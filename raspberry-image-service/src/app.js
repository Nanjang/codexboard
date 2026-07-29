import { createServer } from 'node:http'
import { performance } from 'node:perf_hooks'
import { hasServiceAuthorization } from './auth.js'
import { HttpError } from './errors.js'
import { contentTypeForExtension, ImageStore } from './image-store.js'

const IMAGE_PATH = /^\/i\/([a-f0-9]{64})\.(jpg|png|webp|gif|avif)$/u
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

function commonHeaders() {
  return {
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  }
}

function writeHead(response, status, headers) {
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value)
  response.writeHead(status)
}

function sendJson(response, status, body, extraHeaders = {}) {
  const data = Buffer.from(JSON.stringify(body))
  writeHead(response, status, {
    ...commonHeaders(),
    'Cache-Control': 'no-store',
    'Content-Length': String(data.length),
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  })
  response.end(data)
}

function sendEmpty(response, status, headers = {}) {
  writeHead(response, status, { ...commonHeaders(), ...headers })
  response.end()
}

function requireAuthorization(request, config) {
  if (!hasServiceAuthorization(request.headers.authorization, config.serviceToken)) {
    throw new HttpError(401, 'Authentication required.', 'unauthorized')
  }
}

async function requestBody(request, maximumBytes) {
  const declaredLength = Number.parseInt(request.headers['content-length'] ?? '', 10)
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    request.resume()
    throw new HttpError(413, 'The image exceeds the upload size limit.', 'payload_too_large')
  }

  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > maximumBytes) {
      throw new HttpError(413, 'The image exceeds the upload size limit.', 'payload_too_large')
    }
    chunks.push(chunk)
  }
  if (length === 0) throw new HttpError(400, 'The request body is empty.', 'empty_body')
  return Buffer.concat(chunks, length)
}

function contentType(request) {
  return (request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase()
}

function imageUrl(config, hash, extension) {
  return `${config.publicBaseUrl}/i/${hash}.${extension}`
}

function observeImageAccess(request, response, pathname, logger) {
  if ((request.method !== 'GET' && request.method !== 'HEAD') || !IMAGE_PATH.test(pathname)) return

  const startedAt = performance.now()
  response.once('finish', () => {
    const declaredLength = Number.parseInt(String(response.getHeader('Content-Length') ?? ''), 10)
    logger.log(
      JSON.stringify({
        event: 'image_access',
        method: request.method,
        path: pathname,
        status: response.statusCode,
        contentLength: Number.isFinite(declaredLength) ? declaredLength : 0,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      }),
    )
  })
}

export async function createImageServer(config, { accessLogger = console } = {}) {
  const store = new ImageStore(config)
  await store.initialize()

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      observeImageAccess(request, response, url.pathname, accessLogger)

      if (url.pathname === '/health') {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          sendJson(response, 405, { error: 'method_not_allowed' }, { Allow: 'GET, HEAD' })
          return
        }
        if (request.method === 'HEAD') {
          sendEmpty(response, 200, { 'Cache-Control': 'no-store' })
          return
        }
        sendJson(response, 200, { status: 'ok' })
        return
      }

      if (url.pathname === '/upload') {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'method_not_allowed' }, { Allow: 'POST' })
          return
        }
        requireAuthorization(request, config)
        const input = await requestBody(request, config.maxUploadBytes)
        const stored = await store.store(input, contentType(request))
        sendJson(response, stored.created ? 201 : 200, {
          hash: stored.hash,
          extension: stored.extension,
          url: imageUrl(config, stored.hash, stored.extension),
          contentType: stored.contentType,
          sizeBytes: stored.sizeBytes,
          width: stored.width,
          height: stored.height,
          deduplicated: !stored.created,
        })
        return
      }

      const imageMatch = IMAGE_PATH.exec(url.pathname)
      if (imageMatch) {
        const hash = imageMatch[1]
        const extension = imageMatch[2]
        const imageContentType = contentTypeForExtension(extension)
        if (!imageContentType) {
          sendJson(response, 404, { error: 'not_found' })
          return
        }

        if (request.method === 'DELETE') {
          requireAuthorization(request, config)
          const deleted = await store.delete(hash, extension)
          if (!deleted) {
            sendJson(response, 404, { error: 'not_found' })
            return
          }
          sendEmpty(response, 204, { 'Cache-Control': 'no-store' })
          return
        }

        if (request.method !== 'GET' && request.method !== 'HEAD') {
          sendJson(response, 405, { error: 'method_not_allowed' }, { Allow: 'GET, HEAD, DELETE' })
          return
        }

        const etag = `"sha256-${hash}"`
        const file = await store.metadata(hash, extension)
        if (!file) {
          sendJson(response, 404, { error: 'not_found' })
          return
        }
        if (request.headers['if-none-match'] === etag) {
          sendEmpty(response, 304, {
            'Cache-Control': IMMUTABLE_CACHE_CONTROL,
            ETag: etag,
          })
          return
        }

        const headers = {
          ...commonHeaders(),
          'Accept-Ranges': 'none',
          'Cache-Control': IMMUTABLE_CACHE_CONTROL,
          'Content-Length': String(file.sizeBytes),
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Content-Type': imageContentType,
          ETag: etag,
        }
        if (request.method === 'HEAD') {
          sendEmpty(response, 200, headers)
          return
        }

        const image = await store.read(hash, extension)
        if (!image) {
          sendJson(response, 404, { error: 'not_found' })
          return
        }
        writeHead(response, 200, headers)
        response.end(image.data)
        return
      }

      sendJson(response, 404, { error: 'not_found' })
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.code, message: error.message })
        return
      }
      console.error('Unhandled request error', error)
      sendJson(response, 500, { error: 'internal_error' })
    }
  })

  server.requestTimeout = 30_000
  server.headersTimeout = 10_000
  server.keepAliveTimeout = 5_000
  return server
}
