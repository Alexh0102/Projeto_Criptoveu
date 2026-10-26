const LEGACY_FILE_HEADER_TEXT = 'CRIPTIFY1'
import argon2WorkerUrl from '../workers/argon2.worker.ts?worker&url'
import opfsCryptoWorkerUrl from '../workers/opfs-crypto.worker.ts?worker&url'
import {
  FileIntegrityError,
  MAX_FILE_INTEGRITY_MANIFEST_BYTES,
  assertIntegrityHashes,
  createFileIntegrityManifest,
  hashBlobIntegrity,
  parseFileIntegrityManifest,
  serializeFileIntegrityManifest,
  type FileIntegrityFormat,
  type FileIntegrityManifest,
} from './file-integrity'
import {
  KeyFileProtectionError,
  assertValidKeyFile,
  derivePasswordKeyFileMaterial,
} from './key-file-protection'
import { getOpfsRoot } from './opfs'
import { resolvePreviewMimeType } from './file-preview'
export {
  MAX_FILES,
  MAX_SINGLE_FILE_BYTES,
  MAX_TOTAL_BYTES,
  formatMegabytes,
  getBatchCryptoConcurrency,
  isMobileOrTouchEnvironment,
  runBatchCryptoQueue,
  validateBatchFileSelection,
  type BatchCryptoQueueOptions,
  type BatchFileValidationResult,
  type TransientCryptoMemoryScope,
} from './file-crypto/batch-queue'


const LEGACY_CHUNKED_FILE_HEADER_TEXT = 'CRIPTIFY2'
const PBKDF2_CHUNKED_FILE_HEADER_TEXT = 'CRIPTOVEU2'
const ARGON2_CHUNKED_FILE_HEADER_TEXT = 'CRIPTOVEU3'
const INTEGRITY_CHUNKED_FILE_HEADER_TEXT = 'CRIPTOVEU4'
const KEY_FILE_CHUNKED_FILE_HEADER_TEXT = 'CRIPTOVEU5'
const RECOVERABLE_CHUNKED_FILE_HEADER_TEXT = 'CRIPTOVEU6'
const LEGACY_FILE_HEADER_BYTES = new TextEncoder().encode(LEGACY_FILE_HEADER_TEXT)
const LEGACY_CHUNKED_FILE_HEADER_BYTES = new TextEncoder().encode(
  LEGACY_CHUNKED_FILE_HEADER_TEXT,
)
const PBKDF2_CHUNKED_FILE_HEADER_BYTES = new TextEncoder().encode(
  PBKDF2_CHUNKED_FILE_HEADER_TEXT,
)
const ARGON2_CHUNKED_FILE_HEADER_BYTES = new TextEncoder().encode(
  ARGON2_CHUNKED_FILE_HEADER_TEXT,
)
const INTEGRITY_CHUNKED_FILE_HEADER_BYTES = new TextEncoder().encode(
  INTEGRITY_CHUNKED_FILE_HEADER_TEXT,
)
const KEY_FILE_CHUNKED_FILE_HEADER_BYTES = new TextEncoder().encode(
  KEY_FILE_CHUNKED_FILE_HEADER_TEXT,
)
const RECOVERABLE_CHUNKED_FILE_HEADER_BYTES = new TextEncoder().encode(
  RECOVERABLE_CHUNKED_FILE_HEADER_TEXT,
)
const SALT_LENGTH_BYTES = 16
const IV_LENGTH_BYTES = 12
const PBKDF2_ITERATIONS = 600_000
const BASE64_CHUNK_SIZE_BYTES = 0x8000
const CHUNK_RECORD_LENGTH_BYTES = 4
const INTEGRITY_RECORD_TYPE_BYTES = 1
const INTEGRITY_RECORD_HEADER_BYTES =
  INTEGRITY_RECORD_TYPE_BYTES + CHUNK_RECORD_LENGTH_BYTES
const INTEGRITY_DATA_RECORD_TYPE = 1
const INTEGRITY_MANIFEST_RECORD_TYPE = 2
const RECOVERABLE_PARITY_RECORD_TYPE = 3
export const RECOVERABLE_PARITY_GROUP_SIZE = 4
const ARGON2_PARAMETER_LENGTH_BYTES = 4
const ARGON2_MIN_MEMORY_MB = 8
const ARGON2_MAX_MEMORY_MB = 512
const ARGON2_MIN_ITERATIONS = 1
const ARGON2_MAX_ITERATIONS = 10
const AES_GCM_TAG_LENGTH_BYTES = 16
const ARGON2_HEADER_LENGTH_BYTES =
  ARGON2_CHUNKED_FILE_HEADER_BYTES.length +
  ARGON2_PARAMETER_LENGTH_BYTES * 2 +
  SALT_LENGTH_BYTES +
  IV_LENGTH_BYTES
const INTEGRITY_HEADER_LENGTH_BYTES =
  INTEGRITY_CHUNKED_FILE_HEADER_BYTES.length +
  ARGON2_PARAMETER_LENGTH_BYTES * 2 +
  SALT_LENGTH_BYTES +
  IV_LENGTH_BYTES +
  CHUNK_RECORD_LENGTH_BYTES * 2
export const ARGON2_FILE_ITERATIONS = 2
export const STREAMING_CHUNK_SIZE_BYTES = 2 * 1024 * 1024
export const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1 GB em bytes (1073741824 bytes)
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE
export const MAX_FILE_SIZE_READABLE = '1 GB'
export const MAX_FILE_SIZE_EXCEEDED_MESSAGE =
  'O arquivo selecionado excede o limite de 1 GB para processamento 100% local e seguro na memória do dispositivo.'
export const MAX_FILE_PACKAGE_OVERHEAD_BYTES = 2 * 1024 * 1024

type ProgressCallback = (value: number, label: string) => void

export type FileSizeGuardOptions = {
  maxFileSizeBytes?: number | null
}

export const FILE_SECURITY_PROFILES = [
  {
    id: 'seguranca_basica',
    memoryMb: 64,
    label: 'Nível de Segurança Básica',
    description:
      'Ideal para celulares básicos. Processamento muito rápido. Oferece excelente proteção para o dia a dia, mas possui menor resistência contra ataques físicos de força bruta focados em hardware.',
  },
  {
    id: 'seguranca_media',
    memoryMb: 256,
    label: 'Nível de Segurança Média (Recomendado)',
    description:
      'O ponto de equilíbrio. Roda na maioria dos smartphones modernos e computadores e aumenta bastante o custo de tentativas paralelas.',
  },
  {
    id: 'seguranca_alta',
    memoryMb: 512,
    label: 'Nível de Segurança Alta',
    description:
      'Exige muita memória e é recomendado para computadores. Pode falhar ou causar lentidão em celulares.',
  },
] as const

export type FileSecurityProfileId = (typeof FILE_SECURITY_PROFILES)[number]['id']

export const DEFAULT_FILE_SECURITY_PROFILE_ID: FileSecurityProfileId =
  'seguranca_media'

export type FileEncryptionOptions = FileSizeGuardOptions & {
  argon2MemoryMb?: number
  argon2Iterations?: number
  keyFile?: File | null
  recoverable?: boolean
  signal?: AbortSignal
}

export type Argon2Parameters = {
  memoryMb: number
  iterations: number
}

export type Argon2TextEncryptionResult = TextEncryptionResult &
  Argon2Parameters & {
    parallelism: 1
  }

export type Argon2TextDecryptionInput = TextDecryptionInput &
  Argon2Parameters & {
    parallelism: 1
  }

export type ProcessResult = {
  blob: Blob
  downloadName: string
  manifestMimeType?: string
  securityReport: FileSecurityReport
  dispose?: () => void | Promise<void>
}

export type FilePackageFormat =
  | 'CRIPTOVEU6'
  | 'CRIPTOVEU5'
  | 'CRIPTOVEU4'
  | 'CRIPTOVEU3'
  | 'CRIPTOVEU2'
  | 'CRIPTIFY2'
  | 'CRIPTIFY1'
  | 'UNKNOWN'

export type FilePackageInspection = {
  status: 'plausible' | 'legacy' | 'invalid'
  format: FilePackageFormat
  packageSize: number
  message: string
  memoryMb: number | null
  iterations: number | null
  chunkSize: number | null
  declaredChunkCount: number | null
  observedChunkCount: number | null
  manifestPresent: boolean | null
  keyFileRequired: boolean | null
}

export type FileSecurityReport = {
  operation: 'encrypt' | 'decrypt'
  format: Exclude<FilePackageFormat, 'UNKNOWN'>
  encryption: 'AES-256-GCM' | 'AES-GCM'
  kdf: 'Argon2id' | 'PBKDF2/SHA-256'
  memoryMb: number | null
  iterations: number
  parallelism: number | null
  chunkSize: number | null
  chunkCount: number | null
  integrity: {
    aesGcmAuthenticated: boolean
    manifestVerified: boolean
    sha256Verified: boolean
    status: 'prepared' | 'verified' | 'aead-only'
  }
  fileHashSha256: string | null
  manifestId: string | null
  createdAt: number
  originalName: string
  originalSize: number
  keyFileProtection: {
    required: boolean
    digest: 'SHA-256' | null
    embedded: false
  }
  recoverableParity: {
    enabled: boolean
    groupSize: number | null
    recoveredBlocks: number
  }
  uploadToServer: false
  note: string
}

type OpfsWorkerResponse =
  | {
      id: number
      type: 'PROGRESS'
      value: number
      label: string
      chunkIndex?: number
      totalChunks?: number
      bytesWritten?: number
      expectedSize?: number
    }
  | {
      id: number
      type: 'SUCCESS'
      expectedSize: number
      downloadName: string
      mimeType: string
      securityReport: FileSecurityReport
      tempFileName: string
    }
  | {
      id: number
      type: 'CLEANUP_DONE'
    }
  | {
      id: number
      type: 'ERROR'
      code: CriptoveuError['code'] | 'OPFS_UNSUPPORTED'
      message: string
    }

export type TextEncryptionResult = {
  ciphertext: string
  iv: Uint8Array<ArrayBuffer>
  salt: Uint8Array<ArrayBuffer>
}

export type TextDecryptionInput = {
  ciphertext: string
  iv: Uint8Array<ArrayBuffer>
  salt: Uint8Array<ArrayBuffer>
}

export class CriptoveuError extends Error {
  code:
    | 'FILE_TOO_LARGE'
    | 'INVALID_FILE'
    | 'INVALID_PASSWORD_OR_FILE'
    | 'KEY_DERIVATION_FAILED'
    | 'INTEGRITY_FAILED'
    | 'KEY_FILE_REQUIRED'
    | 'INVALID_KEY_FILE'

  constructor(
    code:
      | 'FILE_TOO_LARGE'
      | 'INVALID_FILE'
      | 'INVALID_PASSWORD_OR_FILE'
      | 'KEY_DERIVATION_FAILED'
      | 'INTEGRITY_FAILED'
      | 'KEY_FILE_REQUIRED'
      | 'INVALID_KEY_FILE',
    message: string,
  ) {
    super(message)
    this.name = 'CriptoveuError'
    this.code = code
  }
}

class OpfsUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpfsUnavailableError'
  }
}

