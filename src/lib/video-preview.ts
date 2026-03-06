import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

export const VIDEO_PREVIEW_COMPAT_LIMIT_BYTES = 100 * 1024 * 1024

type PreviewProgressCallback = (value: number, label: string) => void

type VideoPreviewResult = {
  blob: Blob
  fileName: string
  mimeType: string
}

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoadPromise: Promise<FFmpeg> | null = null

function getFFmpegCoreUrls() {
  return {
    coreURL: new URL('/ffmpeg/ffmpeg-core.js', window.location.origin).toString(),
    wasmURL: new URL('/ffmpeg/ffmpeg-core.wasm', window.location.origin).toString(),
  }
}

function getFFmpeg() {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg()
  }

  return ffmpegInstance
}

async function ensureFFmpegLoaded(onProgress?: PreviewProgressCallback) {
  const ffmpeg = getFFmpeg()

  if (ffmpeg.loaded) {
    return ffmpeg
  }

  if (!ffmpegLoadPromise) {
    onProgress?.(8, 'Carregando motor local de compatibilidade')
    const { coreURL, wasmURL } = getFFmpegCoreUrls()

    ffmpegLoadPromise = ffmpeg
      .load({
        coreURL,
        wasmURL,
      })
      .then(() => ffmpeg)
      .catch((error) => {
        ffmpegLoadPromise = null
        throw error
      })
  }

  return ffmpegLoadPromise
}

function buildFileBaseName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf('.')
  return lastDotIndex === -1 ? fileName : fileName.slice(0, lastDotIndex)
}

function normalizeFsName(fileName: string) {
  return fileName.replace(/[^a-z0-9._-]/gi, '_')
}

async function tryTranscodeToMp4(
  ffmpeg: FFmpeg,
  inputFsName: string,
  outputFsName: string,
) {
  await ffmpeg.exec([
    '-i',
    inputFsName,
    '-movflags',
    '+faststart',
    '-pix_fmt',
    'yuv420p',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '28',
    '-c:a',
    'aac',
    outputFsName,
  ])

  const data = await ffmpeg.readFile(outputFsName)
  return data instanceof Uint8Array ? data : new Uint8Array()
}

export async function transcodeVideoForBrowserPreview(
  source: File | Blob,
  fileName: string,
  onProgress?: PreviewProgressCallback,
): Promise<VideoPreviewResult> {
  if (source.size > VIDEO_PREVIEW_COMPAT_LIMIT_BYTES) {
    throw new Error(
      `A conversao local para preview de video aceita ate ${Math.round(
        VIDEO_PREVIEW_COMPAT_LIMIT_BYTES / (1024 * 1024),
      )} MB.`,
    )
  }

  const ffmpeg = await ensureFFmpegLoaded(onProgress)
  const inputFsName = normalizeFsName(`preview-input-${Date.now()}-${fileName}`)
  const outputFsName = normalizeFsName(`preview-output-${Date.now()}.mp4`)

  const progressHandler = ({ progress }: { progress: number }) => {
    const normalizedProgress = Math.max(0, Math.min(progress, 1))
    const visualProgress = 26 + Math.round(normalizedProgress * 64)
    onProgress?.(
      visualProgress,
      `Convertendo video localmente para MP4 compativel (${Math.round(
        normalizedProgress * 100,
      )}%)`,
    )
  }

  ffmpeg.on('progress', progressHandler)

  try {
    onProgress?.(18, 'Copiando video descriptografado para o motor local')
    await ffmpeg.writeFile(inputFsName, await fetchFile(source))
    onProgress?.(24, 'Preparando transcodificacao local')

    const outputData = await tryTranscodeToMp4(ffmpeg, inputFsName, outputFsName)

    onProgress?.(94, 'Gerando preview compativel no navegador')

    const normalizedOutput = new Uint8Array(outputData.length)
    normalizedOutput.set(outputData)

    return {
      blob: new Blob([normalizedOutput.buffer], { type: 'video/mp4' }),
      fileName: `${buildFileBaseName(fileName)}.preview.mp4`,
      mimeType: 'video/mp4',
    }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Falha ao converter o video localmente: ${error.message}`
        : 'Falha ao converter o video localmente para preview compativel.',
    )
  } finally {
    ffmpeg.off('progress', progressHandler)

    try {
      await ffmpeg.deleteFile(inputFsName)
    } catch {
      // Best-effort cleanup inside ffmpeg FS.
    }

    try {
      await ffmpeg.deleteFile(outputFsName)
    } catch {
      // Best-effort cleanup inside ffmpeg FS.
    }
  }
}
