import { createServer } from 'node:http'
import { hasServiceAuthorization } from './auth.js'
import { HttpError } from './errors.js'
import { ImageStore } from './image-store.js'

const IMAGE_PATH = /^\/i\/([a-f0-9]{64})\.webp$/u
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

function commonHeaders() {
  return {
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  }
}

function sendJson(response, status, body, extraHeaders = {}) {
  const data = Buffer.from(JSON.stringify(body))
  response.writeHead(status, {
    ...commonHeaders(),
    'Cache-Control': 'no-store',
    'Content-Length': String(data.length),
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  })
  response.end(data)
}

function sendEmpty(response, status, headers = {}) {
  response.writeHead(status, { ...commonHeaders(), ...headers })
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

function imageUrl(config, hash) {
  return `${config.publicBaseUrl}/i/${hash}.webp`
}

export async function createImageServer(config) {
  const store = new ImageStore(config)
  await store.initialize()

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')

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
          url: imageUrl(config, stored.hash),
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

        if (request.method === 'DELETE') {
          requireAuthorization(request, config)
          const deleted = await store.delete(hash)
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
        const file = await store.metadata(hash)
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
          'Content-Type': 'image/webp',
          ETag: etag,
        }
        if (request.method === 'HEAD') {
          sendEmpty(response, 200, headers)
          return
        }

        const image = await store.read(hash)
        if (!image) {
          sendJson(response, 404, { error: 'not_found' })
          return
        }
        response.writeHead(200, headers)
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