export function supportsOpfsCrypto() {
  if (typeof Worker === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  return Boolean(navigator.storage)
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function cloneBytes(source: Uint8Array): Uint8Array<ArrayBuffer> {
  const cloned = new Uint8Array(new ArrayBuffer(source.length))
  cloned.set(source)
  return cloned
}

function createXorParity(chunks: readonly Uint8Array[]) {
  const length = Math.max(...chunks.map((chunk) => chunk.byteLength))
  const parity = new Uint8Array(length)

  for (const chunk of chunks) {
    for (let index = 0; index < chunk.byteLength; index += 1) {
      parity[index] ^= chunk[index]
    }
  }

  return parity
}

function recoverXorParityChunk(
  parity: Uint8Array,
  chunks: readonly Uint8Array[],
  recoveredLength: number,
) {
  const recovered = parity.slice(0, recoveredLength)

  for (const chunk of chunks) {
    for (let index = 0; index < chunk.byteLength; index += 1) {
      recovered[index] ^= chunk[index]
    }
  }

  return recovered
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length))
}

function buildChunkAdditionalData(
  chunkIndex: number,
  headerText = PBKDF2_CHUNKED_FILE_HEADER_TEXT,
) {
  return new TextEncoder().encode(`${headerText}:${chunkIndex}`)
}

function buildArgon2ChunkAdditionalData(
  fixedHeader: Uint8Array,
  chunkIndex: number,
  ciphertextLength: number,
  isFinalChunk: boolean,
) {
  const additionalData = new Uint8Array(
    fixedHeader.length + CHUNK_RECORD_LENGTH_BYTES * 2 + 1,
  )
  additionalData.set(fixedHeader)
  const view = new DataView(additionalData.buffer)
  view.setUint32(fixedHeader.length, chunkIndex, false)
  view.setUint32(
    fixedHeader.length + CHUNK_RECORD_LENGTH_BYTES,
    ciphertextLength,
    false,
  )
  additionalData[additionalData.length - 1] = isFinalChunk ? 1 : 0
  return additionalData
}

function readLengthPrefix(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, CHUNK_RECORD_LENGTH_BYTES)
    .getUint32(0, false)
}

function assertChunkCiphertextLength(
  ciphertextLength: number,
  maximumLength: number | null = STREAMING_CHUNK_SIZE_BYTES + AES_GCM_TAG_LENGTH_BYTES,
) {
  if (
    ciphertextLength < AES_GCM_TAG_LENGTH_BYTES ||
    (maximumLength !== null && ciphertextLength > maximumLength)
  ) {
    throw new CriptoveuError('INVALID_FILE', 'Arquivo inválido ou incompleto.')
  }
}

function createAsciiParameter(value: number) {
  const encoded = new TextEncoder().encode(
    value.toString().padStart(ARGON2_PARAMETER_LENGTH_BYTES, '0'),
  )

  if (encoded.length !== ARGON2_PARAMETER_LENGTH_BYTES) {
    throw new CriptoveuError(
      'INVALID_FILE',
      'Parâmetros Argon2id fora do intervalo suportado.',
    )
  }

  return encoded
}

function readAsciiParameter(bytes: Uint8Array) {
  const text = new TextDecoder().decode(bytes)

  if (!/^\d{4}$/.test(text)) {
    throw new CriptoveuError('INVALID_FILE', 'Cabeçalho Argon2id inválido.')
  }

  return Number(text)
}

export function validateArgon2Parameters(parameters: Argon2Parameters) {
  if (
    !Number.isInteger(parameters.memoryMb) ||
    parameters.memoryMb < ARGON2_MIN_MEMORY_MB ||
    parameters.memoryMb > ARGON2_MAX_MEMORY_MB ||
    !Number.isInteger(parameters.iterations) ||
    parameters.iterations < ARGON2_MIN_ITERATIONS ||
    parameters.iterations > ARGON2_MAX_ITERATIONS
  ) {
    throw new CriptoveuError(
      'INVALID_FILE',
      'Parâmetros Argon2id fora do intervalo suportado.',
    )
  }

  return parameters
}

function readArgon2Header(header: Uint8Array) {
  const parametersStart = ARGON2_CHUNKED_FILE_HEADER_BYTES.length
  const iterationsStart = parametersStart + ARGON2_PARAMETER_LENGTH_BYTES
  const saltStart = iterationsStart + ARGON2_PARAMETER_LENGTH_BYTES
  const ivStart = saltStart + SALT_LENGTH_BYTES

  const parameters = validateArgon2Parameters({
    memoryMb: readAsciiParameter(
      header.slice(parametersStart, iterationsStart),
    ),
    iterations: readAsciiParameter(header.slice(iterationsStart, saltStart)),
  })

  return {
    parameters,
    salt: header.slice(saltStart, ivStart),
    firstIv: header.slice(ivStart, ivStart + IV_LENGTH_BYTES),
  }
}

function deriveChunkIv(firstIv: Uint8Array, chunkIndex: number) {
  if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 0xffffffff) {
    throw new CriptoveuError('INVALID_FILE', 'Número de blocos inválido.')
  }

  const iv = cloneBytes(firstIv)
  const view = new DataView(iv.buffer)
  const counterOffset = IV_LENGTH_BYTES - CHUNK_RECORD_LENGTH_BYTES
  const initialCounter = view.getUint32(counterOffset, false)
  view.setUint32(counterOffset, initialCounter ^ chunkIndex, false)
  return iv
}

function concatBytes(
  first: Uint8Array,
  second: Uint8Array,
): Uint8Array<ArrayBuffer> {
  if (first.length === 0) {
    return cloneBytes(second)
  }

  if (second.length === 0) {
    return cloneBytes(first)
  }

  const combined = new Uint8Array(first.length + second.length)
  combined.set(first, 0)
  combined.set(second, first.length)
  return combined
}

function createFixedSizeChunkStream(chunkSize: number) {
  let pendingBytes = new Uint8Array(0)

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const combinedBytes = concatBytes(pendingBytes, chunk)
      let offset = 0

      while (combinedBytes.length - offset >= chunkSize) {
        controller.enqueue(combinedBytes.slice(offset, offset + chunkSize))
        offset += chunkSize
      }

      pendingBytes = combinedBytes.slice(offset)
    },
    flush(controller) {
      if (pendingBytes.length > 0) {
        controller.enqueue(pendingBytes)
      }
    },
  })
}

export function encodeBytesToBase64(bytes: Uint8Array) {
  let binary = ''

  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE_BYTES) {
    const chunk = bytes.subarray(index, index + BASE64_CHUNK_SIZE_BYTES)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

export function decodeBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = atob(value)
  const bytes = new Uint8Array(new ArrayBuffer(normalized.length))

  for (let index = 0; index < normalized.length; index += 1) {
    bytes[index] = normalized.charCodeAt(index)
  }

  return bytes
}

async function reportProgress(
  onProgress: ProgressCallback | undefined,
  value: number,
  label: string,
) {
  onProgress?.(value, label)
  await waitForPaint()
}

type Argon2WorkerResponse =
  | {
      id: number
      keyBytes: ArrayBuffer
    }
  | {
      id: number
      error: string
    }

let argon2RequestId = 0
let trustedArgon2WorkerUrl: string | null = null
let opfsRequestId = 0
let trustedOpfsWorkerUrl: string | null = null

type TrustedTypesFactory = {
  createPolicy: (
    policyName: string,
    rules: { createScriptURL: (url: string) => string },
  ) => {
    createScriptURL: (url: string) => string
  }
}

function createArgon2Worker() {
  const trustedTypes = (
    globalThis as typeof globalThis & { trustedTypes?: TrustedTypesFactory }
  ).trustedTypes

  if (trustedTypes && trustedArgon2WorkerUrl === null) {
    const policy = trustedTypes.createPolicy('criptoveu-argon2-worker', {
      createScriptURL: (url) => url,
    })
    trustedArgon2WorkerUrl = policy.createScriptURL(argon2WorkerUrl)
  }

  return new Worker(trustedArgon2WorkerUrl ?? argon2WorkerUrl, {
    type: 'module',
  })
}

function createOpfsCryptoWorker() {
  const trustedTypes = (
    globalThis as typeof globalThis & { trustedTypes?: TrustedTypesFactory }
  ).trustedTypes

  if (trustedTypes && trustedOpfsWorkerUrl === null) {
    const policy = trustedTypes.createPolicy('criptoveu-opfs-crypto-worker', {
      createScriptURL: (url) => url,
    })
    trustedOpfsWorkerUrl = policy.createScriptURL(opfsCryptoWorkerUrl)
  }

  return new Worker(trustedOpfsWorkerUrl ?? opfsCryptoWorkerUrl, {
    type: 'module',
  })
}

async function processFileWithOpfs(
  mode: 'encrypt' | 'decrypt',
  file: File,
  password: string,
  onProgress?: ProgressCallback,
  options?: FileEncryptionOptions,
): Promise<ProcessResult> {
  const requestId = (opfsRequestId += 1)

  return new Promise<ProcessResult>((resolve, reject) => {
    const worker = createOpfsCryptoWorker()
    let settled = false
    let latestProgress = {
      value: 0,
      label: 'Preparando processamento OPFS',
      chunkIndex: null as number | null,
    }
    let cleanupPromise: Promise<void> | null = null
    let resolveCleanup: (() => void) | null = null

    worker.onmessage = (event: MessageEvent<OpfsWorkerResponse>) => {
      if (event.data.id !== requestId) {
        return
      }

      if (event.data.type === 'PROGRESS') {
        latestProgress = {
          value: event.data.value,
          label: event.data.label,
          chunkIndex: event.data.chunkIndex ?? null,
        }
        onProgress?.(event.data.value, event.data.label)
        return
      }

      if (event.data.type === 'CLEANUP_DONE') {
        resolveCleanup?.()
        resolveCleanup = null
        worker.terminate()
        return
      }

      if (event.data.type === 'ERROR') {
        settled = true
        if (import.meta.env.DEV) {
          console.error('[CriptoVéu][opfs]', {
            stage: 'worker-error',
            file: file.name,
            size: file.size,
            progress: latestProgress.value,
            chunkIndex: latestProgress.chunkIndex,
            error: event.data.message,
          })
        }
        worker.terminate()
        if (event.data.code === 'OPFS_UNSUPPORTED') {
          reject(new OpfsUnavailableError(event.data.message))
          return
        }

        reject(new CriptoveuError(event.data.code, event.data.message))
        return
      }

      if (event.data.type !== 'SUCCESS') {
        return
      }

      const expectedSize = event.data.expectedSize
      const downloadName = event.data.downloadName
      const resolvedMimeType = resolvePreviewMimeType(downloadName, event.data.mimeType)
      const manifestMimeType = event.data.mimeType
      const securityReport = event.data.securityReport
      const tempFileName = event.data.tempFileName

      let cleanupRequested = false
      const dispose = () => {
        if (cleanupRequested) {
          return cleanupPromise ?? Promise.resolve()
        }

        cleanupRequested = true
        cleanupPromise = new Promise<void>((resolve) => {
          resolveCleanup = resolve
          worker.postMessage({
            id: requestId,
            type: 'CLEANUP',
            tempFileName,
          })
        })

        return cleanupPromise
      }

      void (async () => {
        const root = await getOpfsRoot()
        const handle = await (root as { getFileHandle: (name: string) => Promise<{ getFile: () => Promise<File> }> }).getFileHandle(tempFileName)
        const resultFile = await handle.getFile()
        if (resultFile.size !== expectedSize) {
          throw new CriptoveuError('INTEGRITY_FAILED', `Gravação OPFS incompleta: tamanho esperado ${expectedSize} bytes, mas foram recebidos ${resultFile.size} bytes.`)
        }
        if (settled) return
        settled = true
        resolve({
          blob: new File([resultFile], downloadName, { type: resolvedMimeType }),
          downloadName,
          manifestMimeType,
          securityReport,
          dispose,
        })
      })().catch((error) => {
        if (import.meta.env.DEV) {
          console.error('[CriptoVéu][opfs]', {
            stage: 'read-result',
            file: file.name,
            size: file.size,
            progress: latestProgress.value,
            chunkIndex: latestProgress.chunkIndex,
            error,
          })
        }
        worker.postMessage({ id: requestId, type: 'CLEANUP', tempFileName })
        if (!settled) { settled = true; reject(error) }
      })
    }

    const signal = options?.signal
    const cancel = () => {
      if (settled) return
      worker.postMessage({ id: requestId, type: 'CANCEL' })
      settled = true
      reject(new DOMException('Processamento cancelado pelo usuário.', 'AbortError'))
    }
    signal?.addEventListener('abort', cancel, { once: true })

    worker.onerror = () => {
      settled = true
      worker.terminate()
      reject(
        new CriptoveuError(
          'INVALID_FILE',
          'Falha ao carregar o Worker de criptografia OPFS.',
        ),
      )
    }

    worker.postMessage({
      id: requestId,
      mode,
      file,
      password,
      options: {
        argon2MemoryMb: options?.argon2MemoryMb,
        argon2Iterations: options?.argon2Iterations,
        keyFile: options?.keyFile ?? null,
        recoverable: options?.recoverable,
      },
    })
  })
}

