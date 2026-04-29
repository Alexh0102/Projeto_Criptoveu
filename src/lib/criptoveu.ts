const LEGACY_FILE_HEADER_TEXT = 'CRIPTIFY1'
const LEGACY_CHUNKED_FILE_HEADER_TEXT = 'CRIPTIFY2'
const CHUNKED_FILE_HEADER_TEXT = 'CRIPTOVEU2'
const LEGACY_FILE_HEADER_BYTES = new TextEncoder().encode(LEGACY_FILE_HEADER_TEXT)
const CHUNKED_FILE_HEADER_BYTES = new TextEncoder().encode(CHUNKED_FILE_HEADER_TEXT)
const SALT_LENGTH_BYTES = 16
const IV_LENGTH_BYTES = 12
const PBKDF2_ITERATIONS = 600_000
const BASE64_CHUNK_SIZE_BYTES = 0x8000
const CHUNK_RECORD_LENGTH_BYTES = 4
export const STREAMING_CHUNK_SIZE_BYTES = 2 * 1024 * 1024
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024

type ProgressCallback = (value: number, label: string) => void

type PasswordStrength = {
  level: number
  label: string
  barClass: string
  textClass: string
}

export type ProcessResult = {
  blob: Blob
  downloadName: string
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
  code: 'FILE_TOO_LARGE' | 'INVALID_FILE' | 'INVALID_PASSWORD_OR_FILE'

  constructor(
    code: 'FILE_TOO_LARGE' | 'INVALID_FILE' | 'INVALID_PASSWORD_OR_FILE',
    message: string,
  ) {
    super(message)
    this.name = 'CriptoveuError'
    this.code = code
  }
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

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length))
}

function buildChunkAdditionalData(
  chunkIndex: number,
  headerText = CHUNKED_FILE_HEADER_TEXT,
) {
  return new TextEncoder().encode(`${headerText}:${chunkIndex}`)
}

function createLengthPrefix(value: number) {
  const bytes = new Uint8Array(CHUNK_RECORD_LENGTH_BYTES)
  new DataView(bytes.buffer).setUint32(0, value, false)
  return bytes
}

function readLengthPrefix(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, CHUNK_RECORD_LENGTH_BYTES)
    .getUint32(0, false)
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

async function deriveAesKey(password: string, salt: Uint8Array, usage: KeyUsage) {
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

export function assertSupportedFileSize(file: File) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new CriptoveuError(
      'FILE_TOO_LARGE',
      `Arquivo excede o limite suportado de ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`,
    )
  }
}

