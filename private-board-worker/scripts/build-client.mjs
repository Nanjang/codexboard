import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const root = resolve(import.meta.dirname, '..')
const outputDir = resolve(root, 'public/assets')

await mkdir(outputDir, { recursive: true })

await build({
  entryPoints: [resolve(root, 'src/client/app.ts')],
  outfile: resolve(outputDir, 'app.js'),
  bundle: true,
  minify: true,
  sourcemap: false,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  legalComments: 'eof',
  logLevel: 'info',
})
