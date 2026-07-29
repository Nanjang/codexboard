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
let jpeg
let webp
let animatedGif
let avif
const accessLogs = []

before(async () => {
  storageRoot = await mkdtemp(join(tmpdir(), 'codexboard-images-'))
  server = await createImageServer(
    {
      storageRoot,
      publicBaseUrl: 'https://img.example.com',
      serviceToken: token,
      maxUploadBytes: 1024 * 1024,
      maxInputPixels: 40_000_000,
    },
    {
      accessLogger: {
        log(line) {
          accessLogs.push(JSON.parse(line))
        },
      },
    },
  )
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
  jpeg = await sharp({
    create: {
      width: 40,
      height: 20,
      channels: 3,
      background: { r: 90, g: 80, b: 70 },
    },
  })
    .jpeg()
    .toBuffer()
  webp = await sharp(png).webp().toBuffer()
  animatedGif = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAQABAAACAkQBACH5BAAKAAAALAAAAAABAAEAAAICTAEAOw==',
    'base64',
  )
  avif = await sharp(png).avif().toBuffer()
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

test('preserves, stores, serves, deduplicates, and deletes a PNG image', async () => {
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
  assert.equal(first.extension, 'png')
  assert.equal(first.contentType, 'image/png')
  assert.equal(first.deduplicated, false)
  assert.equal(first.url, `https://img.example.com/i/${first.hash}.png`)

  const imageResponse = await fetch(`${baseUrl}/i/${first.hash}.png`)
  assert.equal(imageResponse.status, 200)
  assert.equal(imageResponse.headers.get('content-type'), 'image/png')
  assert.equal(imageResponse.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  const etag = imageResponse.headers.get('etag')
  assert.equal(etag, `"sha256-${first.hash}"`)
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), png)

  const notModified = await fetch(`${baseUrl}/i/${first.hash}.png`, {
    headers: { 'If-None-Match': etag },
  })
  assert.equal(notModified.status, 304)

  assert.deepEqual(
    accessLogs.slice(-2).map(({ event, method, path, status, contentLength }) => ({
      event,
      method,
      path,
      status,
      contentLength,
    })),
    [
      {
        event: 'image_access',
        method: 'GET',
        path: `/i/${first.hash}.png`,
        status: 200,
        contentLength: png.length,
      },
      {
        event: 'image_access',
        method: 'GET',
        path: `/i/${first.hash}.png`,
        status: 304,
        contentLength: 0,
      },
    ],
  )
  assert.equal(typeof accessLogs.at(-1).durationMs, 'number')

  const secondResponse = await upload()
  assert.equal(secondResponse.status, 200)
  const second = await secondResponse.json()
  assert.equal(second.hash, first.hash)
  assert.equal(second.deduplicated, true)

  const unauthorizedDelete = await fetch(`${baseUrl}/i/${first.hash}.png`, { method: 'DELETE' })
  assert.equal(unauthorizedDelete.status, 401)

  const deleted = await fetch(`${baseUrl}/i/${first.hash}.png`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(deleted.status, 204)

  const missing = await fetch(`${baseUrl}/i/${first.hash}.png`)
  assert.equal(missing.status, 404)
})

test('preserves JPEG, WebP, animated GIF, and AVIF bytes with canonical extensions', async () => {
  for (const example of [
    { body: jpeg, contentType: 'image/jpeg', extension: 'jpg' },
    { body: webp, contentType: 'image/webp', extension: 'webp' },
    { body: animatedGif, contentType: 'image/gif', extension: 'gif' },
    { body: avif, contentType: 'image/avif', extension: 'avif' },
  ]) {
    const upload = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': example.contentType,
      },
      body: example.body,
    })
    assert.equal(upload.status, 201)
    const stored = await upload.json()
    assert.equal(stored.extension, example.extension)
    assert.equal(stored.contentType, example.contentType)
    assert.equal(stored.url, `https://img.example.com/i/${stored.hash}.${example.extension}`)

    const imageResponse = await fetch(`${baseUrl}/i/${stored.hash}.${example.extension}`)
    assert.equal(imageResponse.status, 200)
    assert.equal(imageResponse.headers.get('content-type'), example.contentType)
    assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), example.body)
  }
})

test('rejects mismatched or unsupported content types and oversized bodies', async () => {
  const mismatched = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
    },
    body: png,
  })
  assert.equal(mismatched.status, 415)

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