export async function deriveArgon2AesKey(
  password: string,
  salt: Uint8Array,
  parameters: Argon2Parameters,
  usage: KeyUsage | readonly KeyUsage[],
) {
  validateArgon2Parameters(parameters)
  const requestId = (argon2RequestId += 1)
  const keyBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const worker = createArgon2Worker()

    worker.onmessage = (event: MessageEvent<Argon2WorkerResponse>) => {
      if (event.data.id !== requestId) {
        return
      }

      worker.terminate()

      if ('error' in event.data) {
        reject(new Error(event.data.error))
        return
      }

      resolve(event.data.keyBytes)
    }

    worker.onerror = () => {
      worker.terminate()
      reject(new Error('Falha ao carregar o motor Argon2id.'))
    }

    worker.postMessage({
      id: requestId,
      password,
      salt: cloneBytes(salt).buffer,
      memorySizeKiB: parameters.memoryMb * 1024,
      iterations: parameters.iterations,
    })
  }).catch(() => {
    throw new CriptoveuError(
      'KEY_DERIVATION_FAILED',
      'Este dispositivo não conseguiu executar o nível Argon2id exigido pelo arquivo.',
    )
  })

  try {
    const usages = Array.isArray(usage) ? [...usage] : [usage]
    return await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, usages)
  } finally {
    new Uint8Array(keyBytes).fill(0)
  }
}

async function derivePbkdf2AesKey(
  password: string,
  salt: Uint8Array,
  usage: KeyUsage,
) {
  const passwordBytes = new TextEncoder().encode(password)
  const normalizedSalt = cloneBytes(salt)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: normalizedSalt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    [usage],
  )
}

function buildDownloadName(mode: 'encrypt' | 'decrypt', fileName: string) {
  if (mode === 'encrypt') {
    return `${fileName}.criptoveu`
  }

  if (fileName.endsWith('.criptoveu')) {
    return fileName.slice(0, -'.criptoveu'.length)
  }

  if (fileName.endsWith('.cryptify')) {
    return fileName.slice(0, -'.cryptify'.length)
  }

  return `${fileName}.decrypted`
}

function createAeadOnlySecurityReport(options: {
  format: 'CRIPTOVEU3' | 'CRIPTOVEU2' | 'CRIPTIFY2' | 'CRIPTIFY1'
  kdf: 'Argon2id' | 'PBKDF2/SHA-256'
  memoryMb: number | null
  iterations: number
  parallelism: number | null
  chunkSize: number | null
  chunkCount: number | null
  originalName: string
  originalSize: number
}): FileSecurityReport {
  return {
    operation: 'decrypt',
    format: options.format,
    encryption:
      options.format === 'CRIPTOVEU3' ? 'AES-256-GCM' : 'AES-GCM',
    kdf: options.kdf,
    memoryMb: options.memoryMb,
    iterations: options.iterations,
    parallelism: options.parallelism,
    chunkSize: options.chunkSize,
    chunkCount: options.chunkCount,
    integrity: {
      aesGcmAuthenticated: true,
      manifestVerified: false,
      sha256Verified: false,
      status: 'aead-only',
    },
    fileHashSha256: null,
    manifestId: null,
    createdAt: Date.now(),
    originalName: options.originalName,
    originalSize: options.originalSize,
    keyFileProtection: {
      required: false,
      digest: null,
      embedded: false,
    },
    recoverableParity: {
      enabled: false,
      groupSize: null,
      recoveredBlocks: 0,
    },
    uploadToServer: false,
    note:
      'Formato legado autenticado por AES-GCM, sem manifesto SHA-256 do Escudo de Integridade.',
  }
}

function inferMimeTypeFromName(fileName: string) {
  const extension = fileName.toLowerCase().split('.').pop()

  if (!extension) {
    return ''
  }

  const mimeByExtension: Record<string, string> = {
    aac: 'audio/aac',
    avi: 'video/x-msvideo',
    flac: 'audio/flac',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    json: 'application/json',
    m4a: 'audio/mp4',
    markdown: 'text/markdown',
    md: 'text/markdown',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    oga: 'audio/ogg',
    ogg: 'audio/ogg',
    ogv: 'video/ogg',
    pdf: 'application/pdf',
    png: 'image/png',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    wav: 'audio/wav',
    webm: 'video/webm',
    webp: 'image/webp',
  }

  return mimeByExtension[extension] ?? ''
}

export function assertSupportedFileSize(
  file: File,
  { maxFileSizeBytes = MAX_FILE_SIZE }: FileSizeGuardOptions = {},
) {
  if (maxFileSizeBytes === null) {
    return
  }

  if (file.size > maxFileSizeBytes) {
    throw new CriptoveuError(
      'FILE_TOO_LARGE',
      maxFileSizeBytes === MAX_FILE_SIZE
        ? MAX_FILE_SIZE_EXCEEDED_MESSAGE
        : `Arquivo excede o limite suportado de ${formatFileSize(maxFileSizeBytes)}.`,
    )
  }
}

function isSameFileSelection(first: File, second: File) {
  return (
    first === second ||
    (first.name === second.name &&
      first.size === second.size &&
      first.lastModified === second.lastModified)
  )
}

async function resolveFilePasswordMaterial(
  password: string,
  keyFile: File | null,
  onProgress?: (progress: number) => void,
) {
  if (!keyFile) {
    return password
  }

  try {
    return await derivePasswordKeyFileMaterial(password, keyFile, onProgress)
  } catch (error) {
    if (error instanceof KeyFileProtectionError) {
      throw new CriptoveuError('INVALID_KEY_FILE', error.message)
    }

    throw error
  }
}

