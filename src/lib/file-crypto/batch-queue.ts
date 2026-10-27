export type PlatformType = 'web' | 'pwa' | 'android'

// Limites de tamanho por plataforma (em bytes).
// Web (navegador convencional): 5 GB total.
// PWA e Android: 1 GB total.
// O limite é em GB total do lote, não em quantidade de arquivos.
const PLATFORM_LIMITS: Record<PlatformType, { maxTotalBytes: number; maxSingleFileBytes: number }> = {
  web: {
    maxTotalBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    maxSingleFileBytes: 5 * 1024 * 1024 * 1024, // 5 GB
  },
  pwa: {
    maxTotalBytes: 1 * 1024 * 1024 * 1024, // 1 GB
    maxSingleFileBytes: 1 * 1024 * 1024 * 1024, // 1 GB
  },
  android: {
    maxTotalBytes: 1 * 1024 * 1024 * 1024, // 1 GB
    maxSingleFileBytes: 1 * 1024 * 1024 * 1024, // 1 GB
  },
}

/**
 * Detecta o tipo de plataforma atual.
 * - android: app nativo Capacitor (Android WebView)
 * - pwa: navegador em modo standalone (PWA instalado)
 * - web: navegador convencional (não PWA, não nativo)
 */
export function getPlatformType(): PlatformType {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'web'
  }

  const customWindow = window as Window & {
    Capacitor?: {
      isNative?: boolean
      getPlatform?: () => string
    }
  }

  // Detecta app nativo Capacitor (Android)
  const isNative = Boolean(
    customWindow.Capacitor?.isNative ||
    customWindow.Capacitor?.getPlatform?.() !== 'web' ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:'
  )
  if (isNative) {
    return 'android'
  }

  // Detecta PWA (modo standalone/fullscreen)
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone) ||
    document.referrer.startsWith('android-app://')
  ) {
    return 'pwa'
  }

  return 'web'
}

export function getMaxTotalBytes(platform?: PlatformType): number {
  return PLATFORM_LIMITS[platform ?? getPlatformType()].maxTotalBytes
}

export function getMaxSingleFileBytes(platform?: PlatformType): number {
  return PLATFORM_LIMITS[platform ?? getPlatformType()].maxSingleFileBytes
}

export const MAX_MOBILE_CONCURRENCY = 1
export const MAX_DESKTOP_CONCURRENCY = 2

export type BatchFileValidationErrorCode =
  | 'SINGLE_FILE_TOO_LARGE'
  | 'TOTAL_SIZE_EXCEEDED'

export type BatchFileLike = Pick<File, 'name' | 'size'>

export type BatchFileValidationResult =
  | {
      valid: true
      code: null
      fileCount: number
      totalBytes: number
      totalMegabytes: number
      totalMegabytesFormatted: string
      message: null
    }
  | {
      valid: false
      code: BatchFileValidationErrorCode
      fileCount: number
      totalBytes: number
      totalMegabytes: number
      totalMegabytesFormatted: string
      offendingFileName?: string
      offendingFileBytes?: number
      offendingFileMegabytesFormatted?: string
      message: string
    }

export function formatMegabytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0.00'
  }

  const megabytes = bytes / (1024 * 1024)
  if (megabytes > 0 && megabytes < 0.01) {
    return '0.01'
  }

  return megabytes.toFixed(2)
}

export function validateBatchFileSelection(
  files: readonly BatchFileLike[],
  platform?: PlatformType,
): BatchFileValidationResult {
  const fileCount = files.length
  const totalBytes = files.reduce((sum, file) => sum + Math.max(0, file.size), 0)
  const totalMegabytes = totalBytes / (1024 * 1024)
  const totalMegabytesFormatted = formatMegabytes(totalBytes)

  const resolvedPlatform = platform ?? getPlatformType()
  const maxTotalBytes = getMaxTotalBytes(resolvedPlatform)
  const maxSingleFileBytes = getMaxSingleFileBytes(resolvedPlatform)
  const maxTotalGb = Math.round(maxTotalBytes / (1024 * 1024 * 1024) * 10) / 10

  const oversizedFile = files.find((file) => file.size > maxSingleFileBytes)
  if (oversizedFile) {
    const offendingFileMegabytesFormatted = formatMegabytes(oversizedFile.size)
    return {
      valid: false,
      code: 'SINGLE_FILE_TOO_LARGE',
      fileCount,
      totalBytes,
      totalMegabytes,
      totalMegabytesFormatted,
      offendingFileName: oversizedFile.name,
      offendingFileBytes: oversizedFile.size,
      offendingFileMegabytesFormatted,
      message: `O ficheiro "${oversizedFile.name}" (${offendingFileMegabytesFormatted} MB) excede o limite individual de ${maxTotalGb} GB por ficheiro.`,
    }
  }

  if (totalBytes > maxTotalBytes) {
    return {
      valid: false,
      code: 'TOTAL_SIZE_EXCEEDED',
      fileCount,
      totalBytes,
      totalMegabytes,
      totalMegabytesFormatted,
      message: `O tamanho total do lote (${totalMegabytesFormatted} MB) ultrapassa o limite máximo de ${maxTotalGb} GB.`,
    }
  }

  return {
    valid: true,
    code: null,
    fileCount,
    totalBytes,
    totalMegabytes,
    totalMegabytesFormatted,
    message: null,
  }
}