export async function encryptFile(
  file: File,
  password: string,
  onProgress?: ProgressCallback,
): Promise<ProcessResult> {
  assertSupportedFileSize(file)
  await reportProgress(onProgress, 8, 'Preparando leitura por blocos')
  const salt = randomBytes(SALT_LENGTH_BYTES)
  const key = await deriveAesKey(password, salt, 'encrypt')
  const encryptedParts: BlobPart[] = [CHUNKED_FILE_HEADER_BYTES, salt]
  let processedBytes = 0
  let chunkIndex = 0

  await reportProgress(onProgress, 16, 'Derivando chave AES-GCM')

  async function encryptChunk(plainChunk: Uint8Array) {
    const iv = randomBytes(IV_LENGTH_BYTES)
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: buildChunkAdditionalData(chunkIndex),
      },
      key,
      cloneBytes(plainChunk),
    )
    const ciphertext = new Uint8Array(encrypted)

    encryptedParts.push(iv, createLengthPrefix(ciphertext.byteLength), ciphertext)
    processedBytes += plainChunk.byteLength
    chunkIndex += 1

    const progressBase = file.size === 0 ? 1 : processedBytes / file.size
    await reportProgress(
      onProgress,
      Math.min(92, 16 + Math.round(progressBase * 76)),
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

  await reportProgress(
    onProgress,
    96,
    `Finalizando ${chunkIndex} bloco(s) protegido(s)`,
  )

  return {
    blob: new Blob(encryptedParts, { type: 'application/octet-stream' }),
    downloadName: buildDownloadName('encrypt', file.name),
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
  const key = await deriveAesKey(password, salt, 'encrypt')
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
    const key = await deriveAesKey(password, encryptedInput.salt, 'decrypt')
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
  const key = await deriveAesKey(password, new Uint8Array(salt), 'decrypt')

  await reportProgress(onProgress, 76, 'Abrindo conteúdo protegido')

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      encrypted,
    )

    const downloadName = buildDownloadName('decrypt', file.name)

    return {
      blob: new Blob([decrypted], { type: inferMimeTypeFromName(downloadName) }),
      downloadName,
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

async function decryptChunkedFile(
  file: File,
  password: string,
  onProgress?: ProgressCallback,
): Promise<ProcessResult> {
  await reportProgress(onProgress, 8, 'Lendo cabeçalho protegido')
  const reader = file.stream().getReader()
  let pendingBytes = new Uint8Array(0)
  let key: CryptoKey | null = null
  let chunkHeaderText = CHUNKED_FILE_HEADER_TEXT
  let chunkIndex = 0
  let consumedBytes = 0
  const decryptedParts: BlobPart[] = []
  const minimumHeaderLength = CHUNKED_FILE_HEADER_BYTES.length + SALT_LENGTH_BYTES

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      pendingBytes = concatBytes(pendingBytes, value)

      if (!key && pendingBytes.length >= minimumHeaderLength) {
        const incomingHeader = new TextDecoder().decode(
          pendingBytes.slice(0, CHUNKED_FILE_HEADER_BYTES.length),
        )

        if (
          incomingHeader !== CHUNKED_FILE_HEADER_TEXT &&
          incomingHeader !== LEGACY_CHUNKED_FILE_HEADER_TEXT
        ) {
          throw new CriptoveuError(
            'INVALID_FILE',
            'Arquivo inválido. Não foi possível reconhecer este pacote protegido.',
          )
        }

        chunkHeaderText = incomingHeader
        const salt = pendingBytes.slice(
          CHUNKED_FILE_HEADER_BYTES.length,
          minimumHeaderLength,
        )
        key = await deriveAesKey(password, salt, 'decrypt')
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
              additionalData: buildChunkAdditionalData(chunkIndex, chunkHeaderText),
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

  return {
    blob: new Blob(decryptedParts, { type: inferMimeTypeFromName(downloadName) }),
    downloadName,
  }
}

export async function decryptFile(
  file: File,
  password: string,
  onProgress?: ProgressCallback,
): Promise<ProcessResult> {
  assertSupportedFileSize(file)
  const header = await file.slice(0, CHUNKED_FILE_HEADER_BYTES.length).text()

  if (
    header === CHUNKED_FILE_HEADER_TEXT ||
    header === LEGACY_CHUNKED_FILE_HEADER_TEXT
  ) {
    return decryptChunkedFile(file, password, onProgress)
  }

  return decryptLegacyFile(file, password, onProgress)
}

export function generateWhatsappStyleKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      level: 0,
      label: 'Digite uma senha',
      barClass: 'bg-zinc-700',
      textClass: 'font-medium text-zinc-400',
    }
  }

  let score = 0

  if (password.length >= 8) {
    score += 1
  }

  if (password.length >= 12) {
    score += 1
  }

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) {
    score += 1
  }

  if (/\d/.test(password)) {
    score += 1
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1
  }

  const level = Math.min(Math.max(score, 1), 5)

  const levels: Record<number, PasswordStrength> = {
    1: {
      level,
      label: 'Muito fraca',
      barClass: 'bg-rose-500',
      textClass: 'font-medium text-rose-300',
    },
    2: {
      level,
      label: 'Fraca',
      barClass: 'bg-orange-500',
      textClass: 'font-medium text-orange-300',
    },
    3: {
      level,
      label: 'Média',
      barClass: 'bg-yellow-500',
      textClass: 'font-medium text-yellow-300',
    },
    4: {
      level,
      label: 'Forte',
      barClass: 'bg-sky-500',
      textClass: 'font-medium text-sky-300',
    },
    5: {
      level,
      label: 'Muito forte',
      barClass: 'bg-emerald-500',
      textClass: 'font-medium text-emerald-300',
    },
  }

  return levels[level]
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