export async function encryptFile(
  file: File,
  password: string,
  onProgress?: ProgressCallback,
  options?: FileEncryptionOptions,
): Promise<ProcessResult> {
  const keyFile = options?.keyFile ?? null
  const useRecoverableParity = options?.recoverable === true
  const packageFormat: FileIntegrityFormat = useRecoverableParity
    ? 'CRIPTOVEU6'
    : keyFile
      ? 'CRIPTOVEU5'
      : 'CRIPTOVEU4'

  if (useRecoverableParity && keyFile) {
    throw new CriptoveuError(
      'INVALID_FILE',
      'O modo recuperável com paridade ainda não pode ser combinado com arquivo-chave.',
    )
  }

  if (keyFile && isSameFileSelection(file, keyFile)) {
    throw new CriptoveuError(
      'INVALID_KEY_FILE',
      'O arquivo protegido não pode ser usado como seu próprio arquivo-chave.',
    )
  }

  if (keyFile) {
    try {
      assertValidKeyFile(keyFile)
    } catch (error) {
      if (error instanceof KeyFileProtectionError) {
        throw new CriptoveuError('INVALID_KEY_FILE', error.message)
      }

      throw error
    }
  }

  if (supportsOpfsCrypto()) {
    try {
      return await processFileWithOpfs(
        'encrypt',
        file,
        password,
        onProgress,
        options,
      )
    } catch (error) {
      if (!(error instanceof OpfsUnavailableError)) {
        throw error
      }
    }
  }

  assertSupportedFileSize(file, options)

  await reportProgress(onProgress, 5, 'Preparando Escudo de Integridade')
  const salt = randomBytes(SALT_LENGTH_BYTES)
  const firstIv = randomBytes(IV_LENGTH_BYTES)
  const parameters = validateArgon2Parameters({
    memoryMb: options?.argon2MemoryMb ?? 256,
    iterations: options?.argon2Iterations ?? ARGON2_FILE_ITERATIONS,
  })
  let manifest: FileIntegrityManifest

  try {
    manifest = await createFileIntegrityManifest(
      file,
      STREAMING_CHUNK_SIZE_BYTES,
      {
        memoryMb: parameters.memoryMb,
        iterations: parameters.iterations,
        parallelism: 1,
      },
      (progress) => {
        onProgress?.(
          5 + Math.round(progress * 0.12),
          `Calculando manifesto SHA-256 (${progress}%)`,
        )
      },
      packageFormat,
    )
  } catch (error) {
    if (error instanceof FileIntegrityError) {
      throw new CriptoveuError('INTEGRITY_FAILED', error.message)
    }

    throw error
  }

  const passwordMaterial = await resolveFilePasswordMaterial(
    password,
    keyFile,
    (progress) => {
      onProgress?.(
        17 + Math.round(progress * 0.05),
        `Processando arquivo-chave (${progress}%)`,
      )
    },
  )
  const fixedHeader = buildIntegrityHeader(
    packageFormat,
    parameters,
    salt,
    firstIv,
    manifest.chunkSize,
    manifest.chunkCount,
  )
  await reportProgress(
    onProgress,
    22,
    `Derivando chave Argon2id (${parameters.memoryMb} MB)`,
  )
  const key = await deriveArgon2AesKey(
    passwordMaterial,
    salt,
    parameters,
    'encrypt',
  )
  const encryptedParts: BlobPart[] = [fixedHeader]
  const parityGroup: Uint8Array[] = []
  let processedBytes = 0
  let chunkIndex = 0

  await reportProgress(onProgress, 26, 'Chave AES-GCM preparada')

  async function encryptChunk(plainChunk: Uint8Array) {
    const iv = deriveChunkIv(firstIv, chunkIndex)
    const ciphertextLength = plainChunk.byteLength + AES_GCM_TAG_LENGTH_BYTES
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: buildIntegrityRecordAdditionalData(
          fixedHeader,
          INTEGRITY_DATA_RECORD_TYPE,
          chunkIndex,
          ciphertextLength,
        ),
      },
      key,
      cloneBytes(plainChunk),
    )
    const ciphertext = new Uint8Array(encrypted)

    encryptedParts.push(
      createIntegrityRecordHeader(
        INTEGRITY_DATA_RECORD_TYPE,
        ciphertext.byteLength,
      ),
      ciphertext,
    )
    if (useRecoverableParity) {
      parityGroup.push(ciphertext)

      if (
        parityGroup.length === RECOVERABLE_PARITY_GROUP_SIZE ||
        chunkIndex + 1 === manifest.chunkCount
      ) {
        const parity = createXorParity(parityGroup)
        encryptedParts.push(
          createIntegrityRecordHeader(
            RECOVERABLE_PARITY_RECORD_TYPE,
            parity.byteLength,
          ),
          parity,
        )
        parityGroup.length = 0
      }
    }
    processedBytes += plainChunk.byteLength
    chunkIndex += 1

    const progressBase = file.size === 0 ? 1 : processedBytes / file.size
    await reportProgress(
      onProgress,
      Math.min(88, 26 + Math.round(progressBase * 62)),
      `Protegendo bloco ${chunkIndex}`,
    )
  }

  if (file.size === 0) {
    await encryptChunk(new Uint8Array(0))
  } else {
    await file
      .stream()
      .pipeThrough(createFixedSizeChunkStream(STREAMING_CHUNK_SIZE_BYTES))
      .pipeTo(
        new WritableStream<Uint8Array>({
          write: encryptChunk,
        }),
      )
  }

  if (chunkIndex !== manifest.chunkCount) {
    throw new CriptoveuError(
      'INTEGRITY_FAILED',
      'A quantidade de blocos gerada diverge do manifesto criptográfico.',
    )
  }

  const manifestBytes = serializeFileIntegrityManifest(manifest)
  const manifestCiphertextLength =
    manifestBytes.byteLength + AES_GCM_TAG_LENGTH_BYTES
  const encryptedManifest = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: deriveChunkIv(firstIv, manifest.chunkCount),
      additionalData: buildIntegrityRecordAdditionalData(
        fixedHeader,
        INTEGRITY_MANIFEST_RECORD_TYPE,
        manifest.chunkCount,
        manifestCiphertextLength,
      ),
    },
    key,
    manifestBytes,
  )
  const manifestCiphertext = new Uint8Array(encryptedManifest)
  encryptedParts.push(
    createIntegrityRecordHeader(
      INTEGRITY_MANIFEST_RECORD_TYPE,
      manifestCiphertext.byteLength,
    ),
    manifestCiphertext,
  )

  await reportProgress(
    onProgress,
    94,
    'Verificando a estrutura final do pacote',
  )
  const blob = new Blob(encryptedParts, { type: 'application/octet-stream' })
  encryptedParts.length = 0
  parityGroup.length = 0
  const inspection = await inspectCriptoveuPackage(blob)

  if (inspection.status !== 'plausible' || inspection.format !== packageFormat) {
    throw new CriptoveuError(
      'INTEGRITY_FAILED',
      'A verificação pós-geração encontrou uma estrutura de pacote inválida.',
    )
  }

  await reportProgress(
    onProgress,
    98,
    `Escudo de Integridade preparado para ${chunkIndex} bloco(s)`,
  )

  return {
    blob,
    downloadName: buildDownloadName('encrypt', file.name),
    securityReport: {
      operation: 'encrypt',
      format: packageFormat,
      encryption: 'AES-256-GCM',
      kdf: 'Argon2id',
      memoryMb: parameters.memoryMb,
      iterations: parameters.iterations,
      parallelism: 1,
      chunkSize: manifest.chunkSize,
      chunkCount: manifest.chunkCount,
      integrity: {
        aesGcmAuthenticated: true,
        manifestVerified: true,
        sha256Verified: true,
        status: 'prepared',
      },
      fileHashSha256: manifest.fileHashSha256,
      manifestId: manifest.manifestId,
      createdAt: manifest.createdAt,
      originalName: manifest.originalName,
      originalSize: manifest.originalSize,
      keyFileProtection: {
        required: keyFile !== null,
        digest: keyFile ? 'SHA-256' : null,
        embedded: false,
      },
      recoverableParity: {
        enabled: useRecoverableParity,
        groupSize: useRecoverableParity ? RECOVERABLE_PARITY_GROUP_SIZE : null,
        recoveredBlocks: 0,
      },
      uploadToServer: false,
      note:
        useRecoverableParity
          ? `Pacote recuperável com paridade local gerado. Cada grupo de ${RECOVERABLE_PARITY_GROUP_SIZE} blocos pode recuperar um bloco com conteúdo danificado.`
          : keyFile
          ? 'Pacote com proteção dupla gerado localmente. O arquivo-chave não foi incorporado ao pacote.'
          : 'Pacote gerado localmente e verificado estruturalmente. Reabra o arquivo baixado para confirmar novamente o manifesto.',
    },
  }
}

function assertSupportedPackageSize(
  file: File,
  { maxFileSizeBytes = MAX_FILE_SIZE }: FileSizeGuardOptions = {},
) {
  if (maxFileSizeBytes === null) {
    return
  }

  const maximumPackageSize =
    maxFileSizeBytes + MAX_FILE_PACKAGE_OVERHEAD_BYTES

  if (file.size > maximumPackageSize) {
    throw new CriptoveuError(
      'FILE_TOO_LARGE',
      maxFileSizeBytes === MAX_FILE_SIZE
        ? MAX_FILE_SIZE_EXCEEDED_MESSAGE
        : `Pacote excede o limite suportado de ${formatFileSize(maximumPackageSize)}.`,
    )
  }
}

function assertRecoveredFileSize(
  blob: Blob,
  { maxFileSizeBytes = MAX_FILE_SIZE }: FileSizeGuardOptions = {},
) {
  if (maxFileSizeBytes !== null && blob.size > maxFileSizeBytes) {
    throw new CriptoveuError(
      'FILE_TOO_LARGE',
      maxFileSizeBytes === MAX_FILE_SIZE
        ? MAX_FILE_SIZE_EXCEEDED_MESSAGE
        : `O conteúdo recuperado excede o limite suportado de ${formatFileSize(maxFileSizeBytes)}.`,
    )
  }
}

export async function encryptText(
  plainText: string,
  password: string,
): Promise<TextEncryptionResult> {
  const normalizedText = plainText.trim()

  if (!normalizedText) {
    throw new CriptoveuError(
      'INVALID_FILE',
      'Digite um texto antes de proteger a mensagem.',
    )
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES))
  const key = await derivePbkdf2AesKey(password, salt, 'encrypt')
  const source = new TextEncoder().encode(normalizedText)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, source)

  return {
    ciphertext: encodeBytesToBase64(new Uint8Array(encrypted)),
    iv,
    salt,
  }
}

export async function decryptText(
  encryptedInput: TextDecryptionInput,
  password: string,
): Promise<string> {
  try {
    const key = await derivePbkdf2AesKey(password, encryptedInput.salt, 'decrypt')
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: cloneBytes(encryptedInput.iv) },
      key,
      decodeBase64ToBytes(encryptedInput.ciphertext),
    )

    return new TextDecoder().decode(decrypted)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'OperationError') {
      throw new CriptoveuError(
        'INVALID_PASSWORD_OR_FILE',
        'Senha incorreta ou mensagem inválida. Verifique a senha e tente novamente.',
      )
    }

    throw error
  }
}

function createInvalidInspection(
  packageSize: number,
  message: string,
  format: FilePackageFormat = 'UNKNOWN',
): FilePackageInspection {
  return {
    status: 'invalid',
    format,
    packageSize,
    message,
    memoryMb: null,
    iterations: null,
    chunkSize: null,
    declaredChunkCount: null,
    observedChunkCount: null,
    manifestPresent: null,
    keyFileRequired: null,
  }
}

async function inspectIntegrityPackage(
  blob: Blob,
  format: FileIntegrityFormat,
): Promise<FilePackageInspection> {
  const expectedHeaderBytes =
    format === 'CRIPTOVEU5'
      ? KEY_FILE_CHUNKED_FILE_HEADER_BYTES
      : format === 'CRIPTOVEU6'
        ? RECOVERABLE_CHUNKED_FILE_HEADER_BYTES
        : INTEGRITY_CHUNKED_FILE_HEADER_BYTES
  const fixedHeader = new Uint8Array(
    await blob.slice(0, INTEGRITY_HEADER_LENGTH_BYTES).arrayBuffer(),
  )
  const headerText = new TextDecoder().decode(
    fixedHeader.slice(0, expectedHeaderBytes.length),
  )

  if (headerText !== format) {
    return createInvalidInspection(
      blob.size,
      `A assinatura ${format} não confere.`,
      format,
    )
  }

  const parsedHeader = readIntegrityHeader(fixedHeader)
  let offset = INTEGRITY_HEADER_LENGTH_BYTES
  let observedChunkCount = 0
  let manifestPresent = false
  let parityRecords = 0

  while (offset < blob.size) {
    if (blob.size - offset < INTEGRITY_RECORD_HEADER_BYTES) {
      return createInvalidInspection(
        blob.size,
        'O pacote termina no meio de um cabeçalho de registro.',
        format,
      )
    }

    const recordHeader = readIntegrityRecordHeader(
      new Uint8Array(
        await blob
          .slice(offset, offset + INTEGRITY_RECORD_HEADER_BYTES)
          .arrayBuffer(),
      ),
    )
    const expectingData = observedChunkCount < parsedHeader.chunkCount
    const expectingParity =
      format === 'CRIPTOVEU6' &&
      observedChunkCount > 0 &&
      (observedChunkCount % RECOVERABLE_PARITY_GROUP_SIZE === 0 ||
        observedChunkCount === parsedHeader.chunkCount) &&
      parityRecords < Math.ceil(observedChunkCount / RECOVERABLE_PARITY_GROUP_SIZE)
    const maximumLength =
      recordHeader.recordType === INTEGRITY_MANIFEST_RECORD_TYPE
        ? MAX_FILE_INTEGRITY_MANIFEST_BYTES + AES_GCM_TAG_LENGTH_BYTES
        : parsedHeader.chunkSize + AES_GCM_TAG_LENGTH_BYTES

    assertChunkCiphertextLength(
      recordHeader.ciphertextLength,
      maximumLength,
    )

    const recordEnd =
      offset +
      INTEGRITY_RECORD_HEADER_BYTES +
      recordHeader.ciphertextLength

    if (recordEnd > blob.size) {
      return createInvalidInspection(
        blob.size,
        'O pacote termina antes do fim de um registro declarado.',
        format,
      )
    }

    if (expectingParity) {
      if (recordHeader.recordType !== RECOVERABLE_PARITY_RECORD_TYPE) {
        return createInvalidInspection(
          blob.size,
          'O registro de paridade recuperável está ausente ou fora de posição.',
          format,
        )
      }

      parityRecords += 1
    } else if (expectingData) {
      if (recordHeader.recordType !== INTEGRITY_DATA_RECORD_TYPE) {
        return createInvalidInspection(
          blob.size,
          'A ordem dos registros de dados não é plausível.',
          format,
        )
      }

      observedChunkCount += 1
    } else {
      if (
        recordHeader.recordType !== INTEGRITY_MANIFEST_RECORD_TYPE ||
        manifestPresent ||
        recordEnd !== blob.size
      ) {
        return createInvalidInspection(
          blob.size,
          'O registro final do manifesto está ausente ou fora de posição.',
          format,
        )
      }

      manifestPresent = true
    }

    offset = recordEnd
  }

  if (
    observedChunkCount !== parsedHeader.chunkCount ||
    !manifestPresent ||
    (format === 'CRIPTOVEU6' &&
      parityRecords !==
        Math.ceil(parsedHeader.chunkCount / RECOVERABLE_PARITY_GROUP_SIZE)) ||
    offset !== blob.size
  ) {
    return createInvalidInspection(
      blob.size,
      'A quantidade de blocos ou o manifesto não confere com o cabeçalho.',
      format,
    )
  }

  return {
    status: 'plausible',
    format,
    packageSize: blob.size,
    message:
      format === 'CRIPTOVEU5'
        ? 'Estrutura plausível. A autenticação exige a senha e o arquivo-chave corretos.'
        : format === 'CRIPTOVEU6'
          ? `Estrutura recuperável plausível. Cada grupo de ${RECOVERABLE_PARITY_GROUP_SIZE} blocos possui uma paridade local.`
        : 'Estrutura plausível. A autenticidade e o manifesto exigem a senha correta.',
    memoryMb: parsedHeader.parameters.memoryMb,
    iterations: parsedHeader.parameters.iterations,
    chunkSize: parsedHeader.chunkSize,
    declaredChunkCount: parsedHeader.chunkCount,
    observedChunkCount,
    manifestPresent,
    keyFileRequired: format === 'CRIPTOVEU5',
  }
}

