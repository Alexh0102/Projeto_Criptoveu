import { cp, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const sourceDir = resolve(projectRoot, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd')
const targetDir = resolve(projectRoot, 'public', 'ffmpeg')

async function main() {
  await mkdir(targetDir, { recursive: true })
  await cp(resolve(sourceDir, 'ffmpeg-core.js'), resolve(targetDir, 'ffmpeg-core.js'))
  await cp(resolve(sourceDir, 'ffmpeg-core.wasm'), resolve(targetDir, 'ffmpeg-core.wasm'))
  process.stdout.write('[prepare-ffmpeg] core local copiado para public/ffmpeg\n')
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
