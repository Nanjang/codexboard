import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import sharp from 'sharp'
import { createImageServer } from '../src/app.js'
import { loadConfig } from '../src/config.js'

const token = 'test-token-with-at-least-thirty-two-bytes'
let baseUrl
let server
let storageRoot
let png

before(async () => {
  storageRoot = await mkdtemp(join(tmpdir(), 'codexboard-images-'))
  server = await createImageServer({
    storageRoot,
    publicBaseUrl: 'https://img.example.com',
    serviceToken: token,
    maxUploadBytes: 1024 * 1024,
    maxImageWidth: 4096,
    maxImageHeight: 4096,
    maxInputPixels: 40_000_000,
    webpQuality: 82,
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
  png = await sharp({
    create: {
      width: 40,
      height: 20,
      channels: 4,
      background: { r: 12, g: 34, b: 56, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
})

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  if (storageRoot) await rm(storageRoot, { recursive: true, force: true })
})

test('health endpoint is public', async () => {
  const response = await fetch(`${baseUrl}/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('configuration requires an absolute storage path and a strong service token', () => {
  assert.throws(
    () =>
      loadConfig({
        IMAGE_STORAGE_ROOT: 'relative-storage',
        PUBLIC_BASE_URL: 'https://img.example.com',
        IMAGE_SERVICE_TOKEN: token,
      }),
    /IMAGE_STORAGE_ROOT must be an absolute path/u,
  )

  assert.throws(
    () =>
      loadConfig({
        IMAGE_STORAGE_ROOT: storageRoot,
        PUBLIC_BASE_URL: 'https://img.example.com',
        IMAGE_SERVICE_TOKEN: 'short',
      }),
    /IMAGE_SERVICE_TOKEN must contain at least 32 bytes/u,
  )
})

test('upload requires service authorization', async () => {
  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: png,
  })
  assert.equal(response.status, 401)
})

test('normalizes, stores, serves, deduplicates, and deletes an image', async () => {
  const upload = () =>
    fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/png',
      },
      body: png,
    })

  const firstResponse = await upload()
  assert.equal(firstResponse.status, 201)
  const first = await firstResponse.json()
  assert.match(first.hash, /^[a-f0-9]{64}$/u)
  assert.equal(first.contentType, 'image/webp')
  assert.equal(first.deduplicated, false)
  assert.equal(first.url, `https://img.example.com/i/${first.hash}.webp`)

  const imageResponse = await fetch(`${baseUrl}/i/${first.hash}.webp`)
  assert.equal(imageResponse.status, 200)
  assert.equal(imageResponse.headers.get('content-type'), 'image/webp')
  assert.equal(imageResponse.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  const etag = imageResponse.headers.get('etag')
  assert.equal(etag, `"sha256-${first.hash}"`)
  assert.ok((await imageResponse.arrayBuffer()).byteLength > 0)

  const notModified = await fetch(`${baseUrl}/i/${first.hash}.webp`, {
    headers: { 'If-None-Match': etag },
  })
  assert.equal(notModified.status, 304)

  const secondResponse = await upload()
  assert.equal(secondResponse.status, 200)
  const second = await secondResponse.json()
  assert.equal(second.hash, first.hash)
  assert.equal(second.deduplicated, true)

  const unauthorizedDelete = await fetch(`${baseUrl}/i/${first.hash}.webp`, { method: 'DELETE' })
  assert.equal(unauthorizedDelete.status, 401)

  const deleted = await fetch(`${baseUrl}/i/${first.hash}.webp`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(deleted.status, 204)

  const missing = await fetch(`${baseUrl}/i/${first.hash}.webp`)
  assert.equal(missing.status, 404)
})

test('rejects unsupported content types and oversized bodies', async () => {
  const unsupported = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: png,
  })
  assert.equal(unsupported.status, 415)

  const oversized = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/png',
    },
    body: Buffer.alloc(1024 * 1024 + 1),
  })
  assert.equal(oversized.status, 413)
})