async function inspectArgon2V3Package(
  blob: Blob,
): Promise<FilePackageInspection> {
  const fixedHeader = new Uint8Array(
    await blob.slice(0, ARGON2_HEADER_LENGTH_BYTES).arrayBuffer(),
  )
  const headerText = new TextDecoder().decode(
    fixedHeader.slice(0, ARGON2_CHUNKED_FILE_HEADER_BYTES.length),
  )

  if (headerText !== ARGON2_CHUNKED_FILE_HEADER_TEXT) {
    return createInvalidInspection(
      blob.size,
      'A assinatura CRIPTOVEU3 não confere.',
      'CRIPTOVEU3',
    )
  }

  const parsedHeader = readArgon2Header(fixedHeader)
  let offset = ARGON2_HEADER_LENGTH_BYTES
  let observedChunkCount = 0

  while (offset < blob.size) {
    if (blob.size - offset < CHUNK_RECORD_LENGTH_BYTES) {
      return createInvalidInspection(
        blob.size,
        'O pacote V3 termina no meio de um registro.',
        'CRIPTOVEU3',
      )
    }

    const ciphertextLength = readLengthPrefix(
      new Uint8Array(
        await blob
          .slice(offset, offset + CHUNK_RECORD_LENGTH_BYTES)
          .arrayBuffer(),
      ),
    )
    assertChunkCiphertextLength(ciphertextLength)
    offset += CHUNK_RECORD_LENGTH_BYTES + ciphertextLength

    if (offset > blob.size) {
      return createInvalidInspection(
        blob.size,
        'O pacote V3 termina antes do tamanho de bloco declarado.',
        'CRIPTOVEU3',
      )
    }

    observedChunkCount += 1
  }

  if (observedChunkCount < 1 || offset !== blob.size) {
    return createInvalidInspection(
      blob.size,
      'O pacote V3 não contém blocos completos.',
      'CRIPTOVEU3',
    )
  }

  return {
    status: 'plausible',
    format: 'CRIPTOVEU3',
    packageSize: blob.size,
    message:
      'Estrutura V3 plausível. A autenticação AES-GCM exige a senha correta.',
    memoryMb: parsedHeader.parameters.memoryMb,
    iterations: parsedHeader.parameters.iterations,
    chunkSize: STREAMING_CHUNK_SIZE_BYTES,
    declaredChunkCount: null,
    observedChunkCount,
    manifestPresent: false,
    keyFileRequired: false,
  }
}

export async function inspectCriptoveuPackage(
  blob: Blob,
): Promise<FilePackageInspection> {
  let detectedFormat: FilePackageFormat = 'UNKNOWN'

  try {
    const header = await blob
      .slice(0, INTEGRITY_CHUNKED_FILE_HEADER_BYTES.length)
      .text()

    if (header === KEY_FILE_CHUNKED_FILE_HEADER_TEXT) {
      detectedFormat = 'CRIPTOVEU5'

      if (blob.size < INTEGRITY_HEADER_LENGTH_BYTES) {
        return createInvalidInspection(
          blob.size,
          'O cabeçalho CRIPTOVEU5 está truncado.',
          'CRIPTOVEU5',
        )
      }

      return await inspectIntegrityPackage(blob, 'CRIPTOVEU5')
    }

    if (header === RECOVERABLE_CHUNKED_FILE_HEADER_TEXT) {
      detectedFormat = 'CRIPTOVEU6'

      if (blob.size < INTEGRITY_HEADER_LENGTH_BYTES) {
        return createInvalidInspection(
          blob.size,
          'O cabeçalho CRIPTOVEU6 está truncado.',
          'CRIPTOVEU6',
        )
      }

      return await inspectIntegrityPackage(blob, 'CRIPTOVEU6')
    }

    if (header === INTEGRITY_CHUNKED_FILE_HEADER_TEXT) {
      detectedFormat = 'CRIPTOVEU4'

      if (blob.size < INTEGRITY_HEADER_LENGTH_BYTES) {
        return createInvalidInspection(
          blob.size,
          'O cabeçalho CRIPTOVEU4 está truncado.',
          'CRIPTOVEU4',
        )
      }

      return await inspectIntegrityPackage(blob, 'CRIPTOVEU4')
    }

    if (header === ARGON2_CHUNKED_FILE_HEADER_TEXT) {
      detectedFormat = 'CRIPTOVEU3'

      if (blob.size < ARGON2_HEADER_LENGTH_BYTES) {
        return createInvalidInspection(
          blob.size,
          'O cabeçalho CRIPTOVEU3 está truncado.',
          'CRIPTOVEU3',
        )
      }

      return await inspectArgon2V3Package(blob)
    }

    if (header === PBKDF2_CHUNKED_FILE_HEADER_TEXT) {
      detectedFormat = 'CRIPTOVEU2'

      return {
        status: 'legacy',
        format: 'CRIPTOVEU2',
        packageSize: blob.size,
        message:
          'Pacote legado reconhecido. A integridade só pode ser confirmada durante a abertura.',
        memoryMb: null,
        iterations: PBKDF2_ITERATIONS,
        chunkSize: STREAMING_CHUNK_SIZE_BYTES,
        declaredChunkCount: null,
        observedChunkCount: null,
        manifestPresent: false,
        keyFileRequired: false,
      }
    }

    const legacyHeader = await blob
      .slice(0, LEGACY_CHUNKED_FILE_HEADER_BYTES.length)
      .text()

    if (legacyHeader === LEGACY_CHUNKED_FILE_HEADER_TEXT) {
      detectedFormat = 'CRIPTIFY2'

      return {
        status: 'legacy',
        format: 'CRIPTIFY2',
        packageSize: blob.size,
        message:
          'Pacote CRIPTIFY2 reconhecido. Não existe manifesto criptográfico.',
        memoryMb: null,
        iterations: PBKDF2_ITERATIONS,
        chunkSize: STREAMING_CHUNK_SIZE_BYTES,
        declaredChunkCount: null,
        observedChunkCount: null,
        manifestPresent: false,
        keyFileRequired: false,
      }
    }

    const oldestHeader = await blob.slice(0, LEGACY_FILE_HEADER_BYTES.length).text()

    if (oldestHeader === LEGACY_FILE_HEADER_TEXT) {
      detectedFormat = 'CRIPTIFY1'

      return {
        status: 'legacy',
        format: 'CRIPTIFY1',
        packageSize: blob.size,
        message:
          'Pacote CRIPTIFY1 reconhecido. Não existe manifesto criptográfico.',
        memoryMb: null,
        iterations: PBKDF2_ITERATIONS,
        chunkSize: null,
        declaredChunkCount: null,
        observedChunkCount: null,
        manifestPresent: false,
        keyFileRequired: false,
      }
    }

    return createInvalidInspection(
      blob.size,
      'O arquivo não possui uma assinatura reconhecida do CriptoVéu.',
    )
  } catch (error) {
    return createInvalidInspection(
      blob.size,
      error instanceof Error
        ? error.message
        : 'Não foi possível inspecionar a estrutura do pacote.',
      detectedFormat,
    )
  }
}

function buildIntegrityHeader(
  format: FileIntegrityFormat,
  parameters: Argon2Parameters,
  salt: Uint8Array,
  firstIv: Uint8Array,
  chunkSize: number,
  chunkCount: number,
) {
  validateArgon2Parameters(parameters)

  if (
    chunkSize !== STREAMING_CHUNK_SIZE_BYTES ||
    !Number.isSafeInteger(chunkCount) ||
    chunkCount < 1 ||
    chunkCount > 0xfffffffe
  ) {
    throw new CriptoveuError(
      'INVALID_FILE',
      `Parâmetros estruturais do pacote ${format} são inválidos.`,
    )
  }

  const header = new Uint8Array(INTEGRITY_HEADER_LENGTH_BYTES)
  const formatBytes =
    format === 'CRIPTOVEU5'
      ? KEY_FILE_CHUNKED_FILE_HEADER_BYTES
      : format === 'CRIPTOVEU6'
        ? RECOVERABLE_CHUNKED_FILE_HEADER_BYTES
        : INTEGRITY_CHUNKED_FILE_HEADER_BYTES
  let offset = 0

  header.set(formatBytes, offset)
  offset += formatBytes.length
  header.set(createAsciiParameter(parameters.memoryMb), offset)
  offset += ARGON2_PARAMETER_LENGTH_BYTES
  header.set(createAsciiParameter(parameters.iterations), offset)
  offset += ARGON2_PARAMETER_LENGTH_BYTES
  header.set(salt, offset)
  offset += SALT_LENGTH_BYTES
  header.set(firstIv, offset)
  offset += IV_LENGTH_BYTES

  const view = new DataView(header.buffer)
  view.setUint32(offset, chunkSize, false)
  view.setUint32(offset + CHUNK_RECORD_LENGTH_BYTES, chunkCount, false)
  return header
}

