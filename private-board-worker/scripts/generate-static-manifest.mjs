import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const publicDir = resolve(root, 'public')
const manifestRelativePath = 'assets/asset-manifest.json'
const manifestPath = resolve(publicDir, manifestRelativePath)
const checkOnly = process.argv.slice(2).includes('--check')
const unsupportedArguments = process.argv.slice(2).filter((argument) => argument !== '--check')

if (unsupportedArguments.length > 0) {
  throw new Error(`지원하지 않는 인자입니다: ${unsupportedArguments.join(', ')}`)
}

function toPublicRelativePath(filePath) {
  return relative(publicDir, filePath).split(sep).join('/')
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const filePaths = []

  entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))

  for (const entry of entries) {
    const filePath = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      filePaths.push(...(await collectFiles(filePath)))
      continue
    }

    if (entry.isSymbolicLink()) {
      throw new Error(`정적 자산 manifest에서는 심볼릭 링크를 지원하지 않습니다: ${toPublicRelativePath(filePath)}`)
    }

    if (entry.isFile() && filePath !== manifestPath) {
      filePaths.push(filePath)
    }
  }

  return filePaths
}

async function createManifest() {
  const filePaths = await collectFiles(publicDir)
  filePaths.sort((left, right) => {
    const leftPath = toPublicRelativePath(left)
    const rightPath = toPublicRelativePath(right)
    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0
  })

  const files = []

  for (const filePath of filePaths) {
    const contents = await readFile(filePath)
    const sha256 = createHash('sha256').update(contents).digest('hex')

    files.push({
      path: `/${toPublicRelativePath(filePath)}`,
      sha256,
      size: contents.byteLength,
    })
  }

  return files
}

function renderManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function isValidFileList(value) {
  return Array.isArray(value) && value.every((file) => (
    file &&
    typeof file === 'object' &&
    typeof file.path === 'string' &&
    file.path.startsWith('/') &&
    !file.path.includes('\0') &&
    !file.path.split('/').includes('..') &&
    typeof file.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(file.sha256) &&
    Number.isInteger(file.size) &&
    file.size >= 0
  ))
}

async function readExistingManifest() {
  try {
    const contents = await readFile(manifestPath, 'utf8')
    const manifest = JSON.parse(contents)

    if (manifest?.version === 1 && isIsoTimestamp(manifest.generatedAt) && isValidFileList(manifest.files)) {
      return manifest
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }

    if (error instanceof SyntaxError) {
      return null
    }

    throw error
  }

  return null
}

const files = await createManifest()
const existingManifest = await readExistingManifest()
const generatedAt = existingManifest && JSON.stringify(existingManifest.files) === JSON.stringify(files)
  ? existingManifest.generatedAt
  : new Date().toISOString()
const manifest = {
  version: 1,
  generatedAt,
  files,
}
const expected = renderManifest(manifest)

if (checkOnly) {
  let actual

  try {
    actual = await readFile(manifestPath, 'utf8')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`정적 자산 manifest가 없습니다. npm run assets:manifest를 실행하세요: ${manifestRelativePath}`)
    }
    throw error
  }

  if (existingManifest === null || actual !== expected) {
    throw new Error(`정적 자산 manifest가 최신 상태가 아닙니다. npm run assets:manifest를 실행하세요: ${manifestRelativePath}`)
  }

  console.log(`정적 자산 manifest 확인 완료: ${manifest.files.length}개 파일, generatedAt ${manifest.generatedAt}`)
} else {
  await mkdir(resolve(publicDir, 'assets'), { recursive: true })
  await writeFile(manifestPath, expected, 'utf8')
  console.log(`정적 자산 manifest 갱신 완료: ${manifest.files.length}개 파일, generatedAt ${manifest.generatedAt}`)
}
