import { createHash, randomUUID } from 'node:crypto'
import { access, mkdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { HttpError } from './errors.js'

const ACCEPTED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])

const ACCEPTED_SHARP_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'heif', 'avif'])
const HASH_PATTERN = /^[a-f0-9]{64}$/u

async function exists(path) {
  try {
    await access(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function storedRelativePath(hash) {
  return join('objects', 'sha256', hash.slice(0, 2), hash.slice(2, 4), `${hash}.webp`)
}

export class ImageStore {
  constructor(config) {
    this.root = config.storageRoot
    this.maxImageWidth = config.maxImageWidth
    this.maxImageHeight = config.maxImageHeight
    this.maxInputPixels = config.maxInputPixels
    this.webpQuality = config.webpQuality
  }

  async initialize() {
    await mkdir(join(this.root, 'objects', 'sha256'), { recursive: true, mode: 0o750 })
  }

  pathForHash(hash) {
    if (!HASH_PATTERN.test(hash)) throw new HttpError(404, 'Image not found.', 'not_found')
    return join(this.root, storedRelativePath(hash))
  }

  async store(input, declaredContentType) {
    if (!ACCEPTED_CONTENT_TYPES.has(declaredContentType)) {
      throw new HttpError(
        415,
        'Only JPEG, PNG, WebP, GIF, and AVIF images are accepted.',
        'unsupported_media_type',
      )
    }

    let metadata
    try {
      metadata = await sharp(input, {
        failOn: 'warning',
        limitInputPixels: this.maxInputPixels,
        animated: true,
      }).metadata()
    } catch {
      throw new HttpError(400, 'The uploaded file is not a valid supported image.', 'invalid_image')
    }

    if (!metadata.format || !ACCEPTED_SHARP_FORMATS.has(metadata.format)) {
      throw new HttpError(415, 'The decoded image format is not supported.', 'unsupported_media_type')
    }
    if ((metadata.pages ?? 1) > 1) {
      throw new HttpError(415, 'Animated images are not supported.', 'animated_image')
    }
    if (!metadata.width || !metadata.height) {
      throw new HttpError(400, 'The image dimensions could not be determined.', 'invalid_image')
    }

    let transformed
    try {
      transformed = await sharp(input, {
        failOn: 'warning',
        limitInputPixels: this.maxInputPixels,
      })
        .rotate()
        .resize({
          width: this.maxImageWidth,
          height: this.maxImageHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: this.webpQuality,
          effort: 4,
          smartSubsample: true,
        })
        .toBuffer({ resolveWithObject: true })
    } catch {
      throw new HttpError(400, 'The image could not be normalized.', 'invalid_image')
    }

    const hash = createHash('sha256').update(transformed.data).digest('hex')
    const targetPath = this.pathForHash(hash)
    const alreadyStored = await exists(targetPath)

    if (!alreadyStored) {
      const targetDirectory = dirname(targetPath)
      const temporaryPath = join(targetDirectory, `.${hash}.${randomUUID()}.tmp`)
      await mkdir(targetDirectory, { recursive: true, mode: 0o750 })
      await writeFile(temporaryPath, transformed.data, { flag: 'wx', mode: 0o640 })
      try {
        if (await exists(targetPath)) {
          await rm(temporaryPath, { force: true })
        } else {
          await rename(temporaryPath, targetPath)
        }
      } finally {
        await rm(temporaryPath, { force: true })
      }
    }

    return {
      hash,
      created: !alreadyStored,
      contentType: 'image/webp',
      sizeBytes: transformed.data.length,
      width: transformed.info.width,
      height: transformed.info.height,
    }
  }

  async metadata(hash) {
    const path = this.pathForHash(hash)
    try {
      const file = await stat(path)
      if (!file.isFile()) return null
      return { path, sizeBytes: file.size }
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      throw error
    }
  }

  async read(hash) {
    const file = await this.metadata(hash)
    if (!file) return null
    return { ...file, data: await readFile(file.path) }
  }

  async delete(hash) {
    const path = this.pathForHash(hash)
    try {
      await unlink(path)
      return true
    } catch (error) {
      if (error?.code === 'ENOENT') return false
      throw error
    }
  }
}