function readIntegrityHeader(header: Uint8Array) {
  if (header.byteLength !== INTEGRITY_HEADER_LENGTH_BYTES) {
    throw new CriptoveuError(
      'INVALID_FILE',
      'Cabeçalho de integridade incompleto.',
    )
  }

  const parametersStart = INTEGRITY_CHUNKED_FILE_HEADER_BYTES.length
  const iterationsStart = parametersStart + ARGON2_PARAMETER_LENGTH_BYTES
  const saltStart = iterationsStart + ARGON2_PARAMETER_LENGTH_BYTES
  const ivStart = saltStart + SALT_LENGTH_BYTES
  const chunkSizeStart = ivStart + IV_LENGTH_BYTES
  const view = new DataView(
    header.buffer,
    header.byteOffset,
    header.byteLength,
  )
  const parameters = validateArgon2Parameters({
    memoryMb: readAsciiParameter(
      header.slice(parametersStart, iterationsStart),
    ),
    iterations: readAsciiParameter(header.slice(iterationsStart, saltStart)),
  })
  const chunkSize = view.getUint32(chunkSizeStart, false)
  const chunkCount = view.getUint32(
    chunkSizeStart + CHUNK_RECORD_LENGTH_BYTES,
    false,
  )

  if (
    chunkSize !== STREAMING_CHUNK_SIZE_BYTES ||
    chunkCount < 1 ||
    chunkCount > 0xfffffffe
  ) {
    throw new CriptoveuError(
      'INVALID_FILE',
      'Cabeçalho usa tamanho ou quantidade de blocos inválidos.',
    )
  }

  return {
    parameters,
    salt: header.slice(saltStart, ivStart),
    firstIv: header.slice(ivStart, chunkSizeStart),
    chunkSize,
    chunkCount,
  }
}

function createIntegrityRecordHeader(recordType: number, ciphertextLength: number) {
  const header = new Uint8Array(INTEGRITY_RECORD_HEADER_BYTES)
  header[0] = recordType
  new DataView(header.buffer).setUint32(
    INTEGRITY_RECORD_TYPE_BYTES,
    ciphertextLength,
    false,
  )
  return header
}

function readIntegrityRecordHeader(bytes: Uint8Array) {
  if (bytes.byteLength !== INTEGRITY_RECORD_HEADER_BYTES) {
    throw new CriptoveuError(
      'INVALID_FILE',
      'Registro CRIPTOVEU4 incompleto.',
    )
  }

  return {
    recordType: bytes[0],
    ciphertextLength: new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).getUint32(INTEGRITY_RECORD_TYPE_BYTES, false),
  }
}

function buildIntegrityRecordAdditionalData(
  fixedHeader: Uint8Array,
  recordType: number,
  recordIndex: number,
  ciphertextLength: number,
) {
  const additionalData = new Uint8Array(
    fixedHeader.length +
      INTEGRITY_RECORD_TYPE_BYTES +
      CHUNK_RECORD_LENGTH_BYTES * 2,
  )
  additionalData.set(fixedHeader)
  const offset = fixedHeader.length
  additionalData[offset] = recordType
  const view = new DataView(additionalData.buffer)
  view.setUint32(offset + INTEGRITY_RECORD_TYPE_BYTES, recordIndex, false)
  view.setUint32(
    offset + INTEGRITY_RECORD_TYPE_BYTES + CHUNK_RECORD_LENGTH_BYTES,
    ciphertextLength,
    false,
  )
  return additionalData
}

export async function encryptTextArgon2(
  plainText: string,
  password: string,
  additionalData: Uint8Array,
  parameters: Argon2Parameters,
): Promise<Argon2TextEncryptionResult> {
  const normalizedText = plainText.trim()

  if (!normalizedText) {
    throw new CriptoveuError(
      'INVALID_FILE',
      'Digite um texto antes de proteger a mensagem.',
    )
  }

  const safeParameters = validateArgon2Parameters(parameters)
  const salt = randomBytes(SALT_LENGTH_BYTES)
  const iv = randomBytes(IV_LENGTH_BYTES)
  const key = await deriveArgon2AesKey(
    password,
    salt,
    safeParameters,
    'encrypt',
  )
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: cloneBytes(additionalData),
    },
    key,
    new TextEncoder().encode(normalizedText),
  )

  return {
    ciphertext: encodeBytesToBase64(new Uint8Array(encrypted)),
    iv,
    salt,
    memoryMb: safeParameters.memoryMb,
    iterations: safeParameters.iterations,
    parallelism: 1,
  }
}

export async function decryptTextArgon2(
  encryptedInput: Argon2TextDecryptionInput,
  password: string,
  additionalData: Uint8Array,
): Promise<string> {
  if (
    encryptedInput.parallelism !== 1 ||
    encryptedInput.salt.byteLength !== SALT_LENGTH_BYTES ||
    encryptedInput.iv.byteLength !== IV_LENGTH_BYTES
  ) {
    throw new CriptoveuError(
      'INVALID_FILE',
      'Os parâmetros da mensagem Argon2id são inválidos.',
    )
  }

  try {
    const key = await deriveArgon2AesKey(
      password,
      encryptedInput.salt,
      {
        memoryMb: encryptedInput.memoryMb,
        iterations: encryptedInput.iterations,
      },
      'decrypt',
    )
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: cloneBytes(encryptedInput.iv),
        additionalData: cloneBytes(additionalData),
      },
      key,
      decodeBase64ToBytes(encryptedInput.ciphertext),
    )

    return new TextDecoder().decode(decrypted)
  } catch (error) {
    if (
      error instanceof CriptoveuError &&
      error.code === 'KEY_DERIVATION_FAILED'
    ) {
      throw error
    }

    throw new CriptoveuError(
      'INVALID_PASSWORD_OR_FILE',
      'Senha incorreta ou mensagem V2 inválida. Verifique a senha e tente novamente.',
    )
  }
}

async function decryptLegacyFile(
  file: File,
  password: string,
  onProgress?: ProgressCallback,
): Promise<ProcessResult> {
  await reportProgress(onProgress, 10, 'Lendo arquivo')
  const source = new Uint8Array(await file.arrayBuffer())

  if (
    source.byteLength <=
    LEGACY_FILE_HEADER_BYTES.length + SALT_LENGTH_BYTES + IV_LENGTH_BYTES
  ) {
    throw new CriptoveuError('INVALID_FILE', 'Arquivo inválido ou incompleto.')
  }

  const incomingHeader = new TextDecoder().decode(
    source.slice(0, LEGACY_FILE_HEADER_BYTES.length),
  )

  if (incomingHeader !== LEGACY_FILE_HEADER_TEXT) {
    throw new CriptoveuError(
      'INVALID_FILE',
      'Arquivo inválido. Não foi possível reconhecer este pacote protegido.',
    )
  }

  const salt = source.slice(
    LEGACY_FILE_HEADER_BYTES.length,
    LEGACY_FILE_HEADER_BYTES.length + SALT_LENGTH_BYTES,
  )
  const iv = source.slice(
    LEGACY_FILE_HEADER_BYTES.length + SALT_LENGTH_BYTES,
    LEGACY_FILE_HEADER_BYTES.length + SALT_LENGTH_BYTES + IV_LENGTH_BYTES,
  )
  const encrypted = source.slice(
    LEGACY_FILE_HEADER_BYTES.length + SALT_LENGTH_BYTES + IV_LENGTH_BYTES,
  )

  await reportProgress(onProgress, 36, 'Preparando recuperação')
  const key = await derivePbkdf2AesKey(password, new Uint8Array(salt), 'decrypt')

  await reportProgress(onProgress, 76, 'Abrindo conteúdo protegido')

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      encrypted,
    )

    const downloadName = buildDownloadName('decrypt', file.name)
    const blob = new Blob([decrypted], {
      type: inferMimeTypeFromName(downloadName),
    })

    return {
      blob,
      downloadName,
      securityReport: createAeadOnlySecurityReport({
        format: 'CRIPTIFY1',
        kdf: 'PBKDF2/SHA-256',
        memoryMb: null,
        iterations: PBKDF2_ITERATIONS,
        parallelism: null,
        chunkSize: null,
        chunkCount: 1,
        originalName: downloadName,
        originalSize: blob.size,
      }),
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'OperationError') {
      throw new CriptoveuError(
        'INVALID_PASSWORD_OR_FILE',
        'Senha incorreta ou arquivo inválido. Verifique a chave e tente novamente.',
      )
    }

    throw error
  }
}

async function decryptPbkdf2ChunkedFile(
  file: File,
  password: string,
  headerText: string,
  headerBytes: Uint8Array,
  onProgress?: ProgressCallback,
): Promise<ProcessResult> {
  await reportProgress(onProgress, 8, 'Lendo cabeçalho protegido')
  const reader = file.stream().getReader()
  let pendingBytes = new Uint8Array(0)
  let key: CryptoKey | null = null
  let chunkIndex = 0
  let consumedBytes = 0
  const decryptedParts: BlobPart[] = []
  const minimumHeaderLength = headerBytes.length + SALT_LENGTH_BYTES

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      pendingBytes = concatBytes(pendingBytes, value)

      if (!key && pendingBytes.length >= minimumHeaderLength) {
        const incomingHeader = new TextDecoder().decode(
          pendingBytes.slice(0, headerBytes.length),
        )

        if (incomingHeader !== headerText) {
          throw new CriptoveuError(
            'INVALID_FILE',
            'Arquivo inválido. Não foi possível reconhecer este pacote protegido.',
          )
        }

        const salt = pendingBytes.slice(headerBytes.length, minimumHeaderLength)
        key = await derivePbkdf2AesKey(password, salt, 'decrypt')
        pendingBytes = pendingBytes.slice(minimumHeaderLength)
        consumedBytes = minimumHeaderLength
        await reportProgress(onProgress, 18, 'Chave AES-GCM preparada')
      }

      while (key && pendingBytes.length >= IV_LENGTH_BYTES + CHUNK_RECORD_LENGTH_BYTES) {
        const lengthStart = IV_LENGTH_BYTES
        const lengthEnd = lengthStart + CHUNK_RECORD_LENGTH_BYTES
        const ciphertextLength = readLengthPrefix(
          pendingBytes.slice(lengthStart, lengthEnd),
        )
        assertChunkCiphertextLength(ciphertextLength, null)
        const recordLength =
          IV_LENGTH_BYTES + CHUNK_RECORD_LENGTH_BYTES + ciphertextLength

        if (pendingBytes.length < recordLength) {
          break
        }

        const iv = cloneBytes(pendingBytes.slice(0, IV_LENGTH_BYTES))
        const ciphertext = pendingBytes.slice(lengthEnd, recordLength)

        try {
          const decrypted = await crypto.subtle.decrypt(
            {
              name: 'AES-GCM',
              iv,
              additionalData: buildChunkAdditionalData(chunkIndex, headerText),
            },
            key,
            ciphertext,
          )
          decryptedParts.push(new Uint8Array(decrypted))
        } catch (error) {
          if (error instanceof DOMException && error.name === 'OperationError') {
            throw new CriptoveuError(
              'INVALID_PASSWORD_OR_FILE',
              'Senha incorreta ou arquivo inválido. Verifique a chave e tente novamente.',
            )
          }

          throw error
        }

        pendingBytes = pendingBytes.slice(recordLength)
        consumedBytes += recordLength
        chunkIndex += 1
        await reportProgress(
          onProgress,
          Math.min(96, 18 + Math.round((consumedBytes / file.size) * 78)),
          `Abrindo bloco ${chunkIndex}`,
        )
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!key || pendingBytes.length > 0 || chunkIndex === 0) {
    throw new CriptoveuError('INVALID_FILE', 'Arquivo inválido ou incompleto.')
  }

  const downloadName = buildDownloadName('decrypt', file.name)
  const blob = new Blob(decryptedParts, {
    type: inferMimeTypeFromName(downloadName),
  })
  const format =
    headerText === PBKDF2_CHUNKED_FILE_HEADER_TEXT
      ? 'CRIPTOVEU2'
      : 'CRIPTIFY2'

  return {
    blob,
    downloadName,
    securityReport: createAeadOnlySecurityReport({
      format,
      kdf: 'PBKDF2/SHA-256',
      memoryMb: null,
      iterations: PBKDF2_ITERATIONS,
      parallelism: null,
      chunkSize: STREAMING_CHUNK_SIZE_BYTES,
      chunkCount: chunkIndex,
      originalName: downloadName,
      originalSize: blob.size,
    }),
  }
}

