import { execFile } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const excludedNames = new Set([
  '.git',
  '.wrangler',
  'node_modules',
  'coverage',
  'dist',
  'backups',
  'exports',
])
const excludedFiles = new Set([
  'wrangler.jsonc',
  'public/assets/app.js',
  'public/assets/app.js.map',
])
const textExtensions = new Set([
  '',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.md',
  '.yml',
  '.yaml',
  '.sql',
  '.css',
  '.html',
  '.txt',
  '.example',
  '.gitignore',
  '.npmrc',
])

const patterns = [
  { name: 'Google OAuth client secret', regex: /GOCSPX-[A-Za-z0-9_-]{20,}/g },
  { name: 'PEM private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Cloudflare API token assignment', regex: /CLOUDFLARE_API_TOKEN\s*=\s*["'][A-Za-z0-9_-]{30,}["']/g },
  {
    name: 'Google client secret assignment',
    regex: /GOOGLE_CLIENT_SECRET\s*=\s*["'](?!YOUR_|REPLACE_|<)[^"']{20,}["']/g,
  },
  {
    name: 'Session secret assignment',
    regex: /SESSION_SECRET\s*=\s*["'](?!GENERATE_|YOUR_|REPLACE_|<)[^"']{24,}["']/g,
  },
  {
    name: 'R2 secret access key assignment',
    regex: /R2_SECRET_ACCESS_KEY\s*=\s*["'](?!YOUR_|REPLACE_|<)[^"']{20,}["']/g,
  },
  {
    name: 'R2 access key ID assignment',
    regex: /R2_ACCESS_KEY_ID\s*=\s*["'](?!YOUR_|REPLACE_|<)[^"']{16,}["']/g,
  },
]

function shouldScan(relativePath) {
  if (excludedFiles.has(relativePath)) return false
  const name = relativePath.split('/').at(-1) ?? relativePath
  const extension = extname(name)
  return textExtensions.has(extension) || name.startsWith('.')
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (excludedNames.has(entry.name)) continue
    // Git 저장소가 아직 만들어지지 않은 초기 검사에서는 로컬 비밀 파일을 직접 건너뜁니다.
    if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue
    if (entry.name.startsWith('.dev.vars') && entry.name !== '.dev.vars.example') continue

    const absolute = resolve(directory, entry.name)
    const rel = relative(root, absolute).replaceAll('\\', '/')
    if (excludedFiles.has(rel)) continue

    if (entry.isDirectory()) {
      files.push(...(await walk(absolute)))
    } else if (entry.isFile() && shouldScan(rel)) {
      files.push(absolute)
    }
  }
  return files
}

async function gitCandidateFiles() {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 },
    )
    const paths = stdout
      .toString('utf8')
      .split('\0')
      .filter(Boolean)
      .filter(shouldScan)
    return [...new Set(paths)].map((path) => resolve(root, path))
  } catch {
    return null
  }
}

const candidateFiles = (await gitCandidateFiles()) ?? (await walk(root))
const findings = []

for (const file of candidateFiles) {
  let info
  try {
    info = await stat(file)
  } catch {
    continue
  }
  if (!info.isFile() || info.size > 2_000_000) continue

  const content = await readFile(file, 'utf8')
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0
    if (pattern.regex.test(content)) {
      findings.push(`${relative(root, file)}: ${pattern.name}`)
    }
  }
}

if (findings.length > 0) {
  console.error('Git 추적 후보 파일에서 비밀정보로 의심되는 값이 발견되었습니다:')
  for (const finding of findings) console.error(`- ${finding}`)
  console.error('값을 폐기·재발급하고, 파일을 Git 기록에서 제거한 뒤 다시 검사하세요.')
  process.exit(1)
}

console.log('비밀정보 패턴 검사 통과')
