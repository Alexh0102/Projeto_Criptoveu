const encoder = new TextEncoder()
const decoder = new TextDecoder()

const SALT_LENGTH_BYTES = 16
const IV_LENGTH_BYTES = 12

export const VEU_NOTES_VERSION = 1
export const VEU_NOTES_MIN_PASSWORD_LENGTH = 12
export const VEU_NOTES_PBKDF2_ITERATIONS = 210_000

export type VeuNotesBlobJson = {
  version: number
  salt: string
  iterations: number
  iv: string
  ciphertext: string
}

export class VeuNotesCryptoError extends Error {
  code: 'INVALID_PASSWORD' | 'INVALID_BLOB' | 'UNSUPPORTED_VERSION'

  constructor(
    code: 'INVALID_PASSWORD' | 'INVALID_BLOB' | 'UNSUPPORTED_VERSION',
    message: string,
  ) {
    super(message)
    this.name = 'VeuNotesCryptoError'
    this.code = code
  }
}

export function encodeBytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

export function decodeBase64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(new ArrayBuffer(length))
  crypto.getRandomValues(bytes)
  return bytes
}

function cloneBytes(source: Uint8Array) {
  const bytes = new Uint8Array(new ArrayBuffer(source.length))
  bytes.set(source)
  return bytes
}

export function isVeuNotesBlobJson(value: unknown): value is VeuNotesBlobJson {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.version === 'number' &&
    typeof candidate.salt === 'string' &&
    typeof candidate.iterations === 'number' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.ciphertext === 'string'
  )
}

export function assertVeuNotesBlobJson(value: unknown): VeuNotesBlobJson {
  if (!isVeuNotesBlobJson(value)) {
    throw new VeuNotesCryptoError(
      'INVALID_BLOB',
      'O cofre não está no formato esperado.',
    )
  }

  if (value.version !== VEU_NOTES_VERSION) {
    throw new VeuNotesCryptoError(
      'UNSUPPORTED_VERSION',
      'Esta versão do cofre não é compatível com o VéuNotes atual.',
    )
  }

  if (value.iterations < 100_000) {
    throw new VeuNotesCryptoError(
      'INVALID_BLOB',
      'O cofre salvo usa parâmetros de derivação inválidos.',
    )
  }

  return value
}

export async function getPasswordKey(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
}

export async function deriveAesKey(
  passwordKey: CryptoKey,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: cloneBytes(salt),
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function deriveSessionKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
) {
  const passwordKey = await getPasswordKey(password)
  return deriveAesKey(passwordKey, salt, iterations)
}

export async function encryptNoteWithKey(
  plaintext: string,
  aesKey: CryptoKey,
  salt: Uint8Array,
  iterations: number,
): Promise<VeuNotesBlobJson> {
  const iv = randomBytes(IV_LENGTH_BYTES)
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    encoder.encode(plaintext),
  )

  return {
    version: VEU_NOTES_VERSION,
    salt: encodeBytesToBase64(salt),
    iterations,
    iv: encodeBytesToBase64(iv),
    ciphertext: encodeBytesToBase64(new Uint8Array(encrypted)),
  }
}

export async function decryptNoteWithKey(
  blobJson: VeuNotesBlobJson,
  aesKey: CryptoKey,
): Promise<string> {
  const safeBlob = assertVeuNotesBlobJson(blobJson)

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: cloneBytes(decodeBase64ToBytes(safeBlob.iv)),
      },
      aesKey,
      decodeBase64ToBytes(safeBlob.ciphertext),
    )

    return decoder.decode(decrypted)
  } catch {
    throw new VeuNotesCryptoError(
      'INVALID_PASSWORD',
      'Senha incorreta ou cofre inválido. Verifique a senha e tente novamente.',
    )
  }
}

export async function encryptNote(
  plaintext: string,
  password: string,
): Promise<VeuNotesBlobJson> {
  const salt = randomBytes(SALT_LENGTH_BYTES)
  const passwordKey = await getPasswordKey(password)
  const aesKey = await deriveAesKey(passwordKey, salt, VEU_NOTES_PBKDF2_ITERATIONS)

  return encryptNoteWithKey(plaintext, aesKey, salt, VEU_NOTES_PBKDF2_ITERATIONS)
}

export async function decryptNote(
  blobJson: VeuNotesBlobJson,
  password: string,
): Promise<string> {
  const safeBlob = assertVeuNotesBlobJson(blobJson)
  const passwordKey = await getPasswordKey(password)
  const aesKey = await deriveAesKey(
    passwordKey,
    decodeBase64ToBytes(safeBlob.salt),
    safeBlob.iterations,
  )

  return decryptNoteWithKey(safeBlob, aesKey)
}