async function decryptArgon2ChunkedFile(
  file: File,
  password: string,
  onProgress?: ProgressCallback,
): Promise<ProcessResult> {
  await reportProgress(onProgress, 8, 'Lendo cabeçalho Argon2id')
  const reader = file.stream().getReader()
  let pendingBytes = new Uint8Array(0)
  let fixedHeader: Uint8Array<ArrayBuffer> | null = null
  let firstIv: Uint8Array<ArrayBuffer> | null = null
  let argon2Parameters: Argon2Parameters | null = null
  let key: CryptoKey | null = null
  let chunkIndex = 0
  let consumedBytes = 0
  let bufferedCiphertext: Uint8Array<ArrayBuffer> | null = null
  let bufferedCiphertextLength = 0
  const decryptedParts: BlobPart[] = []

  async function decryptChunk(
    ciphertext: Uint8Array<ArrayBuffer>,
    ciphertextLength: number,
    isFinalChunk: boolean,
  ) {
    if (!key || !fixedHeader || !firstIv) {
      throw new CriptoveuError('INVALID_FILE', 'Arquivo inválido ou incompleto.')
    }

    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: deriveChunkIv(firstIv, chunkIndex),
          additionalData: buildArgon2ChunkAdditionalData(
            fixedHeader,
            chunkIndex,
            ciphertextLength,
            isFinalChunk,
          ),
        },
        key,
        ciphertext,
      )
      decryptedParts.push(new Uint8Array(decrypted))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'OperationError') {
        throw new CriptoveuError(
          'INVALID_PASSWORD_OR_FILE',
          'Senha incorreta ou arquivo inválido. Verifique a chave e tente novamente.',
        )
      }

      throw error
    }

    chunkIndex += 1
    await reportProgress(
      onProgress,
      Math.min(96, 18 + Math.round((consumedBytes / file.size) * 78)),
      `Abrindo bloco ${chunkIndex}`,
    )
  }

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      pendingBytes = concatBytes(pendingBytes, value)

      if (!key && pendingBytes.length >= ARGON2_HEADER_LENGTH_BYTES) {
        fixedHeader = cloneBytes(pendingBytes.slice(0, ARGON2_HEADER_LENGTH_BYTES))
        const incomingHeader = new TextDecoder().decode(
          fixedHeader.slice(0, ARGON2_CHUNKED_FILE_HEADER_BYTES.length),
        )

        if (incomingHeader !== ARGON2_CHUNKED_FILE_HEADER_TEXT) {
          throw new CriptoveuError(
            'INVALID_FILE',
            'Arquivo inválido. Não foi possível reconhecer este pacote protegido.',
          )
        }

        const parsedHeader = readArgon2Header(fixedHeader)
        firstIv = cloneBytes(parsedHeader.firstIv)
        argon2Parameters = parsedHeader.parameters
        await reportProgress(
          onProgress,
          12,
          `Derivando chave Argon2id (${parsedHeader.parameters.memoryMb} MB)`,
        )
        key = await deriveArgon2AesKey(
          password,
          parsedHeader.salt,
          parsedHeader.parameters,
          'decrypt',
        )
        pendingBytes = pendingBytes.slice(ARGON2_HEADER_LENGTH_BYTES)
        consumedBytes = ARGON2_HEADER_LENGTH_BYTES
        await reportProgress(onProgress, 18, 'Chave AES-GCM preparada')
      }

      while (key && fixedHeader && firstIv && pendingBytes.length >= CHUNK_RECORD_LENGTH_BYTES) {
        const ciphertextLength = readLengthPrefix(
          pendingBytes.slice(0, CHUNK_RECORD_LENGTH_BYTES),
        )
        assertChunkCiphertextLength(ciphertextLength)
        const recordLength = CHUNK_RECORD_LENGTH_BYTES + ciphertextLength

        if (pendingBytes.length < recordLength) {
          break
        }

        if (bufferedCiphertext) {
          await decryptChunk(bufferedCiphertext, bufferedCiphertextLength, false)
        }

        bufferedCiphertext = cloneBytes(
          pendingBytes.slice(CHUNK_RECORD_LENGTH_BYTES, recordLength),
        )
        bufferedCiphertextLength = ciphertextLength
        pendingBytes = pendingBytes.slice(recordLength)
        consumedBytes += recordLength
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (
    !key ||
    !argon2Parameters ||
    pendingBytes.length > 0 ||
    !bufferedCiphertext
  ) {
    throw new CriptoveuError('INVALID_FILE', 'Arquivo inválido ou incompleto.')
  }

  await decryptChunk(bufferedCiphertext, bufferedCiphertextLength, true)

  const downloadName = buildDownloadName('decrypt', file.name)
  const blob = new Blob(decryptedParts, {
    type: inferMimeTypeFromName(downloadName),
  })

  return {
    blob,
    downloadName,
    securityReport: createAeadOnlySecurityReport({
      format: 'CRIPTOVEU3',
      kdf: 'Argon2id',
      memoryMb: argon2Parameters.memoryMb,
      iterations: argon2Parameters.iterations,
      parallelism: 1,
      chunkSize: STREAMING_CHUNK_SIZE_BYTES,
      chunkCount: chunkIndex,
      originalName: downloadName,
      originalSize: blob.size,
    }),
  }
}

