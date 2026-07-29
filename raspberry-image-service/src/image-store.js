import { createHash, randomUUID } from 'node:crypto'
import { access, mkdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { HttpError } from './errors.js'

const IMAGE_FORMATS = new Map([
  ['image/jpeg', { extension: 'jpg', decodedFormats: new Set(['jpeg']) }],
  ['image/png', { extension: 'png', decodedFormats: new Set(['png']) }],
  ['image/webp', { extension: 'webp', decodedFormats: new Set(['webp']) }],
  ['image/gif', { extension: 'gif', decodedFormats: new Set(['gif']) }],
  ['image/avif', { extension: 'avif', decodedFormats: new Set(['heif', 'avif']) }],
])
const CONTENT_TYPES_BY_EXTENSION = new Map(
  Array.from(IMAGE_FORMATS, ([contentType, { extension }]) => [extension, contentType]),
)
const HASH_PATTERN = /^[a-f0-9]{64}$/u
const EXTENSION_PATTERN = /^(?:jpg|png|webp|gif|avif)$/u

async function exists(path) {
  try {
    await access(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function storedRelativePath(hash, extension) {
  return join('objects', 'sha256', hash.slice(0, 2), hash.slice(2, 4), `${hash}.${extension}`)
}

export function contentTypeForExtension(extension) {
  return CONTENT_TYPES_BY_EXTENSION.get(extension) ?? null
}

export class ImageStore {
  constructor(config) {
    this.root = config.storageRoot
    this.maxInputPixels = config.maxInputPixels
  }

  async initialize() {
    await mkdir(join(this.root, 'objects', 'sha256'), { recursive: true, mode: 0o750 })
  }

  pathForObject(hash, extension) {
    if (!HASH_PATTERN.test(hash)) throw new HttpError(404, 'Image not found.', 'not_found')
    if (!EXTENSION_PATTERN.test(extension)) {
      throw new HttpError(404, 'Image not found.', 'not_found')
    }
    return join(this.root, storedRelativePath(hash, extension))
  }

  async store(input, declaredContentType) {
    const imageFormat = IMAGE_FORMATS.get(declaredContentType)
    if (!imageFormat) {
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

    if (!metadata.format || !imageFormat.decodedFormats.has(metadata.format)) {
      throw new HttpError(
        415,
        'The declared content type does not match the decoded image.',
        'content_type_mismatch',
      )
    }
    if (!metadata.width || !metadata.height) {
      throw new HttpError(400, 'The image dimensions could not be determined.', 'invalid_image')
    }

    const hash = createHash('sha256').update(input).digest('hex')
    const targetPath = this.pathForObject(hash, imageFormat.extension)
    const alreadyStored = await exists(targetPath)

    if (!alreadyStored) {
      const targetDirectory = dirname(targetPath)
      const temporaryPath = join(targetDirectory, `.${hash}.${randomUUID()}.tmp`)
      await mkdir(targetDirectory, { recursive: true, mode: 0o750 })
      await writeFile(temporaryPath, input, { flag: 'wx', mode: 0o640 })
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
      extension: imageFormat.extension,
      contentType: declaredContentType,
      sizeBytes: input.length,
      width: metadata.width,
      height: metadata.height,
    }
  }

  async metadata(hash, extension) {
    const path = this.pathForObject(hash, extension)
    try {
      const file = await stat(path)
      if (!file.isFile()) return null
      return { path, sizeBytes: file.size }
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      throw error
    }
  }

  async read(hash, extension) {
    const file = await this.metadata(hash, extension)
    if (!file) return null
    return { ...file, data: await readFile(file.path) }
  }

  async delete(hash, extension) {
    const path = this.pathForObject(hash, extension)
    try {
      await unlink(path)
      return true
    } catch (error) {
      if (error?.code === 'ENOENT') return false
      throw error
    }
  }
}