export function isMobileOrTouchEnvironment(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  if (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0) {
    return true
  }

  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  ) {
    return true
  }

  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent ?? '')
}

export function getBatchCryptoConcurrency(isTouchOrMobile?: boolean): 1 | 2 {
  const mobile = isTouchOrMobile ?? isMobileOrTouchEnvironment()
  return mobile ? MAX_MOBILE_CONCURRENCY : MAX_DESKTOP_CONCURRENCY
}

export type TransientCryptoMemoryScope = {
  trackBuffer: (buffer: ArrayBuffer | ArrayBufferView | null | undefined) => void
  trackKey: (key: CryptoKey | null | undefined) => void
  release: () => Promise<void>
}

export function createTransientCryptoMemoryScope(): TransientCryptoMemoryScope {
  const buffers: Array<ArrayBuffer | ArrayBufferView | null> = []
  const keys: Array<CryptoKey | null> = []

  return {
    trackBuffer(buffer) {
      if (buffer) {
        buffers.push(buffer)
      }
    },
    trackKey(key) {
      if (key) {
        keys.push(key)
      }
    },
    async release() {
      for (let i = 0; i < buffers.length; i += 1) {
        const current = buffers[i]
        try {
          if (current instanceof ArrayBuffer) {
            new Uint8Array(current).fill(0)
          } else if (ArrayBuffer.isView(current)) {
            new Uint8Array(
              current.buffer,
              current.byteOffset,
              current.byteLength,
            ).fill(0)
          }
        } catch {
          // Detached ArrayBuffers cannot be zeroed and are already released.
        }
        buffers[i] = null
      }
      buffers.length = 0

      for (let i = 0; i < keys.length; i += 1) {
        keys[i] = null
      }
      keys.length = 0

      // Yield to macrotask queue so Garbage Collector can reclaim transient ArrayBuffers/CryptoKeys
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
    },
  }
}

export type BatchCryptoQueueOptions = {
  concurrency?: number
  isMobileOrTouch?: boolean
  signal?: AbortSignal
  onItemSettled?: (completedCount: number, totalCount: number, index: number) => void
}

export async function runBatchCryptoQueue<TInput, TOutput>(
  items: readonly TInput[],
  processor: (
    item: TInput,
    index: number,
    memoryScope: TransientCryptoMemoryScope,
  ) => Promise<TOutput>,
  options: BatchCryptoQueueOptions = {},
): Promise<TOutput[]> {
  const totalCount = items.length
  if (totalCount === 0) {
    return []
  }

  const resolvedConcurrency = Math.max(
    1,
    Math.min(
      MAX_DESKTOP_CONCURRENCY,
      options.concurrency ?? getBatchCryptoConcurrency(options.isMobileOrTouch),
    ),
  )
  const workerCount = Math.min(resolvedConcurrency, totalCount)
  const results = new Array<TOutput>(totalCount)
  let nextIndex = 0
  let completedCount = 0

  async function runWorker() {
    while (true) {
      if (options.signal?.aborted) {
        throw new DOMException('Processamento cancelado pelo usuário.', 'AbortError')
      }

      const currentIndex = nextIndex
      if (currentIndex >= totalCount) {
        return
      }
      nextIndex += 1

      const memoryScope = createTransientCryptoMemoryScope()
      try {
        results[currentIndex] = await processor(
          items[currentIndex],
          currentIndex,
          memoryScope,
        )
      } finally {
        await memoryScope.release()
        completedCount += 1
        options.onItemSettled?.(completedCount, totalCount, currentIndex)
      }
    }
  }

  const workers = Array.from({ length: workerCount }, () => runWorker())
  await Promise.all(workers)
  return results
}