async function decryptIntegrityChunkedFile(
  file: File,
  password: string,
  format: FileIntegrityFormat,
  keyFile: File | null,
  onProgress?: ProgressCallback,
): Promise<ProcessResult> {
  if (format === 'CRIPTOVEU5' && !keyFile) {
    throw new CriptoveuError(
      'KEY_FILE_REQUIRED',
      'Este pacote exige o arquivo-chave original além da senha.',
    )
  }

  const expectedHeaderBytes =
    format === 'CRIPTOVEU5'
      ? KEY_FILE_CHUNKED_FILE_HEADER_BYTES
      : format === 'CRIPTOVEU6'
        ? RECOVERABLE_CHUNKED_FILE_HEADER_BYTES
        : INTEGRITY_CHUNKED_FILE_HEADER_BYTES
  await reportProgress(onProgress, 6, `Lendo cabeçalho ${format}`)
  const reader = file.stream().getReader()
  let pendingBytes = new Uint8Array(0)
  let fixedHeader: Uint8Array<ArrayBuffer> | null = null
  let parsedHeader: ReturnType<typeof readIntegrityHeader> | null = null
  let key: CryptoKey | null = null
  let dataChunkIndex = 0
  let consumedBytes = 0
  let decryptedSize = 0
  let manifest: FileIntegrityManifest | null = null
  let recoveredBlocks = 0
  const recoverableGroup: Array<{
    ciphertext: Uint8Array<ArrayBuffer>
    ciphertextLength: number
    recordIndex: number
  }> = []
  const decryptedParts: BlobPart[] = []

  async function decryptRecord(
    recordType: number,
    ciphertext: Uint8Array<ArrayBuffer>,
    ciphertextLength: number,
    recordIndex: number,
  ) {
    if (!key || !fixedHeader || !parsedHeader) {
      throw new CriptoveuError(
        'INVALID_FILE',
        `Pacote ${format} incompleto.`,
      )
    }

    try {
      return new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: deriveChunkIv(parsedHeader.firstIv, recordIndex),
            additionalData: buildIntegrityRecordAdditionalData(
              fixedHeader,
              recordType,
              recordIndex,
              ciphertextLength,
            ),
          },
          key,
          ciphertext,
        ),
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'OperationError') {
        throw new CriptoveuError(
          'INVALID_PASSWORD_OR_FILE',
          format === 'CRIPTOVEU5'
            ? 'Senha ou arquivo-chave incorreto, ou pacote adulterado.'
            : format === 'CRIPTOVEU6'
              ? 'Senha incorreta ou pacote recuperável adulterado além da capacidade de paridade.'
            : 'Senha incorreta ou pacote CRIPTOVEU4 adulterado.',
        )
      }

      throw error
    }
  }

  async function decryptRecoverableGroup(parity: Uint8Array<ArrayBuffer>) {
    const decryptedGroup: Uint8Array[] = []
    let failedIndex = -1

    for (const [index, record] of recoverableGroup.entries()) {
      try {
        decryptedGroup[index] = await decryptRecord(
          INTEGRITY_DATA_RECORD_TYPE,
          record.ciphertext,
          record.ciphertextLength,
          record.recordIndex,
        )
      } catch (error) {
        if (failedIndex !== -1) {
          throw error
        }

        failedIndex = index
      }
    }

    if (failedIndex !== -1) {
      const failedRecord = recoverableGroup[failedIndex]
      const recoveredCiphertext = recoverXorParityChunk(
        parity,
        recoverableGroup
          .filter((_, index) => index !== failedIndex)
          .map((record) => record.ciphertext),
        failedRecord.ciphertextLength,
      )
      decryptedGroup[failedIndex] = await decryptRecord(
        INTEGRITY_DATA_RECORD_TYPE,
        recoveredCiphertext,
        failedRecord.ciphertextLength,
        failedRecord.recordIndex,
      )
      recoveredBlocks += 1
    }

    for (const decrypted of decryptedGroup) {
      decryptedParts.push(cloneBytes(decrypted))
      decryptedSize += decrypted.byteLength
    }

    recoverableGroup.length = 0
  }

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      pendingBytes = concatBytes(pendingBytes, value)

      if (!key && pendingBytes.length >= INTEGRITY_HEADER_LENGTH_BYTES) {
        fixedHeader = cloneBytes(
          pendingBytes.slice(0, INTEGRITY_HEADER_LENGTH_BYTES),
        )
        const incomingHeader = new TextDecoder().decode(
          fixedHeader.slice(0, expectedHeaderBytes.length),
        )

        if (incomingHeader !== format) {
          throw new CriptoveuError(
            'INVALID_FILE',
            `A assinatura ${format} não foi reconhecida.`,
          )
        }

        parsedHeader = readIntegrityHeader(fixedHeader)
        const minimumPackageSize =
          INTEGRITY_HEADER_LENGTH_BYTES +
          parsedHeader.chunkCount *
            (INTEGRITY_RECORD_HEADER_BYTES + AES_GCM_TAG_LENGTH_BYTES) +
          INTEGRITY_RECORD_HEADER_BYTES +
          AES_GCM_TAG_LENGTH_BYTES

        if (file.size < minimumPackageSize) {
          throw new CriptoveuError(
            'INVALID_FILE',
            'A quantidade de blocos declarada não cabe neste pacote.',
          )
        }

        const passwordMaterial = await resolveFilePasswordMaterial(
          password,
          format === 'CRIPTOVEU5' ? keyFile : null,
          (progress) => {
            onProgress?.(
              10 + Math.round(progress * 0.06),
              `Processando arquivo-chave (${progress}%)`,
            )
          },
        )
        await reportProgress(
          onProgress,
          format === 'CRIPTOVEU5' ? 17 : 10,
          `Derivando chave Argon2id (${parsedHeader.parameters.memoryMb} MB)`,
        )
        key = await deriveArgon2AesKey(
          passwordMaterial,
          parsedHeader.salt,
          parsedHeader.parameters,
          'decrypt',
        )
        pendingBytes = pendingBytes.slice(INTEGRITY_HEADER_LENGTH_BYTES)
        consumedBytes = INTEGRITY_HEADER_LENGTH_BYTES
        await reportProgress(
          onProgress,
          format === 'CRIPTOVEU5' ? 22 : 16,
          'Chave AES-GCM preparada',
        )
      }

      while (
        key &&
        fixedHeader &&
        parsedHeader &&
        pendingBytes.length >= INTEGRITY_RECORD_HEADER_BYTES
      ) {
        const recordHeader = readIntegrityRecordHeader(
          pendingBytes.slice(0, INTEGRITY_RECORD_HEADER_BYTES),
        )
        const expectingData = dataChunkIndex < parsedHeader.chunkCount
        const groupNeedsParity =
          format === 'CRIPTOVEU6' &&
          recoverableGroup.length > 0 &&
          (recoverableGroup.length === RECOVERABLE_PARITY_GROUP_SIZE ||
            dataChunkIndex === parsedHeader.chunkCount)
        const expectedType = groupNeedsParity
          ? RECOVERABLE_PARITY_RECORD_TYPE
          : expectingData
            ? INTEGRITY_DATA_RECORD_TYPE
            : INTEGRITY_MANIFEST_RECORD_TYPE
        const maximumLength = expectedType === INTEGRITY_MANIFEST_RECORD_TYPE
          ? MAX_FILE_INTEGRITY_MANIFEST_BYTES + AES_GCM_TAG_LENGTH_BYTES
          : parsedHeader.chunkSize + AES_GCM_TAG_LENGTH_BYTES

        if (recordHeader.recordType !== expectedType || manifest) {
          throw new CriptoveuError(
            'INVALID_FILE',
            'A ordem dos registros CRIPTOVEU4 é inválida.',
          )
        }

        assertChunkCiphertextLength(
          recordHeader.ciphertextLength,
          maximumLength,
        )
        const recordLength =
          INTEGRITY_RECORD_HEADER_BYTES + recordHeader.ciphertextLength

        if (pendingBytes.length < recordLength) {
          break
        }

        const ciphertext = cloneBytes(
          pendingBytes.slice(INTEGRITY_RECORD_HEADER_BYTES, recordLength),
        )
        if (groupNeedsParity) {
          await decryptRecoverableGroup(ciphertext)
          await reportProgress(
            onProgress,
            Math.min(88, 16 + Math.round((consumedBytes / file.size) * 72)),
            `Recuperando grupo de paridade até o bloco ${dataChunkIndex}`,
          )
        } else if (expectingData) {
          if (format === 'CRIPTOVEU6') {
            recoverableGroup.push({
              ciphertext,
              ciphertextLength: recordHeader.ciphertextLength,
              recordIndex: dataChunkIndex,
            })
          } else {
            const decrypted = await decryptRecord(
              recordHeader.recordType,
              ciphertext,
              recordHeader.ciphertextLength,
              dataChunkIndex,
            )
            decryptedParts.push(decrypted)
            decryptedSize += decrypted.byteLength
          }
          dataChunkIndex += 1
        } else {
          const decrypted = await decryptRecord(
            recordHeader.recordType,
            ciphertext,
            recordHeader.ciphertextLength,
            parsedHeader.chunkCount,
          )
          try {
            manifest = parseFileIntegrityManifest(decrypted)
          } catch (error) {
            if (error instanceof FileIntegrityError) {
              throw new CriptoveuError('INTEGRITY_FAILED', error.message)
            }

            throw error
          }
        }

        pendingBytes = pendingBytes.slice(recordLength)
        consumedBytes += recordLength
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (
    !key ||
    !parsedHeader ||
    pendingBytes.length > 0 ||
    dataChunkIndex !== parsedHeader.chunkCount ||
    recoverableGroup.length > 0 ||
    !manifest
  ) {
    throw new CriptoveuError(
      'INVALID_FILE',
      `Pacote ${format} inválido, truncado ou sem manifesto.`,
    )
  }

  if (
    manifest.format !== format ||
    manifest.chunkSize !== parsedHeader.chunkSize ||
    manifest.chunkCount !== parsedHeader.chunkCount ||
    manifest.originalSize !== decryptedSize ||
    manifest.argon2.memoryMb !== parsedHeader.parameters.memoryMb ||
    manifest.argon2.iterations !== parsedHeader.parameters.iterations
  ) {
    throw new CriptoveuError(
      'INTEGRITY_FAILED',
      'O manifesto não confere com o cabeçalho ou o conteúdo recuperado.',
    )
  }

  const blob = new Blob(decryptedParts, { type: manifest.mimeType })
  decryptedParts.length = 0
  key = null
  let hashes

  try {
    hashes = await hashBlobIntegrity(
      blob,
      manifest.chunkSize,
      (progress) => {
        onProgress?.(
          90 + Math.round(progress * 0.08),
          `Verificando Escudo de Integridade (${progress}%)`,
        )
      },
    )
    assertIntegrityHashes(manifest, hashes)
  } catch (error) {
    if (error instanceof FileIntegrityError) {
      throw new CriptoveuError('INTEGRITY_FAILED', error.message)
    }

    throw error
  }

  await reportProgress(onProgress, 99, 'Manifesto e SHA-256 verificados')

  return {
    blob,
    downloadName: manifest.originalName,
    securityReport: {
      operation: 'decrypt',
      format,
      encryption: 'AES-256-GCM',
      kdf: 'Argon2id',
      memoryMb: parsedHeader.parameters.memoryMb,
      iterations: parsedHeader.parameters.iterations,
      parallelism: 1,
      chunkSize: manifest.chunkSize,
      chunkCount: manifest.chunkCount,
      integrity: {
        aesGcmAuthenticated: true,
        manifestVerified: true,
        sha256Verified: true,
        status: 'verified',
      },
      fileHashSha256: hashes.fileHashSha256,
      manifestId: manifest.manifestId,
      createdAt: manifest.createdAt,
      originalName: manifest.originalName,
      originalSize: manifest.originalSize,
      keyFileProtection: {
        required: format === 'CRIPTOVEU5',
        digest: format === 'CRIPTOVEU5' ? 'SHA-256' : null,
        embedded: false,
      },
      recoverableParity: {
        enabled: format === 'CRIPTOVEU6',
        groupSize:
          format === 'CRIPTOVEU6' ? RECOVERABLE_PARITY_GROUP_SIZE : null,
        recoveredBlocks,
      },
      uploadToServer: false,
      note:
        format === 'CRIPTOVEU6'
          ? recoveredBlocks > 0
            ? `Paridade recuperou ${recoveredBlocks} bloco(s) e o manifesto SHA-256 foi confirmado localmente.`
            : 'Paridade recuperável, AES-GCM, manifesto e SHA-256 verificados localmente.'
          : format === 'CRIPTOVEU5'
          ? 'Proteção dupla, manifesto e SHA-256 verificados localmente. O arquivo-chave não estava incorporado ao pacote.'
          : 'Escudo de Integridade verificado após a recuperação local do conteúdo.',
    },
  }
}

export async function decryptFile(
  file: File,
  password: string,
  onProgress?: ProgressCallback,
  options?: FileEncryptionOptions,
): Promise<ProcessResult> {
  const modernHeader = await file
    .slice(0, INTEGRITY_CHUNKED_FILE_HEADER_BYTES.length)
    .text()

  if (
    supportsOpfsCrypto() &&
    (modernHeader === KEY_FILE_CHUNKED_FILE_HEADER_TEXT ||
      modernHeader === RECOVERABLE_CHUNKED_FILE_HEADER_TEXT ||
      modernHeader === INTEGRITY_CHUNKED_FILE_HEADER_TEXT)
  ) {
    try {
      return await processFileWithOpfs(
        'decrypt',
        file,
        password,
        onProgress,
        options,
      )
    } catch (error) {
      if (!(error instanceof OpfsUnavailableError)) {
        throw error
      }
    }
  }

  assertSupportedPackageSize(file, options)
  let result: ProcessResult

  if (modernHeader === KEY_FILE_CHUNKED_FILE_HEADER_TEXT) {
    result = await decryptIntegrityChunkedFile(
      file,
      password,
      'CRIPTOVEU5',
      options?.keyFile ?? null,
      onProgress,
    )
  } else if (modernHeader === RECOVERABLE_CHUNKED_FILE_HEADER_TEXT) {
    result = await decryptIntegrityChunkedFile(
      file,
      password,
      'CRIPTOVEU6',
      null,
      onProgress,
    )
  } else if (modernHeader === INTEGRITY_CHUNKED_FILE_HEADER_TEXT) {
    result = await decryptIntegrityChunkedFile(
      file,
      password,
      'CRIPTOVEU4',
      null,
      onProgress,
    )
  } else if (modernHeader === ARGON2_CHUNKED_FILE_HEADER_TEXT) {
    result = await decryptArgon2ChunkedFile(file, password, onProgress)
  } else if (modernHeader === PBKDF2_CHUNKED_FILE_HEADER_TEXT) {
    result = await decryptPbkdf2ChunkedFile(
      file,
      password,
      PBKDF2_CHUNKED_FILE_HEADER_TEXT,
      PBKDF2_CHUNKED_FILE_HEADER_BYTES,
      onProgress,
    )
  } else {
    const legacyChunkedHeader = await file
      .slice(0, LEGACY_CHUNKED_FILE_HEADER_BYTES.length)
      .text()

    if (legacyChunkedHeader === LEGACY_CHUNKED_FILE_HEADER_TEXT) {
      result = await decryptPbkdf2ChunkedFile(
        file,
        password,
        LEGACY_CHUNKED_FILE_HEADER_TEXT,
        LEGACY_CHUNKED_FILE_HEADER_BYTES,
        onProgress,
      )
    } else {
      result = await decryptLegacyFile(file, password, onProgress)
    }
  }

  assertRecoveredFileSize(result.blob, options)
  return {
    ...result,
    manifestMimeType: result.blob.type,
  }
}

export function formatFileSize(bytes: number) {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const decimals = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2
  return `${size.toFixed(decimals)} ${units[unitIndex]}`
}





